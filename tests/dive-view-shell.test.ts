import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DiveRecordDetail, SkillEvidenceCard, SkillEvidenceDialog } from '../components/dive-record-detail';
import { filterSkillCatalogueSkills, SKILL_CATALOGUE_BATCH_SIZE, SkillCatalogue } from '../components/skill-catalogue';
import type { DiveRecord } from '../lib/offline/dives';

const dive: DiveRecord & { entityId: string } = { entityId: 'same-dive-id', site: 'Historical quarry Dive', date: '2026-09-01', maxDepthM: 12, bottomTimeMin: 38, gas: 'Air', notes: '', source: 'manual', createdAt: '2026-09-01', modifiedAt: '2026-09-01' };
const props = { dive, title: dive.site, eyebrow: 'manual dive', ownerKind: 'dive', ownerId: dive.entityId, rows: [['Maximum depth', '12 m'], ['Notes', 'Original factual notes']] as Array<[string, string]>, close: () => {}, edit: () => {}, remove: () => {} };

describe('Dive segmented-view shell', () => {
  it('renders one shared identity and a fully labelled semantic selector with Overview default', () => {
    const html = renderToStaticMarkup(createElement(DiveRecordDetail, props));
    expect(html).toContain('aria-label="Dive view"');
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-selected="true"[^>]*>Overview<\/button>/);
    expect(html.match(/<h2>/g)).toHaveLength(1);
    expect(html).toContain('Original factual notes');
    expect(html).toContain('Edit Dive facts');
  });
  it('supports an explicit Story perspective without requiring historical new fields', () => {
    const html = renderToStaticMarkup(createElement(DiveRecordDetail, { ...props, initialView: 'story' }));
    expect(html).toMatch(/aria-selected="true"[^>]*>Story<\/button>/);
    expect(html).toContain('Your Dive story');
    expect(html).toContain('What happened');
    expect(html).toContain('Add timeline note');
    expect(html).not.toContain('required=""');
  });
  it('makes Skills practised actionable and exposes the canonical empty-catalogue creation path',()=>{
    const debrief=renderToStaticMarkup(createElement(DiveRecordDetail,{...props,initialView:'debrief'}));
    expect(debrief).toContain('Skills practised');
    expect(debrief).toContain('Add skill');
    expect(debrief).toContain('No skills recorded for this dive yet.');
    const editor=renderToStaticMarkup(createElement(SkillEvidenceDialog,{dive,skills:[],people:[],equipmentSets:[],evidence:null,close:()=>{},saved:()=>{}}));
    expect(editor).toContain('New skill name');
    expect(editor).toContain('This creates one reusable Skill definition');
    expect(editor).toContain('Practised at');
    expect(editor).toContain('Competence');
    expect(editor).toContain('Confidence');
    expect(editor).not.toContain('Delete evidence');
  });
  it('exposes the canonical Skill Catalogue and searchable Dive selector',()=>{
    const catalogue=renderToStaticMarkup(createElement(SkillCatalogue));
    expect(catalogue).toContain('DIVING DATA');
    expect(catalogue).toContain('Skill Catalogue');
    expect(catalogue).toContain('Add multiple skills');
    expect(catalogue).toContain('Add skill');
    const editor=renderToStaticMarkup(createElement(SkillEvidenceDialog,{dive,skills:[{entityId:'trim-id',skillKey:'trim-id',name:'Trim',group:'Buoyancy & trim'}],people:[],equipmentSets:[],evidence:null,close:()=>{},saved:()=>{}}));
    expect(editor).toContain('Search existing skills');
    expect(editor).toContain('Search by Skill group, name or description');
    expect(editor).toContain('value="trim-id"');
    expect(editor).toContain('Buoyancy &amp; trim — Trim');
    expect(catalogue).toContain('Import CSV');
    expect(catalogue).toContain('Export CSV');
    expect(catalogue).toContain('Clear unused archived');
    const dashboard=readFileSync(new URL('../app/dashboard-client.tsx',import.meta.url),'utf8');
    expect(dashboard).toMatch(/active === 'Settings'[\s\S]*?<SkillCatalogue \/>/);
  });
  it('shows the selected Skill-specific competence definition and a controlled no-definition state',()=>{
    const skill={entityId:'air-share-id',skillKey:'air-share-id',name:'Air-sharing stop control',group:'Buoyancy & Trim',competenceDefinitions:{foundation:'Holds the stop with coaching.',developing:'Usually stable but requires regular corrections.',competent:'Maintains depth and contact reliably.',advanced:'Remains stable while communicating and monitoring gas or decompression.',mastered:'Precise, relaxed and essentially automatic.'}};
    const rich=renderToStaticMarkup(createElement(SkillEvidenceDialog,{dive,skills:[skill],people:[],equipmentSets:[],evidence:{entityId:'evidence-1',skillKey:skill.entityId,performedAt:'2026-09-05T12:34:00.000Z',competenceLevel:'advanced'},close:()=>{},saved:()=>{}}));
    expect(rich).toContain('value="foundation"'); expect(rich).toContain('value="mastered"');
    expect(rich).toContain('aria-describedby=');
    expect(rich).toContain('aria-label="Show Skill-specific competence definitions"');
    expect(rich).toContain('aria-expanded="false"');
    expect(rich).toContain('<b>Advanced</b><span>Remains stable while communicating and monitoring gas or decompression.</span>');
    expect(rich).toContain('data-editable="true"');
    expect(rich).toContain('data-dialog-close="true"');
    for (const [level, definition] of Object.entries(skill.competenceDefinitions)) {
      const selected=renderToStaticMarkup(createElement(SkillEvidenceDialog,{dive,skills:[skill],people:[],equipmentSets:[],evidence:{entityId:`evidence-${level}`,skillKey:skill.entityId,performedAt:'2026-09-05T12:34:00.000Z',competenceLevel:level as 'foundation'},close:()=>{},saved:()=>{}}));
      expect(selected).toContain(definition);
    }
    const legacy=renderToStaticMarkup(createElement(SkillEvidenceDialog,{dive,skills:[{...skill,competenceDefinitions:{}}],people:[],equipmentSets:[],evidence:{entityId:'evidence-2',skillKey:skill.entityId,performedAt:'2026-09-05T12:34:00.000Z',competenceLevel:'foundation',assessment:'Legacy instructor wording'},close:()=>{},saved:()=>{}}));
    expect(legacy).toContain('No Skill-specific definition has been recorded yet.');
    expect(legacy).toContain('Legacy instructor wording');
  });
  it('renders compact evidence actions with accessible icon labels and keeps all evidence details',()=>{
    const skill={entityId:'trim-id',name:'Drysuit bubble management',group:'Drysuit'};
    const html=renderToStaticMarkup(createElement(SkillEvidenceCard,{item:{entityId:'evidence-1',skillKey:'trim-id',performedAt:'2026-09-05T12:34:00.000Z',competenceLevel:'competent',assessment:'Legacy assessment',environment:'Open water',notes:'Controlled throughout',confidenceLevel:4,attachmentIds:[]},skill,people:[],edit:()=>{},unlink:()=>{},remove:()=>{}}));
    expect(html).toContain('class="dive-evidence-summary"');
    expect(html).toContain('aria-label="Edit evidence"'); expect(html).toContain('title="Unlink evidence"'); expect(html).toContain('aria-label="Delete evidence"'); expect(html).toContain('data-tooltip="Delete evidence"');
    expect(html).toContain('Evidence details'); expect(html).toContain('Competent'); expect(html).toContain('Legacy assessment'); expect(html).toContain('Controlled throughout');
    expect(html).not.toContain('>Edit evidence<'); expect(html).not.toContain('>Delete evidence<');
    const source=readFileSync(new URL('../components/dive-record-detail.tsx',import.meta.url),'utf8');
    expect(source).toContain("window.confirm('Delete this evidence occurrence? The canonical Skill definition will be kept.')");
    const css=readFileSync(new URL('../app/focus.css',import.meta.url),'utf8');
    expect(css).toContain('.focus-icon:focus-visible::after{display:block}');
  });
  it('separates the catalogue heading from an ordered, wrapping toolbar',()=>{
    const catalogue=renderToStaticMarkup(createElement(SkillCatalogue));
    expect(catalogue).toMatch(/skill-catalogue-head[\s\S]*?Skill Catalogue[\s\S]*?<\/div><div class="record-actions skill-catalogue-toolbar"/);
    expect(catalogue.indexOf('Add skill')).toBeLessThan(catalogue.indexOf('Import CSV'));
    expect(catalogue.indexOf('Import CSV')).toBeLessThan(catalogue.indexOf('Export CSV'));
    expect(catalogue.indexOf('Export CSV')).toBeLessThan(catalogue.indexOf('Add multiple skills'));
    expect(catalogue.indexOf('Add multiple skills')).toBeLessThan(catalogue.indexOf('Clear unused archived'));
    const css=readFileSync(new URL('../app/focus.css',import.meta.url),'utf8');
    expect(css).toMatch(/\.skill-catalogue-toolbar\{[^}]*flex-wrap:wrap/);
    expect(css).toContain('.skill-catalogue-filters,.skill-editor-grid,.skill-cleanup-lists{grid-template-columns:minmax(0,1fr)}');
    expect(css).toContain('.skill-catalogue{display:grid;gap:14px;margin:18px 0;min-width:0}');
  });
  it('defaults to zero selected groups and exposes accessible multi-select actions',()=>{
    const catalogue=renderToStaticMarkup(createElement(SkillCatalogue));
    expect(catalogue).toContain('Skill Groups: No Skill Groups selected');
    expect(catalogue).toContain('Search Skill Groups');
    expect(catalogue).toContain('Select all');
    expect(catalogue).toContain('Clear all');
    const source=readFileSync(new URL('../components/skill-catalogue.tsx',import.meta.url),'utf8');
    expect(source).toContain('Select one or more Skill Groups to view Skills.');
    expect(catalogue).not.toContain('<article');
  });
  it('filters within one or multiple selected groups and bounds large catalogues',()=>{
    const testGroups=['Buoyancy & Trim','Propulsion','Navigation','Rescue'] as const;
    const skills=Array.from({length:3500},(_,index)=>({entityId:`skill-${index}`,skillKey:`skill-${index}`,name:index === 2 || index === 3 ? 'Hover control' : `Skill ${index}`,group:testGroups[index % testGroups.length]!}));
    const none=filterSkillCatalogueSkills(skills,new Set(),'');
    expect(none).toEqual({matches:[],visible:[],total:0});
    const one=filterSkillCatalogueSkills(skills,new Set(['Buoyancy & Trim']),'');
    expect(one.total).toBe(875); expect(one.visible).toHaveLength(SKILL_CATALOGUE_BATCH_SIZE); expect(one.visible.every(skill=>skill.group === 'Buoyancy & Trim')).toBe(true);
    const multiple=filterSkillCatalogueSkills(skills,new Set(['Buoyancy & Trim','Propulsion']),'');
    expect(multiple.total).toBe(1750); expect(multiple.visible.every(skill=>['Buoyancy & Trim','Propulsion'].includes(skill.group || ''))).toBe(true);
    const searched=filterSkillCatalogueSkills(skills,new Set(['Buoyancy & Trim','Propulsion']),'hover');
    expect(searched.total).toBe(0);
    const rescueSearch=filterSkillCatalogueSkills(skills,new Set(['Rescue']),'hover');
    expect(rescueSearch.matches.map(skill=>skill.entityId)).toEqual(['skill-3']);
    const all=filterSkillCatalogueSkills(skills,new Set(['Buoyancy & Trim','Propulsion','Navigation','Rescue']),'');
    expect(all.total).toBe(3500); expect(all.visible).toHaveLength(75);
    expect(filterSkillCatalogueSkills(skills,new Set(['Rescue']),'',150).visible).toHaveLength(150);
  });
});
