import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIVE_RECORD_KINDS } from '../lib/record-identity';

const read = (path: string) => readFileSync(path, 'utf8');

describe('T05 shell and compatibility integration', () => {
  it('keeps equipment-set as the reusable loadout base and adds only fill/analysis evidence kinds', () => {
    expect(DIVE_RECORD_KINDS).toContain('equipment-set');
    expect(DIVE_RECORD_KINDS).toContain('cylinder-fill');
    expect(DIVE_RECORD_KINDS).toContain('gas-analysis');
    expect(DIVE_RECORD_KINDS).toContain('site-overhead-profile');
    expect(DIVE_RECORD_KINDS).toContain('dive-trip');
    expect(DIVE_RECORD_KINDS).not.toContain('loadout');
  });

  it('preserves legacy Plan runtime kind trip', () => {
    const planning = read('lib/offline/dive-planning.ts');
    expect(planning).toContain("listRecords<DiveTripRecord>('trip')");
    expect(planning).toContain("saveRecord('trip', input)");
  });

  it('keeps reusable Loadouts and Cylinders & Gas as views over the canonical Equipment inventory', () => {
    const dashboard = read('app/dashboard-client.tsx');
    expect(dashboard).toContain("import { CylindersGas, Loadouts } from '@/components/loadouts-gas'");
    expect(dashboard).toContain("'Loadouts & Gas': Wrench");
    expect(dashboard).toContain("'Cylinders & Gas': Cylinder");
    expect(read('lib/workflow/workflow-model.ts')).toContain("{ route: 'Loadouts & Gas', label: 'Loadouts'");
    expect(read('lib/workflow/workflow-model.ts')).toContain("{ route: 'Cylinders & Gas', label: 'Cylinders & Gas'");
    expect(dashboard).toContain("active === 'Loadouts & Gas' && <Loadouts />");
    expect(dashboard).toContain("active === 'Cylinders & Gas' && <CylindersGas />");
    const domain = read('lib/offline/loadouts-gas.ts');
    expect(domain).toContain("listRecords<ReusableLoadoutRecord>('equipment-set')");
    expect(domain).toContain("saveRecord('equipment-set'");
    expect(domain).toContain("saveRecord('cylinder-fill'");
    expect(domain).toContain("saveRecord('gas-analysis'");
  });
});
