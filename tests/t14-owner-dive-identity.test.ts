import {describe,expect,it} from 'vitest';
import {diveTeamCandidates,normaliseDiveTeamIdentity,ownerDiveQualification} from '../lib/people/dive-team-identity';
import type {CertificationRecord,PersonRecord} from '../lib/offline/dive-planning';

const person=(entityId:string,name:string,role:PersonRecord['role']='buddy'):PersonRecord&{entityId:string}=>({entityId,name,role,agency:'',highestQualification:'',membershipNumber:'',email:'',phone:'',emergencyContact:'',notes:'',createdAt:'',modifiedAt:''});
const owner={...person('owner-person','Zeus'),roles:{ownerProfile:true},highestQualification:'Master Scuba dive'};
const gemma=person('gemma','Gemma Brown');
const instructor=person('instructor','Michael J Hill','instructor');

describe('one canonical owner identity in Dive records',()=>{
  it('keeps the owner Person in People while exposing only one self team candidate',()=>{
    const people=[owner,gemma,instructor];
    const candidates=diveTeamCandidates(people,[]);
    expect(people).toHaveLength(3);
    expect(candidates.map(person=>person.id)).toEqual(['self','gemma','instructor']);
    expect(candidates.filter(person=>person.id==='self')).toHaveLength(1);
    expect(candidates[0]?.label).toMatch(/^Me/);
  });
  it('prefers canonical certification evidence for the Me qualification without rewriting Person source',()=>{
    const original=owner.highestQualification;
    const certificates=[{personId:'owner-person',certification:'Master Scuba Diver',level:'',courseType:'recreational',issuedAt:'2025-01-01'}] as unknown as CertificationRecord[];
    expect(ownerDiveQualification(owner,certificates)).toBe('Master Scuba Diver');
    expect(diveTeamCandidates([owner,gemma],certificates)[0]?.label).toBe('Me · Master Scuba Diver');
    expect(owner.highestQualification).toBe(original);
  });
  it.each([
    [{diveTeamIds:['self'],buddyIds:[],diveLeaderId:'self'},['self']],
    [{diveTeamIds:['owner-person'],buddyIds:[],diveLeaderId:'owner-person'},['self']],
    [{diveTeamIds:['self','owner-person','gemma'],buddyIds:['owner-person','gemma'],diveLeaderId:'owner-person'},['self','gemma']],
  ] as const)('normalises historical owner team IDs on read and future save', (input,team)=>{
    const before=JSON.stringify(input);
    const result=normaliseDiveTeamIdentity(input,'owner-person');
    expect(result.diveTeamIds).toEqual(team);
    expect(result.buddyIds).not.toContain('owner-person');
    expect(result.buddyIds).not.toContain('self');
    expect(result.diveLeaderId).toBe('self');
    expect(JSON.stringify(input)).toBe(before); // read compatibility does not mutate the record
  });
  it('allows a selected instructor as buddy but never allows the owner as their own buddy',()=>{
    const result=normaliseDiveTeamIdentity({diveTeamIds:['owner-person','gemma','instructor'],buddyIds:['owner-person','self','instructor','not-in-team'],diveLeaderId:'instructor'},'owner-person');
    expect(result).toEqual({diveTeamIds:['self','gemma','instructor'],buddyIds:['instructor'],diveLeaderId:'instructor'});
  });
  it('keeps non-owner team candidates and resolves a legacy owner leader to self',()=>{
    expect(diveTeamCandidates([owner,gemma,instructor],[]).map(person=>person.id)).toEqual(['self','gemma','instructor']);
    expect(normaliseDiveTeamIdentity({diveTeamIds:['gemma'],buddyIds:['gemma'],diveLeaderId:'owner-person'},'owner-person').diveLeaderId).toBe('self');
  });
});
