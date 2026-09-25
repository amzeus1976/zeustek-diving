import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIVE_RECORD_KINDS } from '../lib/record-identity';

const read = (path: string) => readFileSync(path, 'utf8');

describe('T07 shell and architecture integration', () => {
  it('adds only versioned technical reference data, not a second technical Dive/Plan store', () => {
    expect(DIVE_RECORD_KINDS).toContain('reference-requirement-set');
    expect(DIVE_RECORD_KINDS).toContain('dive');
    expect(DIVE_RECORD_KINDS).toContain('trip');
    expect(DIVE_RECORD_KINDS).not.toContain('technical-dive');
    expect(DIVE_RECORD_KINDS).not.toContain('technical-plan');
  });

  it('derives the workspace from shared canonical sources from T05/T06/current source', () => {
    const component = read('components/technical-workspace.tsx');
    expect(component).toContain('listDives');
    expect(component).toContain('listDiveTrips');
    expect(component).toContain('listCanonicalSkills');
    expect(component).toContain('listSkillEvidence');
    expect(component).toContain('listCurrencyPolicies');
    expect(component).toContain('listReusableLoadouts');
    expect(component).toContain('listCertifications');
  });

  it('explicitly refuses to provide an unvalidated decompression engine or hard-coded current requirements', () => {
    const component = read('components/technical-workspace.tsx');
    const domain = read('lib/offline/technical-workspace.ts');
    expect(component).toContain('does not run an unvalidated decompression engine');
    expect(component).toContain('No agency requirement numbers are bundled');
    expect(domain).toContain("requirements:[]");
  });

  it('mounts Technical Diving in the existing responsive shell', () => {
    const dashboard = read('app/dashboard-client.tsx');
    expect(dashboard).toContain("import { TechnicalWorkspace } from '@/components/technical-workspace'");
    expect(dashboard).toContain("'Technical Diving': Gauge");
    expect(read('lib/workflow/workflow-model.ts')).toContain("{ route: 'Technical Diving', label: 'Technical Diving'");
    expect(dashboard).toContain("active === 'Technical Diving' && <TechnicalWorkspace go={go} />");
  });
});
