import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveRelationshipSourceContext } from '../lib/operators/relationship-source-context';
import { RelationshipSourceContextCard } from '../components/people/relationship-source-context';
import { PersonEntityRelationships } from '../components/people/person-entity-relationships';
import { EntityRelationships } from '../components/dive-centres/entity-relationships';
import * as records from '../lib/offline/dive-planning';
import type { PersonEntityLink, EntityRelation } from '../lib/operators/entity-relationships';
import { normaliseEntityRelation } from '../lib/operators/entity-relationships';

const person = (entityId: string, name: string): records.Stored<records.PersonRecord> => ({ entityId, name, role: 'buddy', agency: '', highestQualification: '', membershipNumber: '', email: '', phone: '', emergencyContact: '', notes: 'PRIVATE-PERSON-NOTES', createdAt: '', modifiedAt: '' });
const operator = (entityId: string, name: string): records.Stored<records.OperatorRecord> => ({ entityId, name, location: '', website: '', notes: 'PRIVATE-ENTITY-NOTES', createdAt: '', modifiedAt: '' });
const people = [person('person-a', 'Dummy Person A'), person('person-b', 'Dummy Person B')];
const operators = [operator('entity-a', 'Dummy Entity A'), operator('entity-b', 'Dummy Entity B'), operator('entity-c', 'Dummy Entity C')];
const affiliation: PersonEntityLink = { entityId: 'affiliation-a', personId: 'person-a', operatorId: 'entity-b', role: 'Instructor', active: true, startDate: '2025-01-01', endDate: '2025-12-31', notes: 'PRIVATE-LINK-NOTES' };
const relationship: EntityRelation = { entityId: 'relationship-a', fromOperatorId: 'entity-a', toOperatorId: 'entity-b', relationType: 'operates', active: true, notes: 'PRIVATE-RELATIONSHIP-NOTES' };
const source = { people, operators, personLinks: [affiliation], entityLinks: [relationship] };
const resolve = (kind: 'person-operator-link' | 'operator-operator-link', relationshipId: string, endpointId: string, data = source) => resolveRelationshipSourceContext({ kind, relationshipId, endpointId }, data, '2026-10-02');
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('exact relationship source navigation', () => {
  it('identifies the requested affiliation and retains its historical status', () => {
    const result = resolve('person-operator-link', 'affiliation-a', 'person-a');
    expect(result).toMatchObject({ state: 'available', relationshipId: 'affiliation-a', sourceId: 'person-a', canManage: true, label: 'Instructor', status: 'Ended', startDate: '2025-01-01', endDate: '2025-12-31' });
    expect(result?.endpoints).toEqual([
      { route: 'People', id: 'person-a', label: 'Dummy Person A', available: true },
      { route: 'Dive Centres', id: 'entity-b', label: 'Dummy Entity B', available: true },
    ]);
    expect(JSON.stringify(result)).not.toContain('PRIVATE-');
  });

  it('does not substitute another affiliation when the exact relationship is unavailable', () => {
    const result = resolve('person-operator-link', 'missing-affiliation', 'person-a');
    expect(result).toMatchObject({ state: 'missing-source', relationshipId: 'missing-affiliation', canManage: false, endpoints: [] });
    expect(result?.message).toMatch(/unavailable on this device/i);
    expect(result?.message).not.toMatch(/deleted|repaired/i);
  });

  it('rejects a mismatched Person instead of selecting the relationship Person automatically', () => {
    const result = resolve('person-operator-link', 'affiliation-a', 'person-b');
    expect(result).toMatchObject({ state: 'mismatched-source', sourceId: 'person-b', canManage: false });
  });

  it('shows a retained affiliation with an unavailable Person without selecting an available Person', () => {
    const result = resolve('person-operator-link', 'affiliation-a', 'person-a', { ...source, people: [people[1]!] });
    expect(result).toMatchObject({ state: 'unavailable-endpoint', sourceId: 'person-a', canManage: false });
    expect(result?.endpoints[0]).toMatchObject({ id: 'person-a', available: false });
  });

  it('allows the existing Person relationship editor only when its source Person is available', () => {
    const result = resolve('person-operator-link', 'affiliation-a', 'person-a', { ...source, operators: [operators[0]!] });
    expect(result).toMatchObject({ state: 'unavailable-endpoint', sourceId: 'person-a', canManage: true });
    expect(result?.endpoints[1]).toMatchObject({ id: 'entity-b', available: false });
  });

  it('keeps Person affiliations separate from entity-to-entity relationship IDs', () => {
    expect(resolve('person-operator-link', 'relationship-a', 'person-a')).toMatchObject({ state: 'missing-source', canManage: false });
    expect(resolve('operator-operator-link', 'affiliation-a', 'entity-b')).toMatchObject({ state: 'missing-source', canManage: false });
  });

  it('reads both canonical operator endpoints and the direction from the explicitly requested entity', () => {
    const from = resolve('operator-operator-link', 'relationship-a', 'entity-a');
    const to = resolve('operator-operator-link', 'relationship-a', 'entity-b');
    expect(from).toMatchObject({ state: 'available', sourceId: 'entity-a', canManage: true, label: 'operates' });
    expect(to).toMatchObject({ state: 'available', sourceId: 'entity-b', canManage: true, label: 'operated by' });
    expect(from?.endpoints.map(endpoint => endpoint.id)).toEqual(['entity-a', 'entity-b']);
  });

  it('retains reversed date evidence in source context without validating it as a new save', () => {
    const retained = { ...relationship, startDate: '2026-10-10', endDate: '2026-10-09' };
    const result = resolve('operator-operator-link', retained.entityId!, 'entity-b', { ...source, entityLinks: [retained] });
    expect(result).toMatchObject({ state: 'available', canManage: true, label: 'operated by', startDate: '2026-10-10', endDate: '2026-10-09' });
    expect(() => normaliseEntityRelation(retained)).toThrow('End date must follow the start date.');
    expect(retained).toMatchObject({ startDate: '2026-10-10', endDate: '2026-10-09' });
  });

  it('does not choose the other available entity when the requested source endpoint is absent', () => {
    const result = resolve('operator-operator-link', 'relationship-a', 'entity-a', { ...source, operators: operators.filter(row => row.entityId !== 'entity-a') });
    expect(result).toMatchObject({ state: 'unavailable-endpoint', sourceId: 'entity-a', canManage: false });
    expect(result?.endpoints.map(endpoint => endpoint.available)).toEqual([false, true]);
  });

  it('rejects an unrelated operator while retaining the exact relationship for read-only review', () => {
    expect(resolve('operator-operator-link', 'relationship-a', 'entity-c')).toMatchObject({ state: 'mismatched-source', sourceId: 'entity-c', canManage: false });
  });

  it('does not invent context for a normal profile link without relationshipId', () => {
    expect(resolve('person-operator-link', '', 'person-a')).toBeNull();
  });

  it('does not query providers, mutate endpoints or repair the relationship when resolving context', () => {
    const before = structuredClone(source), provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    expect(resolve('person-operator-link', 'affiliation-a', 'person-a')).toEqual(resolve('person-operator-link', 'affiliation-a', 'person-a'));
    expect(source).toEqual(before);
    expect(provider).not.toHaveBeenCalled();
  });
});

describe('read-only source context and existing correction editors', () => {
  it('renders source endpoints and dates without copying private notes or adding repair controls', () => {
    const context = resolve('person-operator-link', 'affiliation-a', 'person-a')!;
    const html = renderToStaticMarkup(createElement(RelationshipSourceContextCard, { context }));
    expect(html).toContain('Linked affiliation');
    expect(html).toContain('Dummy Person A'); expect(html).toContain('Dummy Entity B');
    expect(html).toContain('2025-12-31'); expect(html).toContain('Ended');
    expect(html).toContain('personId=person-a'); expect(html).toContain('operatorId=entity-b');
    expect(html).not.toMatch(/PRIVATE-|<form|<input|<textarea|Unlink|Delete|Save relationships/);
  });

  it('renders an unavailable exact relationship without presenting another relationship as selected', () => {
    const html = renderToStaticMarkup(createElement(RelationshipSourceContextCard, { context: resolve('operator-operator-link', 'missing', 'entity-a')! }));
    expect(html).toMatch(/unavailable on this device/i);
    expect(html).not.toContain('Dummy Entity');
  });

  it('marks the exact affiliation inside the ordinary editor without saving or unlinking on open', () => {
    const save = vi.spyOn(records, 'savePersonEntityLink'), remove = vi.spyOn(records, 'deletePersonEntityLink');
    const other = { ...affiliation, entityId: 'affiliation-other', operatorId: 'entity-a' };
    const html = renderToStaticMarkup(createElement(PersonEntityRelationships, { person: people[0]!, operators, links: [other, affiliation], sourceRelationshipId: 'affiliation-a', close: () => {}, onSaved: () => {}, go: () => {} }));
    expect(html).toContain('data-relationship-id="affiliation-a" data-requested-source="true"');
    expect(html).toContain('data-relationship-id="affiliation-other" data-requested-source="false"');
    expect(html).toContain('Save relationships');
    expect(save).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  });

  it('keeps an unavailable saved entity selected in the ordinary relationship editor', () => {
    const save = vi.spyOn(records, 'saveEntityRelation'), remove = vi.spyOn(records, 'deleteEntityRelation');
    const html = renderToStaticMarkup(createElement(EntityRelationships, { entity: operators[0]!, operators: [operators[0]!, operators[2]!], links: [relationship], sourceRelationshipId: 'relationship-a', close: () => {}, onSaved: () => {}, go: () => {} }));
    expect(html).toContain('data-relationship-id="relationship-a" data-requested-source="true"');
    expect(html).toContain('<option value="entity-b" selected="">Unavailable saved entity</option>');
    expect(html).toContain('Save relationships');
    expect(save).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  });

  it('opens retained reversed date evidence for correction without normalising it before Save', () => {
    const retained = { ...relationship, startDate: '2026-10-10', endDate: '2026-10-09' };
    const save = vi.spyOn(records, 'saveEntityRelation');
    const html = renderToStaticMarkup(createElement(EntityRelationships, { entity: operators[1]!, operators, links: [retained], sourceRelationshipId: retained.entityId, close: () => {}, onSaved: () => {}, go: () => {} }));
    expect(html).toContain('value="2026-10-10"'); expect(html).toContain('value="2026-10-09"');
    expect(html).toContain('data-requested-source="true"');
    expect(html).toContain('selected="">operated by</option>');
    expect(html).toContain('Save relationships'); expect(save).not.toHaveBeenCalled();
    expect(retained).toMatchObject({ startDate: '2026-10-10', endDate: '2026-10-09' });
    expect(() => normaliseEntityRelation(retained)).toThrow('End date must follow the start date.');
  });
});
