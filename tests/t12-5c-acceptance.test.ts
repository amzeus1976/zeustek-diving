import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, pendingDiveChanges } from '../lib/offline/dive-store';
import { assessPlanSiteAndTeam, listEnrichedDivePlans, saveEnrichedDivePlan, teamDepthAssessment, type EnrichedDivePlan } from '../lib/offline/dive-planning-centre';
import type { DiveSiteRecord, Stored } from '../lib/offline/dive-planning';
import { assessLinkedGasPlan, matchSiteChoice, siteChoiceLabel, siteMapQuery, MULTI_CYLINDER_NEEDED_UNAVAILABLE } from '../lib/offline/plan-gas-acceptance';
import { listGasPlans, projectGasCylinder, saveDivePlanWithGasLinks, saveGasPlan, type StoredGasPlanRecord } from '../lib/offline/planning-pages';
import { ownerConditionMode, weatherFailureFallback } from '../lib/plan-weather';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const site = (entityId: string, extra: Record<string, unknown> = {}) => ({ entityId, name: 'Twin Quarry', location: '', region: '', country: '', waterType: 'Freshwater', siteType: 'quarry', maxDepthM: 25, ...extra }) as unknown as Stored<DiveSiteRecord>;
const plan = (extra: Record<string, unknown> = {}) => ({ entityId: 'plan-one', name: 'Acceptance Plan', planType: 'day-dive', startDate: '2026-09-20', endDate: '2026-09-20', siteId: 'site-second', siteName: 'Twin Quarry', buddy: '', status: 'planned', notes: '', plannedMaxDepthM: 30, planTeam: [{ personId: 'person-a', role: 'Buddy', certifiedDepthM: 20, capabilityEvidence: 'Owner note' }, { personId: 'person-b', role: 'Diver', certifiedDepthM: 20 }, { personId: 'person-c', role: 'Diver', certifiedDepthM: null }], ...extra }) as unknown as EnrichedDivePlan & { entityId: string };
const fill = { entityId: 'fill-one', cylinderEquipmentId: 'equipment-one', filledAt: '2026-09-17T10:00:00Z', pressureBar: 232, oxygenFraction: 0.32, heliumFraction: 0, provider: null, notes: null, source: 'recorded' as const, createdAt: '', modifiedAt: '' };
const analysis = { entityId: 'analysis-one', cylinderEquipmentId: 'equipment-one', fillId: 'fill-one', analysedAt: '2026-09-17T11:00:00Z', oxygenFraction: 0.32, heliumFraction: 0, analysedByPersonId: null, attachmentIds: [], notes: null, createdAt: '', modifiedAt: '' };
const equipment = { entityId: 'equipment-one', name: '12 L cylinder', waterVolumeLiters: 12 };
const gas = (extra: Record<string, unknown> = {}) => ({ entityId: 'gas-one', name: 'Gas check', divePlanId: 'plan-one', status: 'draft', plannedDepthM: 30, userMaxDepthM: 25, plannedBottomTimeMin: 30, rmvRateLitresMin: 22, cylinders: [{ id: 'row-one', role: 'primary', cylinderEquipmentId: 'equipment-one', fillId: 'fill-one', analysisId: 'analysis-one', reservePressureBar: 50, targetPpo2: 1.4 }], warnings: [], notes: '', createdAt: '', modifiedAt: '', ...extra }) as unknown as StoredGasPlanRecord;

describe('T12.5C Site identity and map provenance', () => {
  it('hides map search without valid location and accepts valid coordinates or address', () => {
    expect(siteMapQuery(site('site-one'))).toBeNull();
    expect(siteMapQuery(site('site-one', { latitude: 91, longitude: 0 }))).toBeNull();
    expect(siteMapQuery(site('site-one', { latitude: 53.4, longitude: -3.1 }))).toBe('53.4,-3.1');
    expect(siteMapQuery(site('site-one', { postcode: 'L1 1AA' }))).toBe('L1 1AA');
  });
  it('disambiguates equal names and preserves the chosen canonical ID', () => {
    const sites = [site('site-first', { region: 'North' }), site('site-second', { region: 'South' })];
    expect(siteChoiceLabel(sites[0]!)).not.toEqual(siteChoiceLabel(sites[1]!));
    expect(matchSiteChoice(sites, 'Twin Quarry')).toBeNull();
    expect(matchSiteChoice(sites, siteChoiceLabel(sites[1]!))?.entityId).toBe('site-second');
  });
});

describe('T12.5C named team and gas advisories', () => {
  const people = [{ entityId: 'person-a', name: 'Ada' }, { entityId: 'person-b', name: 'Ben' }, { entityId: 'person-c', name: 'Chris' }];
  it('names tied limiting divers, marks owner evidence unverified and keeps unknowns unknown', () => {
    const assessment = teamDepthAssessment(plan().planTeam, people);
    expect(assessment.limitM).toBe(20);
    expect(assessment.limitingDivers.map((row) => row.name)).toEqual(['Ada', 'Ben']);
    expect(assessment.unknownDivers).toEqual(['Chris']);
    const warnings = assessPlanSiteAndTeam(plan(), site('site-second'), people);
    expect(warnings).toContain('Planned 30 m exceeds limiting diver Ada, Ben: recorded 20 m (owner-entered, unverified). Confirm evidence.');
    expect(warnings).toContain('Unknown depth capability: Chris. Do not treat this as a pass.');
    expect(teamDepthAssessment([{ personId: 'surface', role: 'Surface support' }]).unknownDivers).toEqual([]);
  });
  it('shows Site, user, team and analysis warnings in the shared Plan/Gas assessment', () => {
    const result = assessLinkedGasPlan(gas(), { divePlan: plan(), site: site('site-second'), people, fills: [fill], analyses: [analysis], equipment: [equipment] as never });
    expect(result.warnings).toContain('Planned 30 m exceeds Site maximum 25 m.');
    expect(result.warnings).toContain('Planned 30 m exceeds owner-entered user maximum 25 m (unverified).');
    expect(result.warnings).toContain('Planned 30 m exceeds limiting diver Ada, Ben: recorded 20 m (owner-entered, unverified).');
    expect(result.warnings).toContain('Unknown depth capability: Chris. Do not treat this as a pass.');
    expect(result.primaryMix).toBe('EAN32');
    expect(result.gasNeededLitres).toBe(2640);
    expect(result.usableLitres).toBe(2184);
    expect(result.reserveLitres).toBe(600);
    expect(result.warnings).toContain('Estimated gas required exceeds usable gas after reserve.');
  });
  it('does not imply linked context or current analysis when either is absent', () => {
    const result = assessLinkedGasPlan(gas({ divePlanId: null, cylinders: [{ id: 'row-one', role: 'primary', cylinderEquipmentId: 'equipment-one', reservePressureBar: null }] }), { fills: [], analyses: [], equipment: [equipment] as never });
    expect(result.warnings).toContain('No linked Dive Plan; Site and team limits cannot be checked.');
    expect(result.warnings).toContain('No linked Site; Site maximum depth cannot be checked.');
    expect(result.warnings).toContain('One or more cylinders have no current gas analysis; manual mixes are unverified.');
    expect(result.warnings.some((warning) => warning.includes('reserve pressure'))).toBe(true);
    expect(result.gasNeededLitres).toBe(2640);
    expect(result.usableLitres).toBeNull();
  });
  it('surfaces calculated MOD and configured PPO₂ over-limit without treating missing values as zero', () => {
    const over = assessLinkedGasPlan(gas({ plannedDepthM: 50 }), { divePlan: plan({ plannedMaxDepthM: 50 }), site: site('site-second', { maxDepthM: 60 }), fills: [fill], analyses: [analysis], equipment: [equipment] as never });
    expect(over.modStatus).toBe('Exceeds calculated MOD');
    expect(over.ppo2Status).toBe('Over configured target');
    expect(over.warnings).toContain('Planned depth exceeds calculated MOD for the chosen target PPO₂.');
    expect(over.warnings).toContain('Calculated PPO₂ exceeds the chosen target.');
    const unknown = assessLinkedGasPlan(gas({ rmvRateLitresMin: null, plannedDepthM: null }), { fills: [], analyses: [], equipment: [equipment] as never });
    expect(unknown.gasNeededLitres).toBeNull();
    expect(unknown.modStatus).toBe('Unknown');
    expect(unknown.ppo2Status).toBe('Unknown');
  });
  it('does not invent a multi-cylinder total or duplicate unassigned segment estimates', () => {
    const second = { id: 'row-two', role: 'backup', cylinderEquipmentId: 'equipment-two', reservePressureBar: 50 };
    const multi = gas({ cylinders: [gas().cylinders[0], second] });
    const result = assessLinkedGasPlan(multi, { divePlan: plan(), site: site('site-second'), fills: [fill], analyses: [analysis], equipment: [equipment] as never });
    expect(result.gasNeededLitres).toBeNull();
    expect(result.warnings.some((warning) => warning.includes(MULTI_CYLINDER_NEEDED_UNAVAILABLE))).toBe(true);
    expect(result.projections.every((projection) => projection.requiredLitres == null)).toBe(true);
    const assigned = projectGasCylinder(multi.cylinders[0]!, { ...multi, depthSegments: [{ id: 'segment-one', depthM: 30, minutes: 10, gasCylinderId: 'row-one' }] }, [fill], [analysis], [equipment] as never);
    expect(assigned.requiredLitres).toBe(880);
  });
});

describe('T12.5C canonical local-first persistence', () => {
  beforeEach(async () => {
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('fetch', vi.fn());
    configureDiveStore('t12-5c-test');
    await zeustekDb.open();
    for (const table of zeustekDb.tables) await table.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('saves and reopens manual and seasonal conditions after a weather rate limit without a live provider call', async () => {
    const manual = weatherFailureFallback(ownerConditionMode({ weather: 'Cloudy', notes: 'Check at harbour' }, 'manual'), true);
    const seasonal = weatherFailureFallback(ownerConditionMode({ weather: 'Typical autumn rain', waterTemperatureC: 16, notes: 'Regional reference only' }, 'seasonal'), true);
    await saveEnrichedDivePlan(plan({ entityId: 'manual-plan', conditions: manual }));
    await saveEnrichedDivePlan(plan({ entityId: 'seasonal-plan', conditions: seasonal }));
    const reopened = await listEnrichedDivePlans();
    expect(reopened.find(row => row.entityId === 'manual-plan')?.conditions).toMatchObject({ provenance: 'recorded', weather: 'Cloudy', notes: 'Check at harbour', weatherAvailability: 'rate-limited' });
    expect(reopened.find(row => row.entityId === 'seasonal-plan')?.conditions).toMatchObject({ provenance: 'seasonal', weather: 'Typical autumn rain', waterTemperatureC: 16, weatherAvailability: 'rate-limited' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reopens the selected duplicate Site ID and additive hyperbaric details without migrating older notes', async () => {
    await saveEnrichedDivePlan(plan({ emergency: { hyperbaricPathway: 'Legacy pathway', hyperbaricFacilityName: 'Regional chamber', hyperbaricFacilityPhone: '01234 567890', hyperbaricFacilityAddress: 'Harbour', hyperbaricAccessNotes: 'Call EMS first', hyperbaricSource: 'Owner call', hyperbaricLastChecked: '2026-09-17' } }));
    const reopened = (await listEnrichedDivePlans())[0]!;
    expect(reopened.siteId).toBe('site-second');
    expect(reopened.emergency).toMatchObject({ hyperbaricPathway: 'Legacy pathway', hyperbaricFacilityName: 'Regional chamber', hyperbaricFacilityPhone: '01234 567890', hyperbaricFacilityAddress: 'Harbour', hyperbaricAccessNotes: 'Call EMS first', hyperbaricSource: 'Owner call', hyperbaricLastChecked: '2026-09-17' });
    await saveEnrichedDivePlan({ ...reopened, entityId: reopened.entityId, emergency: { hyperbaricPathway: 'Older record' } } as Parameters<typeof saveEnrichedDivePlan>[0]);
    expect((await listEnrichedDivePlans())[0]!.emergency?.hyperbaricPathway).toBe('Older record');
  });
  it('links and unlinks Gas Plans by stable IDs, preserves their evidence and queues canonical sync', async () => {
    await saveGasPlan(gas({ divePlanId: null, userMaxDepthM: 25 }));
    const storedGas = (await listGasPlans())[0]!;
    await saveDivePlanWithGasLinks(plan(), [storedGas], [storedGas.entityId]);
    const reopenedPlan = (await listEnrichedDivePlans())[0]!;
    const reopenedGas = (await listGasPlans())[0]!;
    expect(reopenedPlan.gasPlanLinks?.map((row) => row.gasPlanId)).toEqual(['gas-one']);
    expect(reopenedGas).toMatchObject({ entityId: 'gas-one', divePlanId: 'plan-one', userMaxDepthM: 25, cylinders: [{ analysisId: 'analysis-one' }] });
    await saveDivePlanWithGasLinks(reopenedPlan as Parameters<typeof saveDivePlanWithGasLinks>[0], [reopenedGas], []);
    expect((await listGasPlans())[0]!.divePlanId).toBeNull();
    expect((await listEnrichedDivePlans())[0]!.gasPlanLinks).toEqual([]);
    expect((await pendingDiveChanges()).some((row) => row.key.endsWith(':gas-one'))).toBe(true);
    expect((await pendingDiveChanges()).some((row) => row.key.endsWith(':plan-one'))).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects silent transfer of a Gas Plan linked to another Plan', async () => {
    const elsewhere = gas({ divePlanId: 'plan-other' });
    await expect(saveDivePlanWithGasLinks(plan(), [elsewhere], ['gas-one'])).rejects.toThrow('already belongs to another Dive Plan');
    expect(await listEnrichedDivePlans()).toHaveLength(0);
  });
});

describe('T12.5C accessible shell contract', () => {
  it('provides direct Gas Plan selection, creation deep link, location and hyperbaric controls', () => {
    const source = read('components/dive-planning-centre.tsx');
    expect(source).toContain('matchSiteChoice(sites,value)');
    expect(source).toContain('siteMapQuery(selectedSite)');
    expect(source).toContain('No map location recorded');
    expect(source).toContain('selectedGasIds.includes(gas.entityId)');
    expect(source).toContain('newGasPlanFor=');
    expect(source).toContain('hyperbaricFacilityName');
    expect(source).toContain('label="Linked Gas Plan warnings"');
    expect(source).toContain('title={summary.warnings.join');
  });
  it('offers hover, keyboard and tap-accessible warnings/help and explicit multi-cylinder unknown state', () => {
    const source = read('components/planning/gas-planning.tsx');
    expect(source).toContain('title={detailedWarnings.join');
    expect(source).toContain('label="Gas planning warnings"');
    const editor=read('components/planning/t14-gas-plan-editor.tsx');
    const allocation=read('components/planning/gas-allocation-panel.tsx');
    const help=read('components/planning/gas-input-help.tsx');
    expect(allocation).toContain('aria-label="Per-cylinder readiness"');
    expect(editor).toContain('AllocationResults');
    expect(source).toContain('newGasPlanFor');
    expect(source).toContain("params.delete('newGasPlanFor')");
    expect(source).toContain('window.history.replaceState');
    expect(editor).toContain('Owner depth limit (m, optional)');
    expect(source).toContain('multiCylinderReason');
    for (const topic of ['Gas aggregation', 'Gas needed']) expect(source).toContain(`GAS_HELP['${topic}']`);
    for (const topic of ['Planned depth (m)', 'Maximum PPO₂ (bar)', 'Assigned reserve (L)']) expect(help).toContain(topic);
    expect(help).toContain('aria-label={`Help: ${label}`}');
  });
});
