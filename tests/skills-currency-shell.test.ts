import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIVE_RECORD_KINDS } from '../lib/record-identity';
const read = (path: string) => readFileSync(path, 'utf8');

describe('T06 shell integration', () => {
  it('shares the Settings canonical group derivation rather than a fixed shortlist', () => {
    const currency = read('components/skills-currency.tsx');
    const catalogue = read('components/skill-catalogue.tsx');
    expect(currency).toContain('canonicalSkillGroups(skills)');
    expect(catalogue).toContain('canonicalSkillGroups(skills)');
    expect(currency).not.toContain('CANONICAL_SKILL_GROUPS');
    expect(currency).toContain('{groups.map(');
  });
  it('adds only currency-policy while preserving canonical Skill and Skill Evidence kinds', () => {
    expect(DIVE_RECORD_KINDS).toContain('skill');
    expect(DIVE_RECORD_KINDS).toContain('skill_evidence');
    expect(DIVE_RECORD_KINDS).toContain('currency-policy');
  });
  it('uses the existing canonical Skill catalogue/evidence instead of building a duplicate catalogue', () => {
    const component = read('components/skills-currency.tsx');
    expect(component).toContain('listCanonicalSkills');
    expect(component).toContain('listSkillEvidence');
    expect(component).toContain('saveDiveSkillEvidence');
    expect(component).not.toContain("saveRecord('skill'");
  });
  it('mounts Skills & Currency separately from Certification/Training records', () => {
    const dashboard = read('app/dashboard-client.tsx');
    expect(dashboard).toContain(
      "import { SkillsCurrency } from '@/components/skills-currency'",
    );
    expect(dashboard).toContain("['Skills & Currency', ShieldCheck]");
    expect(dashboard).toContain(
      "active === 'Skills & Currency' && <SkillsCurrency go={go} />",
    );
  });
});
