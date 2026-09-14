import {
  listEquipment,
  listRecords,
  removeRecord,
  saveEquipment,
  saveRecord,
  type EquipmentRecord,
  type Stored,
} from './dive-planning';
import { nextServiceDateFromBaseline } from './equipment-usage';

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
  createdAt: string;
  modifiedAt: string;
}

export type EquipmentEventInput = Omit<EquipmentEventRecord, 'createdAt' | 'modifiedAt'> & {
  entityId?: string;
};

export const listEquipmentEvents = () => listRecords<EquipmentEventRecord>('equipment-event');
export const saveEquipmentEvent = (input: EquipmentEventInput) => saveRecord('equipment-event', input);
export const deleteEquipmentEvent = removeRecord;

export function editableEquipmentEvent(record: Stored<EquipmentEventRecord>): EquipmentEventInput {
  const { entityId, createdAt: _createdAt, modifiedAt: _modifiedAt, ...editable } = record;
  return { entityId, ...editable };
}

export function equipmentEventsFor(
  events: Array<Stored<EquipmentEventRecord>>,
  equipmentId: string,
) {
  return events
    .filter((event) => event.equipmentId === equipmentId)
    .sort((left, right) =>
      (right.occurredAt || right.createdAt).localeCompare(left.occurredAt || left.createdAt)
      || right.createdAt.localeCompare(left.createdAt),
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
  return saveEquipmentEvent({
    ...editableEquipmentEvent(event),
    status: 'resolved',
    resolvedAt,
    resolutionNotes: resolutionNotes.trim(),
  });
}

/**
 * Explicitly updates the existing scheduled-service baseline after a real service event.
 * Merely logging a note/repair/fault never changes Equipment servicing dates.
 */
export async function updateEquipmentServiceBaseline(
  equipmentId: string,
  servicedAt: string,
) {
  const equipment = (await listEquipment()).find((item) => item.entityId === equipmentId);
  if (!equipment) throw new Error('Equipment item is unavailable.');
  const { createdAt: _createdAt, modifiedAt: _modifiedAt, ...editable } = equipment;
  const nextServiceAt = nextServiceDateFromBaseline(equipment, servicedAt);
  return saveEquipment({
    ...editable,
    serviceRequired: true,
    lastServiceAt: servicedAt,
    nextServiceAt,
  });
}

export function equipmentEventSummary(event: EquipmentEventRecord) {
  return [
    event.eventType.replace('-', ' '),
    event.status,
    event.serviceProvider,
  ].filter(Boolean).join(' · ');
}
