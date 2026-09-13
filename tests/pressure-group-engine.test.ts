import { describe, expect, it } from 'vitest';
import {
  calculateDivePressureGroupProfile,
  calculatePostDivePressureGroup,
  calculateSurfaceIntervalPressureGroup,
  verifyManualPressureGroup,
} from '../lib/pressure-group-engine';

describe('pressure group engine', () => {
  it('rounds depth and time upward using the attached PADI reference', () => {
    const result = calculatePostDivePressureGroup(17, 22);
    expect(result.roundedDepthFt).toBe(60);
    expect(result.roundedTimeMin).toBe(23);
    expect(result.pressureGroup).toBe('H');
  });

  it('matches the supplied walkthrough first-dive example', () => {
    const result = calculatePostDivePressureGroup(53 / 3.28084, 36);
    expect(result.roundedDepthFt).toBe(60);
    expect(result.roundedTimeMin).toBe(37);
    expect(result.preDivePressureGroup).toBe('A');
    expect(result.residualNitrogenTimeMin).toBe(0);
    expect(result.pressureGroup).toBe('O');
  });

  it('calculates surface credit, RNT, adjusted NDL and ending group', () => {
    expect(calculateSurfaceIntervalPressureGroup('O', 70).pressureGroup).toBe('D');
    const result = calculateDivePressureGroupProfile({
      depthM: 44 / 3.28084,
      bottomTimeMin: 45,
      previousPostDiveGroup: 'O',
      surfaceIntervalMin: 70,
    });
    expect(result.roundedDepthFt).toBe(50);
    expect(result.preDivePressureGroup).toBe('D');
    expect(result.residualNitrogenTimeMin).toBe(19);
    expect(result.adjustedNoDecompressionLimitMin).toBe(61);
    expect(result.totalBottomTimeMin).toBe(64);
    expect(result.roundedTimeMin).toBe(67);
    expect(result.pressureGroup).toBe('U');
  });

  it('uses the corrected continuous Q surface-interval range', () => {
    expect(calculateSurfaceIntervalPressureGroup('Q', 10).pressureGroup).toBe('O');
  });

  it('flags profiles beyond the adjusted NDL', () => {
    expect(calculatePostDivePressureGroup(40, 9).validation).toBe(
      'NO_DECOMPRESSION_LIMIT_EXCEEDED',
    );
  });

  it('distinguishes matching, conservative and unsafe manual groups', () => {
    expect(verifyManualPressureGroup('E', 'E').validation).toBe('MATCHED');
    expect(verifyManualPressureGroup('F', 'E').validation).toBe(
      'MANUAL_MORE_CONSERVATIVE',
    );
    expect(verifyManualPressureGroup('D', 'E').validation).toBe(
      'VIOLATION_DANGER',
    );
  });
});
