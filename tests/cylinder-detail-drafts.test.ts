import {describe, expect, it} from 'vitest';
import {hasUnsavedCylinderDetailDraft} from '../lib/cylinders/detail-draft';

const saved = {
  profile: {name: 'Existing'},
  fill: {pressureBar: ''},
  usage: {remainingPressureBar: ''},
  analysis: {oxygenPercent: ''},
};

describe('cylinder detail section saves', () => {
  it('clears the warning when the edited fill has been saved', () => {
    const current = {...saved, fill: {pressureBar: '230'}};
    expect(hasUnsavedCylinderDetailDraft(current, saved)).toBe(true);
    expect(hasUnsavedCylinderDetailDraft(current, {...saved, fill: current.fill})).toBe(false);
  });

  it('keeps warning for a different unsaved section after a fill save', () => {
    const current = {...saved, fill: {pressureBar: '230'}, analysis: {oxygenPercent: '21'}};
    expect(hasUnsavedCylinderDetailDraft(current, {...saved, fill: current.fill})).toBe(true);
  });

  it('does not warn for untouched default timestamps or linked fill selection', () => {
    const current = {...saved, fill: {pressureBar: '', filledAt: '2026-09-25T16:00'}, analysis: {oxygenPercent: '', fillId: 'fill-2'}};
    expect(hasUnsavedCylinderDetailDraft(current, current)).toBe(false);
  });
});
