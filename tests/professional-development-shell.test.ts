import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIVE_RECORD_KINDS } from '../lib/record-identity';

const read = (path: string) => readFileSync(path, 'utf8').replace(/\s+/g, ' ');

describe('T08 Professional Development shell and architecture', () => {
  it('contains the native pathway selector even when its option is longer than a phone viewport', () => {
    const css = read('components/professional-development.module.css');
    const selector = css.match(/\.pathwayBar select\s*\{([^}]+)\}/)?.[1];
    expect(selector).toBeDefined();
    expect(selector).toMatch(/min-width:\s*0\s*;/);
    expect(selector).toMatch(/(?:^|\s)width:\s*100%\s*;/);
    expect(selector).toMatch(/max-width:\s*100%\s*;/);
    expect(css).toMatch(/\.pathwayBar label\s*\{[^}]*max-width:\s*100%/);
    expect(DIVE_RECORD_KINDS).toContain('equipment-event');
    expect(DIVE_RECORD_KINDS).toContain('site-overhead-profile');
    expect(DIVE_RECORD_KINDS).toContain('dive-trip');
    expect(DIVE_RECORD_KINDS).toContain('trip');
  });

  it('allows the pathway editor fieldset and native snapshot selectors to shrink within a phone dialog', () => {
    const css = read('components/professional-development.module.css');
    expect(css).toMatch(/\.formGrid\s*\{[^}]*min-width:\s*0\s*;/);
    expect(css).toMatch(/\.formGrid label,\s*\.formGrid fieldset\s*\{[^}]*min-width:\s*0\s*;/);
    const selector = css.match(/\.formGrid select\s*\{([^}]+)\}/)?.[1];
    expect(selector).toMatch(/min-width:\s*0\s*;/);
    expect(selector).toMatch(/(?:^|\s)width:\s*100%\s*;/);
    expect(selector).toMatch(/max-width:\s*100%\s*;/);
  });

  it('adds generic pathway/evidence records while reusing the versioned requirement-set kind', () => {
    expect(DIVE_RECORD_KINDS).toContain('professional-pathway');
    expect(DIVE_RECORD_KINDS).toContain('professional-evidence');
    expect(DIVE_RECORD_KINDS).toContain('reference-requirement-set');
    expect(DIVE_RECORD_KINDS).not.toContain('padi-divemaster-progress');
  });

  it('derives readiness from shared canonical sources rather than copying Dive, Skill, Site or Person data', () => {
    const component = read('components/professional-development.tsx');
    expect(component).toContain('listDives');
    expect(component).toContain('listCanonicalSkills');
    expect(component).toContain('listSkillEvidence');
    expect(component).toContain('listDiveSites');
    expect(component).toContain('listPeople');
    expect(component).toContain('listCertifications');
  });

  it('keeps agency requirement truth versioned and refuses to bundle supposedly-current numeric standards', () => {
    const component = read('components/professional-development.tsx');
    const domain = read('lib/offline/professional-development.ts');
    expect(component).toContain('does not bundle supposedly-current agency requirement numbers');
    expect(component).toContain('This creates a new immutable snapshot');
    expect(domain).toContain('standards updates create another version');
    expect(domain).not.toContain('40 logged dives');
    expect(domain).not.toContain('400 m');
  });

  it('protects pathways that still own historical Professional Evidence', () => {
    const domain = read('lib/offline/professional-development.ts');
    expect(domain).toContain('Professional Evidence is linked to this pathway');
    expect(domain).toContain('listProfessionalEvidence');
  });

  it('uses the common media system for professional documents and evidence attachments', () => {
    const component = read('components/professional-development.tsx');
    expect(component).toContain('<MediaGallery');
    expect(component).toContain('ownerKind="professional-evidence"');
    expect(component).toContain('onUploaded={attach}');
    expect(component).toContain('onRemoved={detach}');
    const route=read('app/api/media/route.ts');
    expect(route).toMatch(/\[[^\]]*'professional-evidence'[^\]]*\]\.includes\(ownerKind\)\s*&&\s*\['application\/pdf','text\/plain'\]\.includes\(file.type\)/);
    expect(route).toContain('await getChatGPTUser()');
    expect(route).toContain("if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })");
  });


  it('adds richer evidence capture without creating parallel canonical Dive/Skill/Person records', () => {
    const component = read('components/professional-development.tsx');
    const domain = read('lib/offline/professional-development.ts');
    expect(component).toContain('professionalAssessmentFields');
    expect(domain).toContain('PROFESSIONAL_EVIDENCE_FIELDS');
    expect(component).toContain('relatedSkillEvidenceIds');
    expect(component).toContain('relatedCertificationId');
    expect(component).toContain('Link to this requirement');
    expect(domain).toContain('professionalEvidenceReferenceIssueSummary');
    expect(domain).toContain('createRequirementEvidenceLink');
  });

  it('prefills a newer standards snapshot from the current immutable version instead of editing history', () => {
    const component = read('components/professional-development.tsx');
    expect(component).toContain('current?.requirements');
    expect(component).toContain('Existing captured requirements are prefilled only as a drafting aid');
  });

  it('mounts Professional Development in the existing responsive ZeusTek shell', () => {
    const dashboard = read('app/dashboard-client.tsx');
    expect(dashboard).toContain("const ProfessionalDevelopment=lazy(()=>import('@/components/professional-development').then(module=>({default:module.ProfessionalDevelopment})));");
    expect(dashboard).toContain("'Professional Development': GraduationCap");
    expect(read('lib/workflow/workflow-model.ts')).toContain("{ route: 'Professional Development', label: 'Professional Development'");
    expect(dashboard).toContain("active === 'Professional Development' && <ProfessionalDevelopment go={go} />");
  });
});
