import {
  listEquipment,
  listRecords,
  removeRecord,
  saveEquipment,
  saveRecord,
  type Stored,
} from './dive-planning';
import { nextServiceDateFromBaseline } from './equipment-usage';
import { equipmentDiveCount } from './equipment-usage';
import { listDives } from './dives';

export type EquipmentEventType =
  | 'issue'
  | 'fault'
  | 'damage'
  | 'inspection'
  | 'maintenance'
  | 'service'
  | 'repair'
  | 'resolved'
  | 'note'
  | 'other';

export type EquipmentEventStatus = 'open' | 'monitoring' | 'resolved';

export interface EquipmentEventRecord {
  equipmentId: string;
  eventType: EquipmentEventType;
  title: string;
  description?: string;
  occurredAt: string;
  status: EquipmentEventStatus;
  resolvedAt?: string;
  resolutionNotes?: string;
  serviceProvider?: string;
  cost?: number | null;
  currency?: string;
  serviceBaselineApplied?: boolean;
  createdAt: string;
  modifiedAt: string;
}

export type EquipmentEventInput = Omit<
  EquipmentEventRecord,
  'createdAt' | 'modifiedAt'
> & {
  entityId?: string;
};

export const listEquipmentEvents = () =>
  listRecords<EquipmentEventRecord>('equipment-event');
export function validEquipmentEventDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value <= new Date().toISOString().slice(0, 10)
  );
}

export function saveEquipmentEvent(input: EquipmentEventInput) {
  if (!input.equipmentId || !input.title.trim())
    throw new Error('Equipment and an event title are required.');
  if (!validEquipmentEventDate(input.occurredAt))
    throw new Error('Choose a valid event date, not in the future.');
  if (
    ![
      'issue',
      'fault',
      'damage',
      'inspection',
      'maintenance',
      'service',
      'repair',
      'resolved',
      'note',
      'other',
    ].includes(input.eventType) ||
    !['open', 'monitoring', 'resolved'].includes(input.status)
  )
    throw new Error('Choose a valid event type and status.');
  if (input.cost != null && (!Number.isFinite(input.cost) || input.cost < 0))
    throw new Error('Cost must be a valid non-negative amount.');
  if (
    input.resolvedAt &&
    (!validEquipmentEventDate(input.resolvedAt) ||
      input.resolvedAt < input.occurredAt)
  )
    throw new Error('Resolution cannot predate the event or be in the future.');
  return saveRecord('equipment-event', {
    ...input,
    title: input.title.trim(),
    currency: input.currency?.trim().toUpperCase() || 'GBP',
    ...(!input.entityId ? { serviceBaselineApplied: false } : {}),
  });
}
export const deleteEquipmentEvent = removeRecord;

export function editableEquipmentEvent(
  record: Stored<EquipmentEventRecord>,
): EquipmentEventInput {
  const {
    entityId,
    createdAt: _createdAt,
    modifiedAt: _modifiedAt,
    ...editable
  } = record;
  return { entityId, ...editable };
}

export function equipmentEventsFor(
  events: Array<Stored<EquipmentEventRecord>>,
  equipmentId: string,
) {
  return events
    .filter((event) => event.equipmentId === equipmentId)
    .sort(
      (left, right) =>
        (right.occurredAt || right.createdAt).localeCompare(
          left.occurredAt || left.createdAt,
        ) || right.createdAt.localeCompare(left.createdAt),
    );
}

export function latestEquipmentEvents(
  events: Array<Stored<EquipmentEventRecord>>,
  equipmentId: string,
  limit = 5,
) {
  return equipmentEventsFor(events, equipmentId).slice(0, Math.max(0, limit));
}

export async function resolveEquipmentEvent(
  event: Stored<EquipmentEventRecord>,
  resolvedAt: string,
  resolutionNotes: string,
) {
  const current = (await listEquipmentEvents()).find(
    (item) => item.entityId === event.entityId,
  );
  if (!current) throw new Error('This equipment event is unavailable.');
  return saveEquipmentEvent({
    ...editableEquipmentEvent(current),
    status: 'resolved',
    resolvedAt,
    resolutionNotes: resolutionNotes.trim(),
  });
}

/**
 * Explicitly updates the existing scheduled-service baseline after a real service event.
 * Merely logging a note/repair/fault never changes Equipment servicing dates.
 */
export async function updateEquipmentServiceBaseline(serviceEventId: string) {
  const event = (await listEquipmentEvents()).find(
    (item) => item.entityId === serviceEventId,
  );
  if (
    !event ||
    event.eventType !== 'service' ||
    !validEquipmentEventDate(event.occurredAt)
  )
    throw new Error(
      'A genuine saved Service event is required to update the baseline.',
    );
  if (event.serviceBaselineApplied) return;
  const equipmentId = event.equipmentId;
  const servicedAt = event.occurredAt;
  const equipment = (await listEquipment()).find(
    (item) => item.entityId === equipmentId,
  );
  if (!equipment) throw new Error('Equipment item is unavailable.');
  const {
    createdAt: _createdAt,
    modifiedAt: _modifiedAt,
    ...editable
  } = equipment;
  const nextServiceAt = nextServiceDateFromBaseline(equipment, servicedAt);
  const dives = await listDives();
  await saveEquipment({
    ...editable,
    lastServiceAt: servicedAt,
    nextServiceAt,
    divesAtLastService: equipment.serviceIntervalDives
      ? equipmentDiveCount(equipment, dives, servicedAt)
      : null,
  });
  await saveEquipmentEvent({
    ...editableEquipmentEvent(event),
    serviceBaselineApplied: true,
  });
}

export async function updateEquipmentEventStatus(
  eventId: string,
  status: 'open' | 'monitoring',
) {
  const current = (await listEquipmentEvents()).find(
    (item) => item.entityId === eventId,
  );
  if (!current) throw new Error('This equipment event is unavailable.');
  if (current.status === 'resolved')
    throw new Error('Resolved history cannot be reopened by this control.');
  return saveEquipmentEvent({ ...editableEquipmentEvent(current), status });
}

export function equipmentEventSummary(event: EquipmentEventRecord) {
  return [
    event.eventType.replace('-', ' '),
    event.status,
    event.serviceProvider,
  ]
    .filter(Boolean)
    .join(' · ');
}
