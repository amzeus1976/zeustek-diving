import { recordHash } from './canonical';
import { zeustekDb } from './db';
import type { EntityRow, EventRow, JsonValue, Operation } from './types';
import { uuidv7 } from './uuidv7';

export interface AtomicMutationInput {
  entityId?: string;
  module: string;
  entityType: string;
  schemaVersion: number;
  operation: Operation;
  record: JsonValue | null;
  parents?: string[];
  pendingSync?: { key: string; value: JsonValue };
}

export interface AtomicMutationOptions {
  failAfterMutation?: number;
}

/**
 * Applies a related record batch through the same entity/event/head/outbox model as
 * mutateEntity, but within one Dexie transaction. Ordinary single-record writes
 * continue to use mutateEntity.
 */
export async function mutateEntitiesAtomically(
  inputs: AtomicMutationInput[],
  options: AtomicMutationOptions = {},
): Promise<EventRow[]> {
  if (!inputs.length) return [];
  const prepared = await Promise.all(
    inputs.map(async (input) => ({
      input,
      entityId: input.entityId ?? uuidv7(),
      eventId: uuidv7(),
      createdAt: new Date().toISOString(),
      hash: await recordHash(input.record),
    })),
  );
  const entityIds = prepared.map((item) => item.entityId);
  if (new Set(entityIds).size !== entityIds.length)
    throw new Error('An atomic batch cannot mutate the same record twice.');

  return zeustekDb.transaction(
    'rw',
    [
      zeustekDb.entities,
      zeustekDb.events,
      zeustekDb.eventParents,
      zeustekDb.entityHeads,
      zeustekDb.outbox,
      zeustekDb.settings,
      zeustekDb.syncState,
    ],
    async () => {
      const actor = await zeustekDb.settings.get('actorUserId');
      const device = await zeustekDb.settings.get('deviceId');
      const lamportRow = await zeustekDb.syncState.get('lamport');
      let lamport =
        typeof lamportRow?.value === 'number' ? lamportRow.value : 0;
      const events: EventRow[] = [];

      for (let index = 0; index < prepared.length; index += 1) {
        const item = prepared[index]!;
        const input = item.input;
        const existingHeads = await zeustekDb.entityHeads
          .where('entityId')
          .equals(item.entityId)
          .toArray();
        const parents = [
          ...(input.parents ?? existingHeads.map((head) => head.eventId)),
        ].sort();
        lamport += 1;
        const event: EventRow = {
          protocolVersion: 1,
          eventId: item.eventId,
          entityId: item.entityId,
          module: input.module,
          entityType: input.entityType,
          schemaVersion: input.schemaVersion,
          parents,
          actorUserId:
            typeof actor?.value === 'string' ? actor.value : 'local-owner',
          deviceId:
            typeof device?.value === 'string'
              ? device.value
              : 'unprovisioned-device',
          lamport,
          createdAt: item.createdAt,
          operation: input.operation,
          record: input.record,
          recordHash: item.hash,
        };
        const projection: EntityRow = {
          entityId: item.entityId,
          module: input.module,
          entityType: input.entityType,
          schemaVersion: input.schemaVersion,
          record: input.record,
          recordHash: item.hash,
          deleted: input.record === null ? 1 : 0,
          updatedEventId: item.eventId,
          updatedAt: item.createdAt,
        };

        await zeustekDb.entities.put(projection);
        await zeustekDb.events.add(event);
        if (parents.length)
          await zeustekDb.eventParents.bulkAdd(
            parents.map((parentEventId) => ({
              eventId: item.eventId,
              parentEventId,
            })),
          );
        if (parents.length)
          await zeustekDb.entityHeads.bulkDelete(
            parents.map(
              (parentEventId) =>
                [item.entityId, parentEventId] as [string, string],
            ),
          );
        await zeustekDb.entityHeads.add({
          entityId: item.entityId,
          eventId: item.eventId,
        });
        await zeustekDb.outbox.add({
          objectId: item.eventId,
          objectKind: 'event',
          createdAt: item.createdAt,
          attemptCount: 0,
          nextAttemptAt: 0,
          state: 'pending',
        });
        if (input.pendingSync) await zeustekDb.settings.put(input.pendingSync);
        events.push(event);
        if (options.failAfterMutation === index + 1)
          throw new Error(
            `Injected atomic mutation failure after ${index + 1} mutation(s).`,
          );
      }

      await zeustekDb.syncState.put({ key: 'lamport', value: lamport });
      return events;
    },
  );
}
