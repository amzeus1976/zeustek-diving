import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, saveLocalRecord } from '../lib/offline/dive-store';
import { listDives, saveDive, type DiveRecord } from '../lib/offline/dives';
import { listSkillEvidence, saveDiveSkillBatch, type CanonicalSkillRecord } from '../lib/offline/dive-context';
import { availableDiveSkills, diveSkillEnvironment, SKILL_ASSESSMENTS, SKILL_ENVIRONMENTS } from '../lib/logbook/skill-practice';
import { parseDiveView } from '../lib/offline/dive-perspectives';
import { DiveSkillBatchEditor } from '../components/dive-skill-batch-editor';
import { DiveRecordDetail, SkillEvidenceDialog } from '../components/dive-record-detail';

const dive = { entityId:'practice-dive',site:'Local test quarry',date:'2026-10-04',timeIn:'10:00',timeOut:'10:40',maxDepthM:12,bottomTimeMin:40,gas:'Air',notes:'Original facts',diveTypes:['Quarry','Shore'],waterType:'Freshwater' } as DiveRecord & {entityId:string};
const skills: CanonicalSkillRecord[] = [{entityId:'trim',skillKey:'trim-key',name:'Trim',group:'Buoyancy & trim'}, {entityId:'dsmb',key:'dsmb-key',name:'DSMB',group:'DSMB & ascent'}, {entityId:'archived',name:'Old skill',archived:true}];
const evidence = [{entityId:'first',skillKey:'trim',diveId:dive.entityId}, {entityId:'other',skillKey:'dsmb-key',diveId:'other-dive'}];
const batch = [
  {entityId:'attempt-trim',skillKey:'trim-key',performedAt:'2026-10-04T10:40:00Z',competenceLevel:'competent' as const,confidenceLevel:4,environment:'Quarry',assessment:'Self assessed',notes:'Two attempts; second stable.'},
  {entityId:'attempt-dsmb',skillKey:'dsmb-key',performedAt:'2026-10-04T10:40:00Z',competenceLevel:'developing' as const,confidenceLevel:2,environment:'Quarry',assessment:'Buddy observed',notes:'Three attempts.'},
];
beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('practice-owner');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
async function seed(){await saveDive(dive);for(const skill of skills)await saveLocalRecord('skill',{...skill});}

describe('Dive-specific Skills practice projection',()=>{
  it('excludes recorded aliases on this Dive, while another Dive does not exclude its Skill',()=>{
    expect(availableDiveSkills(dive,skills,evidence).map(skill=>skill.entityId)).toEqual(['dsmb']);
    expect(availableDiveSkills({...dive,debrief:{skillEvidenceIds:['first']}},skills,[{...evidence[0]!,diveId:null}]).map(skill=>skill.entityId)).toEqual(['dsmb']);
  });
  it('deduplicates canonical identity without mutating legacy evidence',()=>{
    const before=structuredClone(evidence);availableDiveSkills(dive,skills,evidence);expect(evidence).toEqual(before);
    expect(availableDiveSkills(dive,skills,[{entityId:'e',skillKey:'trim-key',diveId:dive.entityId}])).toHaveLength(1);
  });
  it('uses saved water-body settings, retains several explicit environments, and never guesses from a site name',()=>{
    expect(diveSkillEnvironment(dive)).toBe('Quarry');
    expect(diveSkillEnvironment({...dive,diveTypes:['Shore','Lake','Quarry']})).toBe('Lake / Quarry');
    expect(diveSkillEnvironment({...dive,diveTypes:[],waterType:'Saltwater'})).toBe('Saltwater');
    expect(diveSkillEnvironment({...dive,diveTypes:[],waterType:''})).toBe('');
  });
  it('provides explicit dropdown choices and a stable exact-record Skills view',()=>{
    expect(SKILL_ENVIRONMENTS).toContain('Quarry');expect(SKILL_ENVIRONMENTS).toContain('Pool (indoor)');
    expect(SKILL_ASSESSMENTS).toContain('Self assessed');expect(parseDiveView('skills')).toBe('skills');expect(parseDiveView('story')).toBe('story');
  });
  it('renders a distinct Skills page and keeps the inline Debrief free of catalogue controls',()=>{
    const props={dive,title:dive.site,eyebrow:'Test Dive',ownerKind:'dive',ownerId:dive.entityId,rows:[],close:()=>{},edit:()=>{},remove:()=>{}};
    const skillsPage=renderToStaticMarkup(createElement(DiveRecordDetail,{...props,initialView:'skills'}));
    expect(skillsPage).toContain('Skills practised');expect(skillsPage).toContain('Record multiple skills');
    expect(skillsPage).not.toContain('Changes save automatically');
    const debrief=renderToStaticMarkup(createElement(DiveRecordDetail,{...props,initialView:'debrief'}));expect(debrief).toContain('Open Skills practised');expect(debrief).not.toContain('Link existing evidence');
  });
  it('renders multi-selection with separate ratings and repeat-attempt notes',()=>{
    const html=renderToStaticMarkup(createElement(DiveSkillBatchEditor,{dive,skills,evidence,close:()=>{},saved:()=>{},progress:()=>{}}));
    expect(html).toContain('Select DSMB');expect(html).not.toContain('Select Trim');
    expect(html).toContain('Self assessed');expect(html).toContain('value="Quarry" selected');expect(html).toContain('Save 0 skills');
    expect(html).toContain('notes');expect(html).toContain('data-record-editor-workspace');
  });
  it('retains unknown legacy environment and assessment options in the single-evidence editor',()=>{
    const html=renderToStaticMarkup(createElement(SkillEvidenceDialog,{dive,skills,people:[],equipmentSets:[],evidence:{entityId:'legacy',skillKey:'trim-key',performedAt:'2026-10-04T10:40:00Z',environment:'Saved offshore training zone',assessment:'Legacy instructor wording',competenceLevel:3,confidenceLevel:0},close:()=>{},saved:()=>{}}));
    expect(html).toContain('Saved offshore training zone');expect(html).toContain('Legacy instructor wording');expect(html).toContain('Legacy competence: 3 / 5');expect(html).toContain('Self assessed');
  });
});

describe('recoverable canonical multi-Skill saves',()=>{
  it('saves independent confidence and competence values, notes and exact links without changing Dive facts',async()=>{
    await seed();const result=await saveDiveSkillBatch(dive.entityId,batch);expect(result.failed).toEqual([]);expect(result.saved).toHaveLength(2);
    expect(await listSkillEvidence()).toEqual(expect.arrayContaining([expect.objectContaining(batch[0]),expect.objectContaining(batch[1])]));
    expect((await listDives())[0]).toMatchObject({notes:dive.notes,diveTypes:dive.diveTypes,debrief:{skillEvidenceIds:['attempt-trim','attempt-dsmb']}});expect(fetch).not.toHaveBeenCalled();
  });
  it('makes retry idempotent and reports an already-practised skill without creating a duplicate',async()=>{
    await seed();await saveDiveSkillBatch(dive.entityId,batch);await saveDiveSkillBatch(dive.entityId,batch);
    const retry=await saveDiveSkillBatch(dive.entityId,[{...batch[0]!,entityId:'different-attempt-id'}]);expect(retry.skipped).toHaveLength(1);expect(await listSkillEvidence()).toHaveLength(2);
  });
  it('resolves legacy key aliases for duplicate detection without rewriting that evidence',async()=>{
    await seed();await saveLocalRecord('skill_evidence',{entityId:'legacy',skillKey:'trim',diveId:dive.entityId,notes:'Retain',confidenceLevel:0});
    const result=await saveDiveSkillBatch(dive.entityId,[batch[0]!]);expect(result.skipped).toHaveLength(1);expect((await listSkillEvidence())[0]).toMatchObject({entityId:'legacy',skillKey:'trim',notes:'Retain',confidenceLevel:0});
  });
  it('retains partial successes, completes an interrupted link on retry and does not multiply attempts',async()=>{
    await seed();const original=zeustekDb.entities.put.bind(zeustekDb.entities);let failedOnce=false;
    const fail=vi.spyOn(zeustekDb.entities,'put').mockImplementation((...args)=>{if(!failedOnce&&args[0].entityId?.endsWith(':attempt-dsmb')){failedOnce=true;return Dexie.Promise.reject(new Error('Fixture local write failure'));}return original(...args);});
    const partial=await saveDiveSkillBatch(dive.entityId,batch);expect(partial.saved).toHaveLength(1);expect(partial.failed).toHaveLength(1);fail.mockRestore();
    const retry=await saveDiveSkillBatch(dive.entityId,batch);expect(retry.failed).toEqual([]);expect(await listSkillEvidence()).toHaveLength(2);expect(new Set((await listDives())[0]?.debrief?.skillEvidenceIds).size).toBe(2);
  });
  it('prevalidates duplicate/invalid selections and rejects foreign or deleted Dives',async()=>{
    await seed();await expect(saveDiveSkillBatch(dive.entityId,[batch[0]!,{...batch[0]!,entityId:'duplicate'}])).rejects.toThrow('once');
    await expect(saveDiveSkillBatch(dive.entityId,[{...batch[0]!,confidenceLevel:8}])).rejects.toThrow('Confidence');expect(await listSkillEvidence()).toHaveLength(0);
    configureDiveStore('other-owner');await expect(saveDiveSkillBatch(dive.entityId,batch)).rejects.toThrow();expect(await listSkillEvidence()).toHaveLength(0);
  });
  it('recovers evidence saved before an interrupted Dive link without adding another occurrence',async()=>{
    await seed();const original=zeustekDb.entities.put.bind(zeustekDb.entities);let failedOnce=false;
    const fail=vi.spyOn(zeustekDb.entities,'put').mockImplementation((...args)=>{if(!failedOnce&&args[0].entityId?.endsWith(':practice-dive')){failedOnce=true;return Dexie.Promise.reject(new Error('Fixture link interruption'));}return original(...args);});
    const partial=await saveDiveSkillBatch(dive.entityId,[batch[0]!]);expect(partial.failed).toHaveLength(1);expect(await listSkillEvidence()).toHaveLength(1);fail.mockRestore();
    expect((await saveDiveSkillBatch(dive.entityId,[batch[0]!])).failed).toEqual([]);expect(await listSkillEvidence()).toHaveLength(1);expect((await listDives())[0]?.debrief?.skillEvidenceIds).toEqual(['attempt-trim']);
  });
  it('serialises concurrent saves of the same Skill and preserves both existing notes and catalogue records',async()=>{
    await seed();await Promise.all([saveDiveSkillBatch(dive.entityId,[batch[0]!]),saveDiveSkillBatch(dive.entityId,[{...batch[0]!,entityId:'concurrent'}])]);
    expect(await listSkillEvidence()).toHaveLength(1);expect((await listDives())[0]?.debrief?.skillEvidenceIds).toHaveLength(1);expect(await zeustekDb.entities.where('entityType').equals('skill').count()).toBe(3);
  });
});
