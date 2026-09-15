import { sha256Hex } from './canonical';
import { zeustekDb, type AttachmentRow } from './db';

const SUPPORTED_OWNER_KINDS = new Set(['computer-import', 'computer-profile']);

function attachmentOwner(account: string, ownerKind: string, ownerId: string) {
  if (
    !account ||
    !SUPPORTED_OWNER_KINDS.has(ownerKind) ||
    !ownerId ||
    ownerId.includes(':')
  ) {
    throw new Error('Computer evidence attachment scope is invalid.');
  }
  return `dive:${account}:${ownerKind}:${ownerId}`;
}

function ownerFromRow(account: string, row: AttachmentRow) {
  const prefix = `dive:${account}:`;
  if (!row.entityId.startsWith(prefix)) return null;
  const scope = row.entityId.slice(prefix.length);
  const separator = scope.indexOf(':');
  if (separator < 1) return null;
  const ownerKind = scope.slice(0, separator);
  const ownerId = scope.slice(separator + 1);
  return SUPPORTED_OWNER_KINDS.has(ownerKind) && ownerId
    ? { ownerKind, ownerId }
    : null;
}

async function uploadEvidence(account: string, row: AttachmentRow) {
  const owner = ownerFromRow(account, row);
  const local = await zeustekDb.diveImages.get(row.attachmentId);
  if (!owner || !local || local.account !== account) return false;
  const form = new FormData();
  form.append(
    'file',
    new File([local.blob], row.fileName, { type: row.mimeType }),
  );
  form.append('ownerKind', owner.ownerKind);
  form.append('ownerId', owner.ownerId);
  form.append('uploadId', row.attachmentId);
  const response = await fetch('/api/media', { method: 'POST', body: form });
  if (!response.ok) return false;
  const result = (await response.json()) as { id?: string };
  if (result.id !== row.attachmentId) return false;
  await zeustekDb.transaction(
    'rw',
    [zeustekDb.attachments, zeustekDb.diveImages],
    async () => {
      await zeustekDb.attachments.update(row.attachmentId, {
        state: 'acknowledged',
      });
      await zeustekDb.diveImages.update(row.attachmentId, {
        remoteKey: row.attachmentId,
      });
    },
  );
  return true;
}

export async function flushComputerEvidenceAttachments(account: string) {
  if (!account || typeof navigator === 'undefined' || !navigator.onLine) return;
  const prefix = `dive:${account}:`;
  const pending = await zeustekDb.attachments
    .filter((row) => row.state === 'pending' && row.entityId.startsWith(prefix))
    .toArray();
  for (const row of pending) {
    try {
      await uploadEvidence(account, row);
    } catch {
      /* Local evidence remains queued. */
    }
  }
}

export function createComputerEvidenceStore(account: string) {
  return {
    capabilities: {
      localBackup: true,
      cloudSync: true,
      encryptedTransport: true,
    },
    async put(input: {
      ownerKind: string;
      ownerId: string;
      fileName: string;
      mimeType: string;
      bytes: Uint8Array;
    }) {
      const attachmentId = crypto.randomUUID();
      const entityId = attachmentOwner(account, input.ownerKind, input.ownerId);
      const sha256 = await sha256Hex(input.bytes);
      const createdAt = new Date().toISOString();
      const blob = new Blob([input.bytes.slice().buffer], {
        type: input.mimeType,
      });
      const row: AttachmentRow = {
        attachmentId,
        entityId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        byteLength: input.bytes.byteLength,
        sha256,
        state: 'pending',
      };
      await zeustekDb.transaction(
        'rw',
        [zeustekDb.attachments, zeustekDb.diveImages],
        async () => {
          await zeustekDb.attachments.add(row);
          await zeustekDb.diveImages.add({
            id: attachmentId,
            account,
            blob,
            name: input.fileName,
            createdAt,
          });
        },
      );
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await uploadEvidence(account, row);
        } catch {
          /* Retry through the normal local-first flush. */
        }
      }
      return attachmentId;
    },
    async remove(attachmentId: string) {
      const manifest = await zeustekDb.attachments.get(attachmentId);
      const local = await zeustekDb.diveImages.get(attachmentId);
      if (
        manifest &&
        local?.account === account &&
        typeof navigator !== 'undefined' &&
        navigator.onLine
      ) {
        await fetch(`/api/media?id=${encodeURIComponent(attachmentId)}`, {
          method: 'DELETE',
        }).catch(() => undefined);
      }
      await zeustekDb.transaction(
        'rw',
        [zeustekDb.attachments, zeustekDb.diveImages],
        async () => {
          await zeustekDb.attachments.delete(attachmentId);
          await zeustekDb.diveImages.delete(attachmentId);
        },
      );
    },
  };
}

export async function loadComputerEvidenceAttachment(
  account: string,
  attachmentId: string,
) {
  const manifest = await zeustekDb.attachments.get(attachmentId);
  const local = await zeustekDb.diveImages.get(attachmentId);
  if (local?.account === account) {
    if (!manifest)
      throw new Error('Stored computer evidence has no integrity manifest.');
    const bytes = new Uint8Array(await local.blob.arrayBuffer());
    if (
      bytes.byteLength !== manifest.byteLength ||
      (await sha256Hex(bytes)) !== manifest.sha256
    ) {
      throw new Error('Stored computer evidence failed its integrity check.');
    }
    return local.blob;
  }
  if (typeof navigator === 'undefined' || !navigator.onLine) {
    throw new Error(
      'This computer evidence is not available offline on this device yet.',
    );
  }
  const response = await fetch(
    `/api/media?id=${encodeURIComponent(attachmentId)}`,
    { cache: 'no-store' },
  );
  if (!response.ok)
    throw new Error(
      'Computer evidence is unavailable from the private cloud account.',
    );
  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (
    manifest &&
    (bytes.byteLength !== manifest.byteLength ||
      (await sha256Hex(bytes)) !== manifest.sha256)
  ) {
    throw new Error('Downloaded computer evidence failed its integrity check.');
  }
  await zeustekDb.diveImages.put({
    id: attachmentId,
    account,
    blob,
    name: manifest?.fileName ?? 'computer-evidence',
    remoteKey: attachmentId,
    createdAt: new Date().toISOString(),
  });
  return blob;
}
