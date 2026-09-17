import { describe, expect, it } from 'vitest';
import {
  ambientAta,
  bestOxygenFraction,
  conservativeOxygenFraction,
  equivalentAirDepth,
  gasRequiredForSegments,
  gasRequiredLitres,
  gasVolumeLitres,
  lookupNdl,
  maximumOperatingDepth,
  NDL_UNCONFIGURED,
  nitrogenFraction,
  oxygenPartialPressure,
} from '../lib/offline/gas-planning-foundation';
import { projectGasCylinder } from '../lib/offline/planning-pages';
import { assessPlanSiteAndTeam } from '../lib/offline/dive-planning-centre';

const ean32 = { oxygenFraction: 0.32, heliumFraction: 0 };

describe('T12.5 research formula golden cases', () => {
  it('uses the metric seawater ambient-pressure approximation', () => {
    expect(ambientAta(30)).toBe(4);
    expect(ambientAta(10)).toBe(2);
    expect(ambientAta(-1)).toBeNull();
  });
  it('calculates PPO2 and MOD without rounding internal values', () => {
    expect(oxygenPartialPressure(ean32, 30)).toBeCloseTo(1.28, 8);
    expect(oxygenPartialPressure({ oxygenFraction: 0.21, heliumFraction: 0 }, 40)).toBeCloseTo(1.05, 8);
    expect(maximumOperatingDepth(ean32, 1.4)).toBeCloseTo(33.75, 8);
    expect(maximumOperatingDepth({ oxygenFraction: 0.36, heliumFraction: 0 }, 1.4)).toBeCloseTo(28.8888888889, 8);
  });
  it('calculates best/conservative oxygen fractions', () => {
    expect(bestOxygenFraction(30, 1.4)).toBeCloseTo(0.35, 8);
    expect(conservativeOxygenFraction(30, 3, 1.4)).toBeCloseTo(0.3255813953, 8);
  });
  it('uses FN2/0.79 for EAD, not FO2/0.21', () => {
    expect(nitrogenFraction(ean32)).toBeCloseTo(0.68, 8);
    expect(equivalentAirDepth(ean32, 30)).toBeCloseTo(24.4303797468, 8);
    expect(equivalentAirDepth({ oxygenFraction: 0.21, heliumFraction: 0 }, 30)).toBeCloseTo(30, 8);
  });
  it('calculates gas required and available from valid evidence only', () => {
    expect(gasRequiredLitres(22, 30, 30)).toBe(2640);
    expect(gasRequiredLitres(30, 20, 40)).toBe(3600);
    expect(gasVolumeLitres(12, 232, 50)).toEqual({ usablePressureBar: 182, usableLitres: 2184, reserveLitres: 600 });
    expect(gasVolumeLitres(15, 232, 50)?.usableLitres).toBe(2730);
    expect(gasVolumeLitres(15, 232, 50)?.reserveLitres).toBe(750);
    expect(gasVolumeLitres(12, 50, 60)).toBeNull();
    expect(gasRequiredForSegments(22, [{ id: 'a', depthM: 30, minutes: 10 }, { id: 'b', depthM: 20, minutes: 20 }])).toBe(2200);
    expect(gasRequiredForSegments(22, [{ id: 'a', depthM: null, minutes: 10 }])).toBeNull();
  });
  it('does not invent agency NDL values', () => {
    expect(lookupNdl(null, 30, ean32)).toEqual({ state: 'unconfigured', message: NDL_UNCONFIGURED });
  });
});

describe('T12.5 provenance and compatibility', () => {
  const fill = { entityId: 'fill-new', cylinderEquipmentId: 'cylinder-1', filledAt: '2026-09-17T10:00:00Z', pressureBar: 232, oxygenFraction: 0.32, heliumFraction: 0, provider: null, notes: null, source: 'recorded' as const, createdAt: '', modifiedAt: '' };
  const previousAnalysis = { entityId: 'analysis-old', cylinderEquipmentId: 'cylinder-1', fillId: 'fill-old', analysedAt: '2026-09-16T11:00:00Z', oxygenFraction: 0.32, heliumFraction: 0, analysedByPersonId: null, attachmentIds: [], notes: null, createdAt: '', modifiedAt: '' };
  const cylinder = { entityId: 'cylinder-1', waterVolumeLiters: 12 };
  it('does not treat an older fill analysis as current', () => {
    const result = projectGasCylinder({ id: 'row', role: 'bottom', cylinderEquipmentId: 'cylinder-1', fillId: 'fill-new', analysisId: 'analysis-old', reservePressureBar: 50 }, { plannedDepthM: 30, plannedBottomTimeMin: 30, rmvRateLitresMin: 22 }, [fill], [previousAnalysis], [cylinder] as never);
    expect(result.mix).toBeNull();
    expect(result.analysisState).toBe('stale');
    expect(result.warnings).toContain('Selected analysis is stale or belongs to another fill.');
    expect(result.volume?.usableLitres).toBe(2184);
    expect(result.requiredLitres).toBe(2640);
  });
  it('marks a deliberately selected older fill stale after a newer fill', () => {
    const olderFill = { ...fill, entityId: 'fill-old', filledAt: '2026-09-16T10:00:00Z' };
    const result = projectGasCylinder({ id: 'row', role: 'bottom', cylinderEquipmentId: 'cylinder-1', fillId: 'fill-old', analysisId: 'analysis-old', reservePressureBar: 50 }, { plannedDepthM: 30, plannedBottomTimeMin: 30, rmvRateLitresMin: 22 }, [olderFill, fill], [previousAnalysis], [cylinder] as never);
    expect(result.mix).toBeNull();
    expect(result.analysisState).toBe('stale');
    expect(result.warnings).toContain('Selected fill is older than the latest recorded fill; its analysis is not current evidence.');
    expect(result.volume).toBeNull();
  });
  it('retains advisory warnings instead of inventing missing team evidence', () => {
    const warnings = assessPlanSiteAndTeam({ plannedMaxDepthM: 35, planTeam: [{ personId: 'p', role: 'Buddy', certifiedDepthM: null }], emergency: {} } as never, { maxDepthM: 30 } as never);
    expect(warnings).toContain('Planned depth exceeds the recorded Site maximum depth.');
    expect(warnings).toContain('At least one team depth capability is unknown.');
  });
});
