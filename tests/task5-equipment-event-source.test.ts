import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { resolveEquipmentEventSource, includeEquipmentEventSource } from '../lib/equipment-event-source';
import { EquipmentEventSource } from '../components/equipment-maintenance-log';
import * as mutations from '../lib/offline/equipment-events';
import type { EquipmentEventRecord } from '../lib/offline/equipment-events';
import type { Stored } from '../lib/offline/dive-planning';

const event = (entityId: string, equipmentId = 'equipment-a', occurredAt = '2026-10-01'): Stored<EquipmentEventRecord> => ({ entityId, equipmentId, eventType: 'issue', title: `Dummy ${entityId}`, occurredAt, status: 'open', createdAt: `${occurredAt}T00:00:00Z`, modifiedAt: `${occurredAt}T00:00:00Z` });
afterEach(() => vi.restoreAllMocks());

it('resolves exact eventId and verifies its equipment endpoint', () => {
  const target = event('exact');
  expect(resolveEquipmentEventSource([event('other'), target], 'equipment-a', 'exact')).toEqual({ state: 'available', event: target });
});
it('does not select a substitute when the event is unavailable', () => {
  expect(resolveEquipmentEventSource([event('other')], 'equipment-a', 'missing')).toEqual({ state: 'unavailable', event: null });
});
it('does not expose event details for a mismatched equipment endpoint', () => {
  const target = { ...event('exact', 'another-equipment'), description: 'PRIVATE-OTHER-ITEM' };
  expect(resolveEquipmentEventSource([target], 'equipment-a', 'exact')).toEqual({ state: 'mismatched', event: null });
});
it('preserves normal history behaviour without a source event', () => {
  const visible = [event('recent')], source = resolveEquipmentEventSource(visible, 'equipment-a', '');
  expect(source).toEqual({ state: 'none', event: null });
  expect(includeEquipmentEventSource(visible, source)).toEqual(visible);
});
it('keeps the exact older source visible outside both latest five and active filters', () => {
  const target = { ...event('old-source', 'equipment-a', '2025-01-01'), eventType: 'service' as const, status: 'resolved' as const };
  const recent = Array.from({ length: 8 }, (_, index) => event(`recent-${index}`));
  const all = [target, ...recent], latest = mutations.latestEquipmentEvents(all, 'equipment-a', 5);
  const context = resolveEquipmentEventSource(all, 'equipment-a', target.entityId);
  expect(latest).not.toContain(target);
  expect(includeEquipmentEventSource(latest, context)).toEqual([target, ...latest]);
  expect(includeEquipmentEventSource([], context)).toEqual([target]);
  expect(includeEquipmentEventSource([target, ...latest], context).filter(row => row.entityId === target.entityId)).toHaveLength(1);
});
it('projects source visibility without mutating event order or content', () => {
  const all = [event('older', 'equipment-a', '2025-01-01'), event('recent')], original = structuredClone(all);
  const context = resolveEquipmentEventSource(all, 'equipment-a', 'older');
  includeEquipmentEventSource(all.slice(1), context);
  expect(all).toEqual(original);
});
it('renders a clearly labelled, focusable read-only canonical cylinder event without new correction controls', () => {
  const target = { ...event('cylinder-event', 'canonical-cylinder'), eventType: 'service' as const, occurredAt: '2026-02-30', resolvedAt: '2026-02-29' };
  const save = vi.spyOn(mutations, 'saveEquipmentEvent'), resolve = vi.spyOn(mutations, 'resolveEquipmentEvent'), baseline = vi.spyOn(mutations, 'updateEquipmentServiceBaseline');
  const html = renderToStaticMarkup(createElement(EquipmentEventSource, { equipmentId: 'canonical-cylinder', sourceEventId: 'cylinder-event', events: [target], loadState: 'loaded' }));
  expect(html).toContain('Reviewed source event'); expect(html).toContain('Dummy cylinder-event');
  expect(html).toContain('2026-02-30'); expect(html).toContain('2026-02-29');
  expect(html).toContain('tabindex="-1"');
  expect(html).not.toMatch(/<form|<input|<textarea|Report issue|Mark monitoring|Update scheduled-service|Save/);
  expect(save).not.toHaveBeenCalled(); expect(resolve).not.toHaveBeenCalled(); expect(baseline).not.toHaveBeenCalled();
});
it.each(['unavailable', 'mismatched'] as const)('renders %s context without another event details', state => {
  const events = state === 'unavailable' ? [event('other')] : [{ ...event('requested', 'other-equipment'), title: 'PRIVATE-OTHER-EVENT' }];
  const html = renderToStaticMarkup(createElement(EquipmentEventSource, { equipmentId: 'equipment-a', sourceEventId: 'requested', events, loadState: 'loaded' }));
  expect(html).toMatch(/unavailable|does not belong/i); expect(html).not.toContain('PRIVATE-OTHER-EVENT'); expect(html).not.toContain('Dummy other');
});
it('does not assert absence while history is still loading or failed to load', () => {
  for (const loadState of ['loading', 'unavailable'] as const) {
    const html = renderToStaticMarkup(createElement(EquipmentEventSource, { equipmentId: 'equipment-a', sourceEventId: 'requested', events: [], loadState }));
    expect(html).toMatch(/loading|history is unavailable/i);
    expect(html).not.toMatch(/deleted|Dummy/);
  }
});
