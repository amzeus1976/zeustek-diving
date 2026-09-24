import type {CertificationRecord,PersonRecord} from '../offline/dive-planning';
import {personCertificationEvidence,qualificationDisplayPriority} from './certification-evidence';
import {findOwnerProfile,personDisplayName} from '../offline/people-profiles';

type StoredPerson=PersonRecord & {entityId:string};
type TeamRecord={diveTeamIds?:readonly string[];buddyIds?:readonly string[];diveLeaderId?:string};

/** The owner remains a Person, but the Dive record represents that human as `self`. */
export function ownerDiveQualification(owner:StoredPerson,certifications:readonly CertificationRecord[]){
  const profileTitles=[owner.highestKnownQualification,owner.highestProfessionalCertification,
    owner.highestTechnicalCertification,owner.highestRecreationalCertification].filter((title):title is string=>Boolean(title?.trim()));
  const awardTitles=personCertificationEvidence(owner,[...certifications]).map(cert=>({
    title:cert.certification||cert.level||'',priority:qualificationDisplayPriority(cert.certification||cert.level||'',cert.awardPriority),
  }));
  const candidates=[...profileTitles.map(title=>({title,priority:qualificationDisplayPriority(title)})),...awardTitles]
    .filter(candidate=>candidate.title.trim())
    .sort((a,b)=>b.priority-a.priority);
  return candidates[0]?.title||owner.highestQualification||'';
}

export function diveTeamCandidates(people:readonly StoredPerson[],certifications:readonly CertificationRecord[]){
  const owner=findOwnerProfile([...people]);
  const qualification=owner?ownerDiveQualification(owner,certifications):'';
  return [
    {id:'self',label:qualification?`Me · ${qualification}`:'Me',person:owner},
    ...people.filter(person=>person.entityId!==owner?.entityId).map(person=>({
      id:person.entityId,
      label:`${personDisplayName(person)} · ${person.highestKnownQualification || person.highestQualification || person.role}`,
      person,
    })),
  ];
}

/** Pure read/edit projection. Historical Dive records are never rewritten on load. */
export function normaliseDiveTeamIdentity(record:TeamRecord,ownerPersonId?:string){
  const canonical=(id:string)=>ownerPersonId&&id===ownerPersonId?'self':id;
  const diveTeamIds=[...new Set((record.diveTeamIds??record.buddyIds??[]).filter(Boolean).map(canonical))];
  const team=new Set(diveTeamIds);
  const buddyIds=[...new Set((record.buddyIds??[]).filter(Boolean).map(canonical))].filter(id=>id!=='self'&&team.has(id));
  const diveLeaderId=record.diveLeaderId?canonical(record.diveLeaderId):'';
  return {diveTeamIds,buddyIds,diveLeaderId};
}
