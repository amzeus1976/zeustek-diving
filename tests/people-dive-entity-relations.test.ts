import {describe,expect,it} from 'vitest';
import * as model from '../lib/operators/dive-centres';

const api=model as typeof model & Record<string,any>;
const person=(entityId:string,refs:Record<string,string>={})=>({entityId,name:entityId,role:'buddy',agency:'',highestQualification:'',membershipNumber:'',email:'',phone:'',emergencyContact:'',notes:'',createdAt:'',modifiedAt:'',...refs});

describe('People and Dive Entity relationships',()=>{
  it('projects zero, legacy and explicit many-to-many links without duplicating a legacy pair',()=>{
    const people=[person('unlinked'),person('one',{operatorId:'centre',currentDiveOperatorId:'centre'}),person('many',{operatorId:'centre'})];
    const links=[
      {entityId:'l1',personId:'many',operatorId:'centre',role:'Instructor',active:true},
      {entityId:'l2',personId:'many',operatorId:'resort',role:'Guide',active:true},
      {entityId:'l3',personId:'many',operatorId:'boat',role:'Skipper',active:true},
    ];
    const output=api.projectPersonEntityLinks?.(people,links)??[];
    expect(output.map(row=>`${row.personId}|${row.operatorId}|${row.role}|${row.source}`).sort()).toEqual([
      'many|boat|Skipper|explicit','many|centre|Instructor|explicit','many|resort|Guide|explicit','one|centre|Associated|legacy',
    ]);
  });
  it('normalises inverse entity relations into one canonical record and displays the reciprocal label',()=>{
    const canonical=api.normaliseEntityRelation?.({fromOperatorId:'boat',toOperatorId:'centre',relationType:'operated-by'});
    expect(canonical).toMatchObject({fromOperatorId:'centre',toOperatorId:'boat',relationType:'operates'});
    expect(api.entityRelationLabel?.(canonical,'boat')).toBe('operated by');
    expect(api.entityRelationLabel?.(canonical,'centre')).toBe('operates');
  });
  it('rejects self-relations and gives inverse entries the same stable identity',()=>{
    expect(()=>api.normaliseEntityRelation?.({fromOperatorId:'same',toOperatorId:'same',relationType:'uses'})).toThrow(/itself|self/i);
    const forward=api.normaliseEntityRelation?.({fromOperatorId:'centre',toOperatorId:'boat',relationType:'operates'});
    const inverse=api.normaliseEntityRelation?.({fromOperatorId:'boat',toOperatorId:'centre',relationType:'operated-by'});
    expect(api.entityRelationIdentity?.(forward)).toBe(api.entityRelationIdentity?.(inverse));
    expect(api.entityRelationIdentity?.(forward)).toBeTruthy();
  });
  it('clears only an explicitly unlinked legacy pair and leaves another affiliation intact',()=>{
    const p=person('alex',{operatorId:'centre',currentDiveOperatorId:'resort'});
    const original=api.projectPersonEntityLinks?.([p],[])??[];
    const next=original.filter((row:{operatorId:string})=>row.operatorId!=='centre');
    const planned=api.planPersonLinkChanges?.(p,original,next);
    expect(planned?.personPatch).toEqual({operatorId:''});
    expect(planned?.deletes).toEqual([]);
    expect(next.map((row:{operatorId:string})=>row.operatorId)).toEqual(['resort']);
  });
  it('removes only one of several explicit roles and rejects two active primaries',()=>{
    const p=person('alex');
    const original=[{entityId:'instructor',personId:'alex',operatorId:'centre',role:'Instructor',active:true,source:'explicit'},
      {entityId:'guide',personId:'alex',operatorId:'resort',role:'Guide',active:true,source:'explicit'}];
    const planned=api.planPersonLinkChanges?.(p,original,original.slice(1));
    expect(planned?.deletes).toEqual(['instructor']);
    expect(planned?.personPatch).toEqual({});
    expect(()=>api.planPersonLinkChanges?.(p,original,original.map(row=>({...row,primary:true})))).toThrow(/primary/i);
  });
  it('changes a role by creating a new stable link and retiring the old identity',()=>{
    const p=person('alex');
    const old={entityId:'old-id',personId:'alex',operatorId:'centre',role:'Guide',active:true,source:'explicit'};
    const planned=api.planPersonLinkChanges?.(p,[old],[{...old,role:'Instructor'}]);
    expect(planned?.deletes).toEqual(['old-id']);
    expect(planned?.upserts).toEqual([{personId:'alex',operatorId:'centre',role:'Instructor',active:true}]);
  });
  it('persists edits to virtual legacy links without rewriting their historical reference',()=>{
    const p=person('alex',{operatorId:'centre'});
    const original=api.projectPersonEntityLinks?.([p],[])??[];
    const next=original.map((row:any)=>({...row,notes:'Weekend instructor',startDate:'2025-01-01'}));
    const planned=api.planPersonLinkChanges?.(p,original,next);
    expect(planned?.personPatch).toEqual({});
    expect(planned?.upserts).toMatchObject([{personId:'alex',operatorId:'centre',notes:'Weekend instructor',startDate:'2025-01-01'}]);
  });
  it('demotes a legacy current affiliation without losing its historical link',()=>{
    const p=person('alex',{currentDiveOperatorId:'centre'});
    const original=api.projectPersonEntityLinks?.([p],[])??[];
    const next=[{...original[0]!,primary:false},{personId:'alex',operatorId:'resort',role:'Guide',active:true,primary:true,source:'explicit'}];
    const planned=api.planPersonLinkChanges?.(p,original,next);
    expect(planned?.personPatch).toEqual({currentDiveOperatorId:''});
    expect(planned?.upserts).toEqual(expect.arrayContaining([expect.objectContaining({personId:'alex',operatorId:'centre',role:'Associated',primary:false})]));
  });
  it('orders a primary change so the old primary is retired before the new one is promoted',()=>{
    const p=person('alex');
    const old={entityId:'old-primary',personId:'alex',operatorId:'centre',role:'Instructor',active:true,primary:true,source:'explicit'};
    const next=[{...old,primary:false},{personId:'alex',operatorId:'resort',role:'Guide',active:true,primary:true,source:'explicit'}];
    const phases=api.personLinkWritePhases?.(api.planPersonLinkChanges?.(p,[old],next));
    expect(phases?.prepare).toEqual([expect.objectContaining({operatorId:'centre',primary:false})]);
    expect(phases?.promote).toEqual([expect.objectContaining({operatorId:'resort',primary:true})]);
  });
  it('derives current, upcoming and historical status from dates and active state',()=>{
    const on='2026-09-24';
    expect(api.relationshipStatus?.({active:true,startDate:'2026-01-01'},on)).toBe('Current');
    expect(api.relationshipStatus?.({active:true,startDate:'2027-01-01'},on)).toBe('Upcoming');
    expect(api.relationshipStatus?.({active:true,endDate:'2026-01-01'},on)).toBe('Ended');
    expect(api.relationshipStatus?.({active:false},on)).toBe('Inactive');
  });
  it('canonicalises Other reciprocal wording without a duplicate opposite link',()=>{
    const first=api.normaliseEntityRelation?.({fromOperatorId:'centre',toOperatorId:'boat',relationType:'other',forwardLabel:'supports',reverseLabel:'supported by',active:true});
    const opposite=api.normaliseEntityRelation?.({fromOperatorId:'boat',toOperatorId:'centre',relationType:'other',forwardLabel:'supported by',reverseLabel:'supports',active:true});
    expect(first).toMatchObject(opposite);
    expect(api.entityRelationIdentity?.(first)).toBe(api.entityRelationIdentity?.(opposite));
  });
  it('edits a reciprocal link from the selected entity without changing its canonical identity',()=>{
    const canonical=api.normaliseEntityRelation?.({fromOperatorId:'centre',toOperatorId:'boat',relationType:'operates',active:true});
    const forBoat=api.entityRelationForEditor?.(canonical,'boat');
    expect(forBoat).toMatchObject({fromOperatorId:'boat',toOperatorId:'centre',relationType:'operated-by'});
    expect(api.normaliseEntityRelation?.(forBoat)).toMatchObject(canonical);
  });
});
