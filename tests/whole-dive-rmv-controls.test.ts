import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WholeDiveRmvControls } from '../components/logbook/whole-dive-rmv-controls';
import type { DiveCylinder } from '../lib/offline/dives';

const cylinders = [
  {id: 'a', name: 'Back gas left', configuration: 'Sidemount', gasType: 'Air', oxygenPercent: 21, heliumPercent: 0, material: 'Steel', size: '', internalVolumeLiters: 12, startPressureBar: 200, endPressureBar: 100, switchDepthM: null, switchRuntimeMin: null},
  {id: 'b', name: 'Back gas right', configuration: 'Sidemount', gasType: 'Air', oxygenPercent: 21, heliumPercent: 0, material: 'Steel', size: '', internalVolumeLiters: 7, startPressureBar: 180, endPressureBar: 80, switchDepthM: null, switchRuntimeMin: null},
] as DiveCylinder[];

function render(rows: DiveCylinder[], rmvRate: number | null = null) {
  return renderToStaticMarkup(createElement(WholeDiveRmvControls, {
    cylinders: rows, averageDepthM: 20, elapsedMinutes: 40, rmvRate, rmvEstimate: null,
    onParticipationChange: () => {}, onApply: () => {}, onManualChange: () => {},
  }));
}

describe('whole-dive RMV editor', () => {
  it('requires explicit cylinder participation for legacy rows', () => {
    const html = render(cylinders);
    expect(html).toContain('Not reviewed');
    expect(html).toContain('Review every cylinder');
    expect(html).toContain('disabled');
  });

  it('labels a multi-cylinder result as a whole-dive estimate, separate from SAC', () => {
    const html = render(cylinders.map(cylinder => ({...cylinder, wholeDiveRmvParticipation: 'used'})));
    expect(html).toContain('Whole-dive RMV estimate');
    expect(html).toContain('15.83');
    expect(html).toContain('1,900 L');
    expect(html).toContain('Apply estimate');
    expect(html).toContain('not per-cylinder SAC');
    expect(html).toContain('step="any"');
  });

  it('does not offer to replace a manual Dive value', () => {
    const html = render(cylinders.map(cylinder => ({...cylinder, wholeDiveRmvParticipation: 'used'})), 18);
    expect(html).toContain('manual or legacy value is preserved');
    expect(html).toContain('disabled');
  });
});
