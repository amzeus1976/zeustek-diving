import { zeustekDb } from './db';
import { mutateEntity } from './mutations';
import type { NoteRecord } from './types';

function isNote(value: unknown): value is NoteRecord {
  if (!value || typeof value !== 'object') return false;
  const note = value as Partial<NoteRecord>;
  return typeof note.title === 'string' && typeof note.body === 'string' && Array.isArray(note.tags);
}

export async function listNotes(): Promise<Array<NoteRecord & { entityId: string; deleted: boolean }>> {
  const rows = await zeustekDb.entities.where('[module+entityType]').equals(['notes', 'note']).reverse().sortBy('updatedAt');
  return rows.flatMap((row) => {
    const record = row.record;
    return isNote(record) ? [{ title: record.title, body: record.body, tags: record.tags, pinned: record.pinned, attachments: record.attachments, createdAt: record.createdAt, modifiedAt: record.modifiedAt, entityId: row.entityId, deleted: row.deleted === 1 }] : [];
  });
}

export async function saveNote(input: { entityId?: string; title: string; body: string; tags?: string[] }) {
  const now = new Date().toISOString();
  const existing = input.entityId ? await zeustekDb.entities.get(input.entityId) : undefined;
  const previous = existing?.record && isNote(existing.record) ? existing.record : null;
  const record: NoteRecord = {
    title: input.title.trim().slice(0, 200) || 'Untitled note',
    body: input.body.slice(0, 100000),
    tags: [...new Set(input.tags ?? [])],
    pinned: previous?.pinned ?? false,
    attachments: previous?.attachments ?? [],
    createdAt: previous?.createdAt ?? now,
    modifiedAt: now,
  };
  return mutateEntity({ ...(input.entityId ? { entityId: input.entityId } : {}), module: 'notes', entityType: 'note', schemaVersion: 1, operation: existing ? 'update' : 'create', record: record as unknown as import('./types').JsonValue });
}

export async function deleteNote(entityId: string) {
  return mutateEntity({ entityId, module: 'notes', entityType: 'note', schemaVersion: 1, operation: 'delete', record: null });
}
