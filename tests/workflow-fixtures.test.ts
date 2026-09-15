import { describe, expect, it } from 'vitest';
import { candidateFromRecord, fixtureTitle } from '../lib/workflow/synthetic-fixtures';

describe('T10.5 acceptance fixture review', () => {
  it('surfaces a clearly labelled fixture with its existing identity', () => {
    expect(candidateFromRecord('trip', {
      entityId: 'plan-acceptance', name: 'T10 PRODUCTION ACCEPTANCE ONLY', modifiedAt: '2026-09-14T10:00:00.000Z',
    })).toEqual({
      kind: 'trip', entityId: 'plan-acceptance', title: 'T10 PRODUCTION ACCEPTANCE ONLY',
      reason: 'PRODUCTION ACCEPTANCE ONLY', modifiedAt: '2026-09-14T10:00:00.000Z',
    });
  });

  it('never offers an ordinary owner record or an unidentified record', () => {
    expect(candidateFromRecord('dive-trip', { entityId: 'real-trip', name: 'Scapa Flow 2027' })).toBeNull();
    expect(candidateFromRecord('trip', { name: 'T10 PRODUCTION ACCEPTANCE ONLY' })).toBeNull();
  });

  it('uses existing labels without inventing a copied identity', () => {
    expect(fixtureTitle({ label: 'Acceptance fixture', entityId: 'fixture-1' })).toBe('Acceptance fixture');
  });
});
