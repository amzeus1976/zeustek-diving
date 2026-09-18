import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('T12.5 Plan/Gas UI integration', () => {
  it('uses the existing Plan and Gas routes/stores without adding record kinds', () => {
    expect(read('lib/offline/dive-planning-centre.ts')).toContain('saveDiveTrip(');
    expect(read('lib/offline/planning-pages.ts')).toContain("saveRecord('gas-plan'");
    expect(read('components/dive-planning-centre.tsx')).toContain('listGasPlans');
    expect(read('components/planning/gas-planning.tsx')).toContain('listDiveExpeditionTrips');
  });
  it('separates site and total-duration planning from bottom time and gas controls', () => {
    const source = read('components/dive-planning-centre.tsx');
    expect(source).toContain('Site & conditions analysis');
    expect(source).toContain('Maximum total duration (min)');
    expect(source).toContain('Equipment readiness');
    expect(source).toContain('Gas plan & technical profile');
    const siteCard = source.split('<fieldset><legend>Site & conditions analysis')[1]?.split('</fieldset>')[0] ?? '';
    expect(siteCard).not.toContain('Bottom time (min)');
    expect(siteCard).not.toContain('Runtime (min)');
  });
  it('exposes explicit safety/unknown states, previous group and flight proximity', () => {
    const source = read('components/planning/gas-planning.tsx');
    expect(source).toContain('previousDiveContext');
    expect(source).toContain('flightProximity');
    expect(source).toContain('NDL_UNCONFIGURED');
    expect(source).toContain('GAS_PLANNING_CAUTION');
    expect(source).toContain('analysisFor(cylinder, analyses, fill, fills)');
    expect(source).toContain('title={detailedWarnings.join');
    expect(source).toContain('aria-label={`${detailedWarnings.length} gas planning warnings. Open warning details`}');
    expect(source).toContain('label="Gas planning warnings"');
  });
  it('keeps owner-recorded agency table families separate without bundling lookup data', () => {
    const model = read('lib/offline/planning-pages.ts');
    const source = read('components/planning/gas-planning.tsx');
    expect(model).toContain("'PADI RDP Air' | 'PADI RDP EANx32' | 'SSI' | 'SSI Air/EANx' | 'US Navy Air'");
    expect(source).toContain('Legacy table transcriptions remain in older records');
    expect(read('components/planning/recreational-gas-planner.tsx')).toContain('No backup table configured.');
  });
  it('preserves legacy Bühlmann provenance while the recreational engine remains schedule-free', () => {
    const model = read('lib/offline/planning-pages.ts');
    const source = read('components/planning/gas-planning.tsx');
    expect(model).toContain("planningMethod?: 'agency-table' | 'buhlmann-zhl16c'");
    expect(source).toContain('No decompression schedule is generated.');
    expect(read('components/planning/recreational-gas-planner.tsx')).toContain('ZH-L16B + GF');
    expect(read('components/planning/recreational-gas-planner.tsx')).toContain('ZH-L16C + GF');
  });
  it('retains the Trip itinerary flight classification without replacing legacy text', () => {
    const source = read('components/trips-expeditions.tsx');
    expect(source).toContain('Travel mode');
    expect(source).toContain('Flight');
    expect(read('lib/offline/plan-context-checks.ts')).toContain('inferred from travel text');
  });
});
