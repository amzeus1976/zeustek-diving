import type {PersonRecord} from '../offline/dive-planning';
import type {DiveWithId} from '../offline/experience-analytics';
import {personDisplayName} from '../offline/people-profiles';

type Person = PersonRecord & {entityId:string};
export interface TopBuddy {
  person:Person;
  count:number;
  sourceDiveIds:string[];
  source:'logbook'|'owner-selected';
}

/** Explicit saved buddy links only: team membership alone does not establish a buddy. */
export function resolveTopBuddy(people:Person[],dives:DiveWithId[],owner:(Partial<PersonRecord>&{entityId?:string})|null):TopBuddy|null {
  const candidates=people.filter(person=>person.entityId!=='self'&&person.entityId!==owner?.entityId&&!person.roles?.ownerProfile);
  const counts=new Map(candidates.map(person=>[person.entityId,new Set<string>()]));
  for(const dive of dives)for(const id of new Set(dive.buddyIds??[]))counts.get(id)?.add(dive.entityId);
  const preferred=candidates.find(person=>person.entityId===owner?.preferredTopBuddyPersonId);
  const winner=preferred??candidates.filter(person=>counts.get(person.entityId)!.size>0).sort((a,b)=>
    counts.get(b.entityId)!.size-counts.get(a.entityId)!.size||personDisplayName(a).localeCompare(personDisplayName(b))||a.entityId.localeCompare(b.entityId))[0];
  if(!winner)return null;
  const sourceDiveIds=[...counts.get(winner.entityId)!].sort();
  return {person:winner,count:sourceDiveIds.length,sourceDiveIds,source:preferred?'owner-selected':'logbook'};
}
