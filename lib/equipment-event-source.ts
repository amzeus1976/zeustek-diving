import type { EquipmentEventRecord } from './offline/equipment-events';
import type { Stored } from './offline/dive-planning';

export type EquipmentEventSourceContext =
  | { state: 'available'; event: Stored<EquipmentEventRecord> }
  | { state: 'none' | 'unavailable' | 'mismatched'; event: null };

/** Match both the canonical event and parent identity. Never expose a different item's event. */
export function resolveEquipmentEventSource(events: ReadonlyArray<Stored<EquipmentEventRecord>>, equipmentId: string, sourceEventId: string): EquipmentEventSourceContext {
  if (!sourceEventId) return { state: 'none', event: null };
  const event = events.find(row => row.entityId === sourceEventId);
  if (!equipmentId || !event) return { state: 'unavailable', event: null };
  if (event.equipmentId !== equipmentId) return { state: 'mismatched', event: null };
  return { state: 'available', event };
}

/** The explicitly selected source stays visible independently of ordinary filters and history limits. */
export function includeEquipmentEventSource(visible: ReadonlyArray<Stored<EquipmentEventRecord>>, source: EquipmentEventSourceContext) {
  return source.state === 'available' ? [source.event, ...visible.filter(row => row.entityId !== source.event.entityId)] : [...visible];
}
