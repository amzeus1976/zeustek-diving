import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RecreationalGasPlanner } from '../components/planning/recreational-gas-planner';
import { buildRecreationalGasSnapshot, type RecreationalGasInput } from '../lib/offline/recreational-gas-planner';

const input: RecreationalGasInput = {
  mode: 'wreck-route', selectedBuhlmannModel: 'ZH-L16C', compareOtherModel: true,
  gfLow: 40, gfHigh: 85, waterType: 'salt', surfacePressureBar: 1,
  plannedDepthM: 24, conservatismM: 3, maxPpo2: 1.4, selectedGasLabel: 'EAN32',
  cylinderWaterVolumeL: 12, startPressureBar: 200, cylinderSourceMode: 'rental',
  cylinderSourceId: null, cylinderSourceLabel: 'Boat AL80', pressureSource: 'rental snapshot start pressure',
  fillProvenance: ['Day boat operator'], analysisProvenance: 'Analysed by operator',
  ownRmvLMin: 18, buddyRmvLMin: null, ownRmvSource: 'profile-average', buddyRmvSource: 'owner-fallback',
  reserveStrategy: 'most-conservative', ascentRateMMin: 9, ownerMaxDurationMin: 45,
  plannedWorkingTimeMin: 15,
  routeSegments: [{ id: 'turn', label: 'Turn point', checkpointKind: 'turn', startDepthM: 18, endDepthM: 24,
    averageDepthM: 21, durationMin: 5, depthM: null, minutes: null, cylinderId: 'rental-primary',
    stressFactor: 1.25, buddySharing: false, directAscentPossible: false, notes: 'Wreck route.' }],
};

const renderPlanner = () => {
  const snapshot = buildRecreationalGasSnapshot(input, '2026-09-21T12:00:00.000Z');
  return renderToStaticMarkup(createElement(RecreationalGasPlanner, { input, snapshot, error: null, change: () => undefined }));
};

describe('T12.6R planner interface', () => {
  it('renders the complete recreational limit, engine, source and readiness summary', () => {
    const html = renderPlanner();
    for (const label of ['Planned depth', 'Gas mix', 'MOD', 'PPO₂ at planned depth', 'PPO₂ at conservative depth',
      'NDL at planned depth', 'Gas-limited time', 'Reserve requirement', 'Owner max duration', 'Planned working time',
      'Limiting factor', 'Readiness', 'Engine version', 'Rested tissue assumption', 'Cylinder source', 'Pressure source']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('No backup table configured.');
    expect(html).toContain('Selected gas is lower O₂ than');
  });

  it('renders complete route segment controls and gas/pressure checkpoints', () => {
    const html = renderPlanner();
    for (const label of ['Checkpoint type', 'Start depth', 'End depth', 'Average depth', 'Duration', 'Cylinder / gas',
      'Stress factor', 'Buddy sharing', 'Direct ascent possible', 'Route notes', 'Required pressure', 'Expected pressure']) {
      expect(html).toContain(label);
    }
  });
});
