import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiveSkillBatchEditor } from '../components/dive-skill-batch-editor';
import { configureDiveStore, saveLocalRecord } from '../lib/offline/dive-store';
import { zeustekDb } from '../lib/offline/db';
import { listDives, saveDive, type DiveRecord } from '../lib/offline/dives';
import { listSkillEvidence, type CanonicalSkillRecord } from '../lib/offline/dive-context';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, useState: vi.fn() };
});
const dive = {entityId:'progress-dive',date:'2026-10-04',timeIn:'10:00',timeOut:'10:40',site:'Fixture quarry',gas:'Air',notes:'Keep facts',debrief:{wentWell:'Keep reflection'}} as DiveRecord & {entityId:string};
const skills:CanonicalSkillRecord[] = [{entityId:'progress-trim',skillKey:'progress-trim',name:'Trim'}, {entityId:'progress-dsmb',skillKey:'progress-dsmb',name:'DSMB'}];
const drafts = [{entityId:'progress-first',skillId:'progress-trim',competence:'competent',confidence:'4',notes:'Two attempts'}, {entityId:'progress-second',skillId:'progress-dsmb',competence:'developing',confidence:'2',notes:'Three attempts'}];
let stateWrites:unknown[];
beforeEach(async()=>{
  vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());
  configureDiveStore('progress-owner');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();
  await saveDive(dive);for(const skill of skills)await saveLocalRecord('skill',{...skill});
  stateWrites=[];
  vi.mocked(useState).mockImplementation(((initial:unknown)=>{
    const value=typeof initial==='function'?initial():initial;
    const selected=Array.isArray(value)?drafts:value;
    return [selected,(next:unknown)=>stateWrites.push(typeof next==='function'?next(selected):next)];
  }) as unknown as typeof useState);
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
function editor(){
  let parentIds:string[]=[];
  const progress=vi.fn((ids:string[])=>{parentIds=ids;});
  const close=vi.fn(),saved=vi.fn();
  const props={dive,skills,evidence:[],close,saved,progress};
  const workspace=DiveSkillBatchEditor(props);
  return {workspace,progress,close,saved,parentIds:()=>parentIds};
}
describe('Skills batch parent progress during partial persistence',()=>{
  it('publishes saved links immediately, keeps failed drafts open and retains the parent links after Cancel',async()=>{
    const original=zeustekDb.entities.put.bind(zeustekDb.entities);
    const failure=vi.spyOn(zeustekDb.entities,'put').mockImplementation((...args)=>{
      if(args[0].entityId?.endsWith(':progress-second'))return Dexie.Promise.reject(new Error('Fixture second-row failure'));
      return original(...args);
    });
    const view=editor();await view.workspace.props.save();
    expect(view.progress).toHaveBeenCalledWith(['progress-first']);
    expect(view.parentIds()).toEqual((await listDives())[0]?.debrief?.skillEvidenceIds);
    expect(view.saved).not.toHaveBeenCalled();expect(view.close).not.toHaveBeenCalled();
    expect(stateWrites).toContainEqual([drafts[1]]);
    view.workspace.props.close();
    expect(view.close).toHaveBeenCalledOnce();expect(view.parentIds()).toEqual(['progress-first']);
    expect(await listSkillEvidence()).toHaveLength(1);expect((await listDives())[0]).toMatchObject({notes:'Keep facts',debrief:{wentWell:'Keep reflection',skillEvidenceIds:['progress-first']}});
    failure.mockRestore();expect(fetch).not.toHaveBeenCalled();
  });
  it('publishes all saved links before the normal complete-and-close callback',async()=>{
    const view=editor();await view.workspace.props.save();
    expect(view.progress).toHaveBeenCalledWith(['progress-first','progress-second']);
    expect(view.saved).toHaveBeenCalledWith(expect.any(Array),['progress-first','progress-second']);
    expect(view.progress.mock.invocationCallOrder[0]).toBeLessThan(view.saved.mock.invocationCallOrder[0]!);
    expect(view.parentIds()).toEqual((await listDives())[0]?.debrief?.skillEvidenceIds);
  });
});
