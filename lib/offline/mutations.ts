import { recordHash } from './canonical';
import { zeustekDb } from './db';
import type { EntityRow, EventRow, JsonValue, Operation } from './types';
import { uuidv7 } from './uuidv7';

async function settingString(key: string, fallback: string): Promise<string> {
  const row = await zeustekDb.settings.get(key);
  return typeof row?.value === 'string' ? row.value : fallback;
}

async function nextLamport(): Promise<number> {
  const row = await zeustekDb.syncState.get('lamport');
  const local = typeof row?.value === 'number' ? row.value : 0;
  const next = local + 1;
  await zeustekDb.syncState.put({ key: 'lamport', value: next });
  return next;
}

export async function mutateEntity(input: {
  entityId?: string;
  module: string;
  entityType: string;
  schemaVersion: number;
  operation: Operation;
  record: JsonValue | null;
  parents?: string[];
  pendingSync?: { key: string; value: JsonValue };
}): Promise<EventRow> {
  const entityId = input.entityId ?? uuidv7();
  const eventId = uuidv7();
  const createdAt = new Date().toISOString();
  const hash = await recordHash(input.record);
  let parents: string[] = [];
  const event: EventRow = {
    protocolVersion: 1,
    eventId,
    entityId,
    module: input.module,
    entityType: input.entityType,
    schemaVersion: input.schemaVersion,
    parents,
    actorUserId: await settingString('actorUserId', 'local-owner'),
    deviceId: await settingString('deviceId', 'unprovisioned-device'),
    lamport: 0,
    createdAt,
    operation: input.operation,
    record: input.record,
    recordHash: hash,
  };
  const projection: EntityRow = {
    entityId,
    module: input.module,
    entityType: input.entityType,
    schemaVersion: input.schemaVersion,
    record: input.record,
    recordHash: hash,
    deleted: input.record === null ? 1 : 0,
    updatedEventId: eventId,
    updatedAt: createdAt,
  };

  await zeustekDb.transaction(
    'rw',
    [zeustekDb.entities,
    zeustekDb.events,
    zeustekDb.eventParents,
    zeustekDb.entityHeads,
    zeustekDb.outbox,
    zeustekDb.settings, zeustekDb.syncState],
    async () => {
      const existingHeads = await zeustekDb.entityHeads.where('entityId').equals(entityId).toArray();
      parents = [...(input.parents ?? existingHeads.map(head => head.eventId))].sort();
      event.parents = parents;
      event.lamport = await nextLamport();
      await zeustekDb.entities.put(projection);
      await zeustekDb.events.add(event);
      if (parents.length) await zeustekDb.eventParents.bulkAdd(parents.map((parentEventId) => ({ eventId, parentEventId })));
      if (parents.length) await zeustekDb.entityHeads.bulkDelete(parents.map((parentEventId) => [entityId, parentEventId]));
      await zeustekDb.entityHeads.add({ entityId, eventId });
      await zeustekDb.outbox.add({
        objectId: eventId,
        objectKind: 'event',
        createdAt,
        attemptCount: 0,
        nextAttemptAt: 0,
        state: 'pending',
      });
      if (input.pendingSync) await zeustekDb.settings.put(input.pendingSync);
    },
  );
  return event;
}
