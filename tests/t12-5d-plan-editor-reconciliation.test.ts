import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, pendingDiveChanges } from '../lib/offline/dive-store';
import { listEnrichedDivePlans, normalisePlan, saveEnrichedDivePlan } from '../lib/offline/dive-planning-centre';
import { matchSiteChoice, siteChoiceLabel, siteMapQuery } from '../lib/offline/plan-site-choice';
import type { DiveSiteRecord, Stored } from '../lib/offline/dive-planning';
import {editedPlanText,planTextFromPlain} from '../lib/planning/formatted-text';

const editor = () => readFileSync(resolve(process.cwd(), 'components/dive-planning-centre.tsx'), 'utf8');

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn());
  configureDiveStore('t12-5d-test');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('Sites108 Plan editor baseline reconciliation', () => {
  it('uses search-and-add for People and Skills, never the stale checkbox catalogue', () => {
    const source = editor();
    expect(source).toContain('aria-label="Matching People"');
    expect(source).toContain('aria-label="Selected Dive team"');
    expect(source).toMatch(
      />\+ Add \{(?:person\.name|personDisplayName\(person\))\}<\/button>/,
    );
    expect(source).toContain('aria-label="Matching Dive Skills"');
    expect(source).toContain('aria-label="Selected planned Skills"');
    expect(source).toContain('>+ Add {skillRecordName(skill)}</button>');
    expect(source).not.toContain('className={styles.choiceList}>{people.filter(');
    expect(source).not.toContain('className={styles.choiceList}>{skills.filter(');
    expect(source).toContain("onClick={()=>update({planTeam:(draft.planTeam??[]).filter(row=>row.personId!==member.personId)})}");
  });

  it('uses compact accessible help', () => {
    const source = editor();
    expect(source).toContain('aria-label="About duplicate Site selection"');
    expect(source).toContain('aria-label="About team capability"');
    expect(readFileSync(resolve(process.cwd(), 'components/dive-planning-centre.module.css'), 'utf8')).toContain('.editorGrid label>.infoButton');
  });

  it('saves and reopens private formatting alongside exact canonical text offline',async()=>{
    const notes='  Notes 🌊\n\nKeep these spaces  ',document=planTextFromPlain(notes);
    document.content![0]!.content![0]!.marks=[{type:'bold'},{type:'underline'}];
    await saveEnrichedDivePlan({entityId:'formatted-plan',name:'Formatted QA',startDate:'2026-10-10',endDate:'2026-10-10',siteName:'Dummy',buddy:'',status:'planned',notes,aim:'QA aim',goals:['First  ','','Second'],textFormatting:{notes:document}});
    const initial=(await listEnrichedDivePlans())[0]!;
    await saveEnrichedDivePlan({...initial,entityId:initial.entityId,name:'Reopened formatted QA'});
    const reopened=(await listEnrichedDivePlans())[0]!;
    expect(reopened.notes).toBe(notes);
    expect(reopened.goals).toEqual(['First  ','','Second']);
    expect(reopened.textFormatting?.notes).toEqual(document);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('retains oversized notes whitespace through plain-text fallback and leaves legacy trimming compatible',async()=>{
    const notes='  '+ 'x'.repeat(100001)+'  \n',update=editedPlanText(planTextFromPlain(notes));
    const base={name:'Fallback QA',startDate:'2026-10-10',endDate:'2026-10-10',siteName:'Dummy',buddy:'',status:'planned' as const,notes:update.text};
    await saveEnrichedDivePlan({...base,entityId:'fallback-plan',textFormatting:{notes:update.document}});
    expect((await listEnrichedDivePlans()).find(plan=>plan.entityId==='fallback-plan')?.notes).toBe(notes);
    await saveEnrichedDivePlan({...base,entityId:'legacy-plan'});
    expect((await listEnrichedDivePlans()).find(plan=>plan.entityId==='legacy-plan')?.notes).toBe(notes.trim());
  });
  it('removes malformed restored formatting before draft normalisation and unrelated Save',async()=>{
    const valid=planTextFromPlain('Aim'),unsafe={aim:valid,notes:planTextFromPlain('x'.repeat(100001)),goals:{version:1,type:'script'},unknown:{secret:'Discard'}};
    const plan={entityId:'restored-plan',name:'Restored QA',startDate:'2026-10-10',endDate:'2026-10-10',siteName:'Dummy',buddy:'',status:'planned' as const,notes:'  Existing notes  ',createdAt:'now',modifiedAt:'now',textFormatting:unsafe as unknown as NonNullable<ReturnType<typeof normalisePlan>['textFormatting']>};
    expect(normalisePlan(plan).textFormatting).toEqual({aim:valid});
    await saveEnrichedDivePlan({...plan,name:'Unrelated name edit'});
    const stored=await zeustekDb.entities.get('dive:t12-5d-test:restored-plan');
    expect((stored?.record as {textFormatting?:unknown}|undefined)?.textFormatting).toEqual({aim:valid});
    expect((await listEnrichedDivePlans())[0]?.textFormatting).toEqual({aim:valid});
  });

  it('renders canonical Site facts and disambiguates identical names using stable IDs', () => {
    const sites = [
      { entityId: 'site-first', name: 'Twin Quarry', location: 'North', waterType: 'freshwater', maxDepthM: 20 },
      { entityId: 'site-second', name: 'Twin Quarry', location: 'South', waterType: 'freshwater', maxDepthM: 30 },
    ] as unknown as Array<Stored<DiveSiteRecord>>;
    expect(siteChoiceLabel(sites[0]!)).not.toBe(siteChoiceLabel(sites[1]!));
    expect(matchSiteChoice(sites, 'Twin Quarry')).toBeNull();
    expect(matchSiteChoice(sites, siteChoiceLabel(sites[1]!))?.entityId).toBe('site-second');
    expect(siteMapQuery({ name: 'Unlocated' } as DiveSiteRecord)).toBeNull();
    const source = editor();
    expect(source).toContain('aria-label="Canonical Site facts"');
    expect(source).toContain('Site maximum depth');
    expect(source).toContain('Water type');
    expect(source).toContain('matchSiteChoice(sites,value)');
  });

  it('reopens offline with selected team members and planned skills intact', async () => {
    await saveEnrichedDivePlan({
      entityId: 'plan-108', name: 'Reconciliation check', planType: 'day-dive',
      startDate: '2026-09-20', endDate: '2026-09-20', siteName: 'Twin Quarry',
      buddy: '', status: 'planned', notes: '', siteId: 'site-second',
      planTeam: [{ personId: 'person-one', role: 'Team leader', teamLead: true }],
      plannedSkillKeys: ['skill-one', 'skill-two'],
    });
    const original = (await listEnrichedDivePlans())[0]!;
    await saveEnrichedDivePlan({ ...original, entityId: original.entityId, notes: 'Reopened and edited' });
    const reopened = (await listEnrichedDivePlans())[0]!;
    expect(reopened).toMatchObject({
      entityId: 'plan-108', siteId: 'site-second',
      planTeam: [{ personId: 'person-one', role: 'Team leader', teamLead: true }],
      plannedSkillKeys: ['skill-one', 'skill-two'],
    });
    expect((await pendingDiveChanges()).some((change) => change.key.endsWith(':plan-108'))).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
