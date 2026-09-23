import { describe, it, expect } from 'vitest';
import {
  updateRouteLeg,
  newRouteLeg,
} from '../lib/gas-allocation/route-editor';
describe('T14 checkpoint continuity', () => {
  it('carries the preceding end depth into a new checkpoint without choosing a gas switch', () => {
    const next = newRouteLeg(
      [
        {
          id: 'a',
          label: 'A',
          startDepthM: 10,
          endDepthM: 18,
          depthM: null,
          minutes: null,
        },
      ],
      'b',
    );
    expect(next.startDepthM).toBe(18);
    expect(next.cylinderId).toBeNull();
    expect(next.stressFactor).toBe(1);
  });
  it('updates the next start depth when an interval end changes, and replaces rather than compounds stress', () => {
    const legs = [
      {
        id: 'a',
        label: 'A',
        startDepthM: 10,
        endDepthM: 18,
        depthM: null,
        minutes: null,
        stressFactor: 1.5,
      },
      {
        id: 'b',
        label: 'B',
        startDepthM: 18,
        endDepthM: 6,
        depthM: null,
        minutes: null,
      },
    ];
    const changed = updateRouteLeg(legs, 'a', {
      endDepthM: 16,
      stressFactor: 1.2,
    });
    expect(changed[1]?.startDepthM).toBe(16);
    expect(changed[0]?.stressFactor).toBe(1.2);
    expect(changed[0]?.averageDepthM).toBe(13);
    expect(legs[1]?.startDepthM).toBe(18);
  });
});
