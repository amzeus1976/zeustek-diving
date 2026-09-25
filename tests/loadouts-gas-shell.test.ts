import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIVE_RECORD_KINDS } from '../lib/record-identity';

const read = (path: string) => readFileSync(path, 'utf8');

describe('T05 shell and compatibility integration', () => {
  it('keeps equipment-set as the reusable loadout base and adds only fill/analysis evidence kinds', () => {
    expect(DIVE_RECORD_KINDS).toContain('equipment-set');
    expect(DIVE_RECORD_KINDS).toContain('cylinder');
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

  it('keeps reusable Loadouts compatible while managing new cylinders in their own canonical table', () => {
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
    expect(domain).toContain("listRecords<CylinderEquipmentRecord>('cylinder')");
    expect(domain).toContain("saveRecord('cylinder-fill'");
    expect(domain).toContain("saveRecord('gas-analysis'");
    expect(read('components/loadouts-gas.tsx')).toContain('Add cylinder');
    expect(read('components/loadouts-gas.tsx')).toContain('Blue quadrant sticker');
    expect(read('components/loadouts-gas.tsx')).toContain('Assigned automatically on save');
    expect(read('components/loadouts-gas.tsx')).toContain('Serial number (S/N)');
    expect(read('components/loadouts-gas.tsx')).toContain('Hydro + visual');
    expect(read('components/loadouts-gas.tsx')).toContain('type="month"');
    expect(read('components/loadouts-gas.tsx')).toContain('<option value="A-CLAMP">A-CLAMP</option>');
    expect(read('components/loadouts-gas.tsx')).toContain('DEFAULT_GEAR_MANUFACTURERS');
    expect(read('components/loadouts-gas.tsx')).toContain('Gas use / remaining pressure');
    expect(domain).toContain('recordCylinderGasUsage');
    expect(dashboard).toContain('items.filter((item) => !isCylinderEquipment(item))');
    expect(dashboard).not.toContain('placeholder="12L steel cylinder"');
  });
  it('edits reusable Loadouts in the route workspace without changing the canonical store', () => {
    const source = read('components/loadouts-gas.tsx');
    expect(source).toContain('<RecordEditorWorkspace label={item ? `Edit ${item.name}` : \'Create reusable loadout\'}');
    expect(source).not.toContain('<AccessibleDialog editable label={item ? `Edit ${item.name}` : \'Create reusable loadout\'}');
    expect(source).toContain('<RecordEditorWorkspace label={item ? `Edit ${item.name}` : \'Add cylinder\'}');
    expect(source).not.toContain('<AccessibleDialog editable label={item ? `Edit ${item.name}` : \'Add cylinder\'}');
  });
});
