import { env } from 'cloudflare:workers';
import {
  sharingOwner,
  sharingJson,
  boundedJson,
  tableExists,
  sha256,
} from '@/lib/server/sharing-access';
import { strictObject, opaqueId } from '@/lib/sharing/public-profile';
import { validateShareInput, type ShareInput } from '@/lib/sharing/share-links';
import {
  buildSharePreview,
  ensureShareSchema,
  shareCapability,
  readSharedArtifact,
  type ShareLinkRow,
} from '@/lib/server/share-links';
type ManagedRow = ShareLinkRow & {
  snapshot_json: string;
  selection_json: string;
};
async function owned(id: string, owner: string) {
  if (!(await tableExists(env.DB, 'dive_share_links'))) return null;
  return env.DB.prepare(
    "SELECT l.id,l.owner_user_id,l.expires_at,l.enabled,l.revision,l.created_at,l.updated_at,l.selection_json,p.snapshot_json FROM dive_share_links l JOIN dive_publications p ON p.slot='share:'||l.id AND p.owner_user_id=l.owner_user_id WHERE l.id=? AND l.owner_user_id=?",
  )
    .bind(id, owner)
    .first<ManagedRow>();
}
function metadata(row: ManagedRow) {
  const snapshot = readSharedArtifact(row.snapshot_json);
  if (row.selection_json.length > 32 * 1024)
    throw new Error('Selection unavailable.');
  return {
    id: row.id,
    kind: snapshot.kind,
    label: snapshot.label,
    mode: 'snapshot',
    access: 'anyone-with-link',
    enabled: Boolean(row.enabled),
    expired: row.expires_at !== null && row.expires_at <= Date.now(),
    expiresAt:
      row.expires_at === null ? null : new Date(row.expires_at).toISOString(),
    revision: row.revision,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    snapshot,
    input: validateShareInput(JSON.parse(row.selection_json)),
  };
}
export async function GET(request: Request) {
  const access = await sharingOwner();
  if (access.error) return access.error;
  try {
    const params = new URL(request.url).searchParams;
    if (params.get('catalog') === '1') {
      if (!(await tableExists(env.DB, 'dive_records')))
        return sharingJson({
          plans: [],
          certifications: [],
          training: [],
          attachments: [],
        });
      const records = await env.DB.prepare(
        "SELECT id,kind,data_json FROM dive_records WHERE user_id=? AND kind IN ('person','certification','training-progress','gas-plan') AND deleted_at IS NULL ORDER BY id LIMIT 2001",
      )
        .bind(access.user.userId)
        .all<{ id: string; kind: string; data_json: string }>();
      if (records.results.length > 2000)
        throw new Error('Catalogue too large.');
      let bytes = 0;
      const rows = records.results
        .map((row) => {
          bytes += row.data_json.length;
          if (row.data_json.length > 1024 * 1024 || bytes > 16 * 1024 * 1024)
            throw new Error('Catalogue too large.');
          return {
            ...row,
            data: JSON.parse(row.data_json) as Record<string, unknown>,
          };
        })
        .filter((row) => !row.data.suppressedFromUse);
      const owners = rows.filter(
          (row) =>
            row.kind === 'person' &&
            (row.data.roles as { ownerProfile?: boolean } | undefined)
              ?.ownerProfile === true,
        ),
        ownerId = owners.length === 1 ? owners[0]!.id : null;
      const options = (kind: string, title: string) =>
        rows
          .filter(
            (row) =>
              row.kind === kind &&
              (!['certification', 'training-progress'].includes(kind) ||
                (Boolean(ownerId) &&
                  (!row.data.personId || row.data.personId === ownerId))),
          )
          .map((row) => ({
            id: row.id,
            title:
              typeof row.data[title] === 'string'
                ? row.data[title].slice(0, 180)
                : 'Untitled record',
            agency:
              typeof row.data.agency === 'string'
                ? row.data.agency.slice(0, 100)
                : '',
          }));
      const attachments = (await tableExists(env.DB, 'dive_share_assets'))
        ? (
            await env.DB.prepare(
              'SELECT id,label,content_type AS contentType,byte_length AS bytes FROM dive_share_assets WHERE owner_user_id=? ORDER BY created_at DESC LIMIT 101',
            )
              .bind(access.user.userId)
              .all()
          ).results
        : [];
      return sharingJson({
        plans: options('gas-plan', 'name'),
        certifications: options('certification', 'certification'),
        training: options('training-progress', 'courseTitle'),
        attachments,
        attachmentLimitReached: attachments.length > 100,
      });
    }
    const offset = Number(params.get('offset') ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 200)
      return sharingJson({ error: 'Choose a supported page.' }, 400);
    if (!(await tableExists(env.DB, 'dive_share_links')))
      return sharingJson({ items: [], more: false, offset });
    const rows = await env.DB.prepare(
      "SELECT l.id,l.owner_user_id,l.expires_at,l.enabled,l.revision,l.created_at,l.updated_at,l.selection_json,p.snapshot_json FROM dive_share_links l JOIN dive_publications p ON p.slot='share:'||l.id AND p.owner_user_id=l.owner_user_id WHERE l.owner_user_id=? ORDER BY l.created_at DESC,l.id LIMIT 26 OFFSET ?",
    )
      .bind(access.user.userId, offset)
      .all<ManagedRow>();
    return sharingJson({
      items: rows.results.slice(0, 25).map(metadata),
      more: rows.results.length > 25,
      offset,
    });
  } catch {
    return sharingJson(
      {
        error:
          'Shared Links could not be loaded. Private records are unchanged.',
      },
      503,
    );
  }
}
export async function POST(request: Request) {
  const access = await sharingOwner(request);
  if (access.error) return access.error;
  let body: Record<string, unknown>;
  try {
    body = strictObject(await boundedJson(request), [
      'action',
      'input',
      'asOf',
      'previewHash',
      'id',
      'revision',
    ]);
  } catch {
    return sharingJson({ error: 'Use supported sharing controls.' }, 400);
  }
  const action = String(body.action);
  if (
    !['preview', 'create', 'replace', 'revoke', 'regenerate'].includes(action)
  )
    return sharingJson({ error: 'Choose a supported sharing action.' }, 400);
  const needsRecord = ['replace', 'revoke', 'regenerate'].includes(action);
  if (
    needsRecord &&
    (!opaqueId(body.id) ||
      !Number.isSafeInteger(body.revision) ||
      Number(body.revision) < 1)
  )
    return sharingJson({ error: 'Reopen the current Shared Link.' }, 400);
  if (
    ['revoke', 'regenerate'].includes(action) &&
    Object.keys(body).some((key) => !['action', 'id', 'revision'].includes(key))
  )
    return sharingJson({ error: 'Use supported sharing controls.' }, 400);
  if (
    ['preview', 'create'].includes(action) &&
    (body.id !== undefined || body.revision !== undefined)
  )
    return sharingJson({ error: 'Use supported sharing controls.' }, 400);
  try {
    const previous = needsRecord
      ? await owned(String(body.id), access.user.userId)
      : null;
    if (needsRecord && !previous)
      return sharingJson({ error: 'Shared Link unavailable.' }, 404);
    if (previous && previous.revision !== body.revision)
      return sharingJson(
        { error: 'This link changed. Reopen it before making another change.' },
        409,
      );
    if (action === 'replace' && !previous!.enabled)
      return sharingJson(
        {
          error:
            'This link is revoked. Reuse its selection to preview and create a new link.',
        },
        409,
      );
    if (action === 'regenerate') {
      if (
        !previous!.enabled ||
        (previous!.expires_at !== null && previous!.expires_at <= Date.now())
      )
        return sharingJson(
          {
            error:
              'Preview and publish an active snapshot before regenerating.',
          },
          409,
        );
      const token = shareCapability(),
        updated = await env.DB.prepare(
          'UPDATE dive_share_links SET token_hash=?,revision=revision+1,updated_at=?,operation_id=? WHERE id=? AND owner_user_id=? AND revision=? AND enabled=1',
        )
          .bind(
            await sha256(token),
            Date.now(),
            crypto.randomUUID(),
            previous!.id,
            access.user.userId,
            body.revision,
          )
          .run();
      if (!updated.meta.changes)
        return sharingJson({ error: 'This link changed. Reopen it.' }, 409);
      return sharingJson({
        id: previous!.id,
        token,
        revision: previous!.revision + 1,
      });
    }
    if (action === 'revoke') {
      const operation = crypto.randomUUID(),
        now = Date.now(),
        results = await env.DB.batch([
          env.DB.prepare(
            'UPDATE dive_share_links SET enabled=0,revision=revision+1,updated_at=?,operation_id=? WHERE id=? AND owner_user_id=? AND revision=?',
          ).bind(
            now,
            operation,
            previous!.id,
            access.user.userId,
            body.revision,
          ),
          env.DB.prepare(
            'UPDATE dive_publications SET enabled=0,updated_at=? WHERE slot=? AND owner_user_id=? AND EXISTS(SELECT 1 FROM dive_share_links WHERE id=? AND owner_user_id=? AND operation_id=?)',
          ).bind(
            now,
            'share:' + previous!.id,
            access.user.userId,
            previous!.id,
            access.user.userId,
            operation,
          ),
        ]);
      if (!results[0]!.meta.changes)
        return sharingJson({ error: 'This link changed. Reopen it.' }, 409);
      return sharingJson({
        id: previous!.id,
        enabled: false,
        revision: previous!.revision + 1,
      });
    }
    let input: ShareInput;
    try {
      input = validateShareInput(body.input);
    } catch {
      return sharingJson(
        {
          error:
            'Choose only supported fields, saved sources and prepared attachments.',
        },
        400,
      );
    }
    if (
      input.expiresAt !== null &&
      (Date.parse(input.expiresAt) <= Date.now() ||
        Date.parse(input.expiresAt) > Date.now() + 366 * 24 * 60 * 60 * 1000)
    )
      return sharingJson(
        {
          error:
            'Choose a future expiry within one year, or explicitly choose no expiry.',
        },
        400,
      );
    let asOf: string | undefined;
    if (action !== 'preview') {
      if (
        typeof body.asOf !== 'string' ||
        !Number.isFinite(Date.parse(body.asOf)) ||
        Math.abs(Date.now() - Date.parse(body.asOf)) > 15 * 60 * 1000 ||
        typeof body.previewHash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(body.previewHash)
      )
        return sharingJson(
          { error: 'Review a fresh exact visitor preview.' },
          409,
        );
      asOf = body.asOf;
    }
    let preview;
    try {
      preview = await buildSharePreview(
        env.DB,
        access.user.userId,
        input,
        asOf,
      );
    } catch {
      return sharingJson(
        {
          error:
            'Selected evidence or attachment unavailable. Review the current private source and preview again.',
        },
        409,
      );
    }
    if (action === 'preview') return sharingJson(preview);
    if (preview.previewHash !== body.previewHash)
      return sharingJson(
        {
          error:
            'Selected evidence changed. Review a fresh exact visitor preview.',
        },
        409,
      );
    await ensureShareSchema(env.DB);
    const now = Date.now(),
      expiry = input.expiresAt === null ? null : Date.parse(input.expiresAt),
      operation = crypto.randomUUID();
    if (action === 'create') {
      const id = crypto.randomUUID(),
        token = shareCapability();
      const results = await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO dive_share_links (id,owner_user_id,token_hash,expires_at,enabled,revision,created_at,updated_at,selection_json,operation_id) SELECT ?,?,?,?,1,1,?,?,?,? WHERE (SELECT COUNT(*) FROM dive_share_links WHERE owner_user_id=?)<200',
        ).bind(
          id,
          access.user.userId,
          await sha256(token),
          expiry,
          now,
          now,
          JSON.stringify(input),
          operation,
          access.user.userId,
        ),
        env.DB.prepare(
          'INSERT INTO dive_publications (slot,owner_user_id,public_id,enabled,snapshot_json,photo_id,created_at,updated_at) SELECT ?,?,?,1,?,?,?,? WHERE EXISTS(SELECT 1 FROM dive_share_links WHERE id=? AND owner_user_id=? AND operation_id=?)',
        ).bind(
          'share:' + id,
          access.user.userId,
          id,
          JSON.stringify(preview.snapshot),
          input.profile?.photoId ?? null,
          now,
          now,
          id,
          access.user.userId,
          operation,
        ),
      ]);
      if (!results[0]!.meta.changes)
        return sharingJson(
          {
            error:
              'Shared Links limit reached. Existing links remain available for review and revocation.',
          },
          409,
        );
      return sharingJson({
        id,
        token,
        revision: 1,
        snapshot: preview.snapshot,
      });
    }
    const results = await env.DB.batch([
      env.DB.prepare(
        'UPDATE dive_share_links SET expires_at=?,revision=revision+1,updated_at=?,selection_json=?,operation_id=? WHERE id=? AND owner_user_id=? AND revision=? AND enabled=1',
      ).bind(
        expiry,
        now,
        JSON.stringify(input),
        operation,
        previous!.id,
        access.user.userId,
        body.revision,
      ),
      env.DB.prepare(
        'UPDATE dive_publications SET enabled=1,snapshot_json=?,photo_id=?,updated_at=? WHERE slot=? AND owner_user_id=? AND EXISTS(SELECT 1 FROM dive_share_links WHERE id=? AND owner_user_id=? AND operation_id=?)',
      ).bind(
        JSON.stringify(preview.snapshot),
        input.profile?.photoId ?? null,
        now,
        'share:' + previous!.id,
        access.user.userId,
        previous!.id,
        access.user.userId,
        operation,
      ),
    ]);
    if (!results[0]!.meta.changes)
      return sharingJson({ error: 'This link changed. Reopen it.' }, 409);
    return sharingJson({
      id: previous!.id,
      enabled: true,
      revision: previous!.revision + 1,
      snapshot: preview.snapshot,
    });
  } catch {
    return sharingJson(
      {
        error:
          'Sharing change could not be completed. Reopen its recorded status before retrying. Private records have not changed.',
      },
      503,
    );
  }
}
