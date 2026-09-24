/** Relationships are canonical records in dive_records, never embedded copies of endpoints. */
export interface PersonEntityLink {
  entityId?:string;
  personId:string;
  operatorId:string;
  role:string;
  active:boolean;
  primary?:boolean;
  startDate?:string;
  endDate?:string;
  notes?:string;
  createdAt?:string;
  modifiedAt?:string;
}
export interface EntityRelation {
  entityId?:string;
  fromOperatorId:string;
  toOperatorId:string;
  relationType:string;
  active:boolean;
  startDate?:string;
  endDate?:string;
  notes?:string;
  forwardLabel?:string;
  reverseLabel?:string;
  createdAt?:string;
  modifiedAt?:string;
}
export type ProjectedPersonEntityLink=PersonEntityLink & {source:'explicit'|'legacy'};
export function relationshipStatus(link:Pick<PersonEntityLink,'active'|'startDate'|'endDate'>,on=new Date().toISOString().slice(0,10)):'Current'|'Upcoming'|'Ended'|'Inactive'{
  if(link.active===false)return 'Inactive';
  if(link.startDate&&link.startDate>on)return 'Upcoming';
  if(link.endDate&&link.endDate<on)return 'Ended';
  return 'Current';
}
type LegacyPerson={entityId:string;operatorId?:string;currentDiveOperatorId?:string};

export function projectPersonEntityLinks(people:ReadonlyArray<LegacyPerson>,links:ReadonlyArray<PersonEntityLink>):ProjectedPersonEntityLink[]{
  const ids=new Set(people.map(person=>person.entityId));
  const explicit=links.filter(link=>ids.has(link.personId)&&Boolean(link.operatorId));
  const explicitPairs=new Set(explicit.map(link=>`${link.personId}\u0000${link.operatorId}`));
  const projected:ProjectedPersonEntityLink[]=explicit.map(link=>({...link,source:'explicit'}));
  for(const person of people){
    for(const operatorId of new Set([person.operatorId,person.currentDiveOperatorId].filter((id):id is string=>Boolean(id)))){
      const pair=`${person.entityId}\u0000${operatorId}`;
      if(explicitPairs.has(pair))continue;
      projected.push({personId:person.entityId,operatorId,role:'Associated',active:true,primary:person.currentDiveOperatorId===operatorId,source:'legacy'});
    }
  }
  return projected;
}

const inverse:Record<string,string>={
  'operated-by':'operates','owned-by':'owns','hosts':'based-at','contains':'part-of','used-by':'uses',
  'boat-provided-by':'provides-boat-for','has-resort-dive-centre':'resort-dive-centre','charters':'chartered-by',
};
const labels:Record<string,readonly [string,string]>={
  operates:['operates','operated by'],owns:['owns','owned by'],'based-at':['based at','hosts'],'part-of':['part of','contains'],
  'associated-with':['associated with','associated with'],'affiliated-with':['affiliated with','affiliated with'],
  uses:['uses','used by'],'provides-boat-for':['provides boat for','boat provided by'],
  'resort-dive-centre':['resort dive centre for','has resort dive centre'],
  'training-partner':['training partner of','training partner of'],'chartered-by':['chartered by','charters'],
  other:['other','other'],
};
const symmetric=new Set(['associated-with','affiliated-with','training-partner']);
export const ENTITY_RELATION_TYPES=Object.keys(labels) as ReadonlyArray<keyof typeof labels>;

export function normaliseEntityRelation(input:Omit<EntityRelation,'active'> & {active?:boolean}):EntityRelation{
  let fromOperatorId=input.fromOperatorId.trim(),toOperatorId=input.toOperatorId.trim(),relationType=input.relationType;
  let forwardLabel=input.forwardLabel,reverseLabel=input.reverseLabel;
  if(!fromOperatorId||!toOperatorId)throw new Error('Select both Dive Entities.');
  if(fromOperatorId===toOperatorId)throw new Error('A Dive Entity cannot link to itself.');
  if(inverse[relationType]){[fromOperatorId,toOperatorId]=[toOperatorId,fromOperatorId];relationType=inverse[relationType]!;}
  if(!labels[relationType])throw new Error('Choose a supported relationship type.');
  if(symmetric.has(relationType)&&fromOperatorId>toOperatorId)[fromOperatorId,toOperatorId]=[toOperatorId,fromOperatorId];
  if(relationType==='other'&&(!input.forwardLabel?.trim()||!input.reverseLabel?.trim()))throw new Error('Describe both directions of the Other relationship.');
  if(relationType==='other'&&fromOperatorId>toOperatorId){[fromOperatorId,toOperatorId]=[toOperatorId,fromOperatorId];[forwardLabel,reverseLabel]=[reverseLabel,forwardLabel];}
  if(input.startDate&&input.endDate&&input.endDate<input.startDate)throw new Error('End date must follow the start date.');
  return {...input,fromOperatorId,toOperatorId,relationType,...(forwardLabel!==undefined?{forwardLabel}:{}),...(reverseLabel!==undefined?{reverseLabel}:{}),active:input.active!==false};
}
export function entityRelationIdentity(input:Pick<EntityRelation,'fromOperatorId'|'toOperatorId'|'relationType'>){
  const relation=normaliseEntityRelation({...input,...(input.relationType==='other'?{forwardLabel:'forward',reverseLabel:'reverse'}:{}),active:true});
  return `operator-operator-link:${encodeURIComponent(relation.fromOperatorId)}:${encodeURIComponent(relation.relationType)}:${encodeURIComponent(relation.toOperatorId)}`;
}
export function entityRelationLabel(input:EntityRelation,operatorId:string){
  const relation=normaliseEntityRelation(input);
  if(operatorId!==relation.fromOperatorId&&operatorId!==relation.toOperatorId)throw new Error('Entity is not part of this relationship.');
  const forward=operatorId===relation.fromOperatorId;
  if(relation.relationType==='other')return forward?relation.forwardLabel!.trim():relation.reverseLabel!.trim();
  return labels[relation.relationType]![forward?0:1];
}
/** Orient a canonical relationship for editing from either selected endpoint. */
export function entityRelationForEditor(link:EntityRelation,operatorId:string):EntityRelation{
  const canonical=normaliseEntityRelation(link);
  if(canonical.fromOperatorId===operatorId)return canonical;
  if(canonical.toOperatorId!==operatorId)throw new Error('Entity is not part of this relationship.');
  const reversed=Object.entries(inverse).find(([,value])=>value===canonical.relationType)?.[0]??canonical.relationType;
  return {...canonical,fromOperatorId:operatorId,toOperatorId:canonical.fromOperatorId,relationType:reversed,
    ...(canonical.relationType==='other'?{forwardLabel:canonical.reverseLabel!,reverseLabel:canonical.forwardLabel!}:{})};
}
export function personEntityLinkIdentity(link:Pick<PersonEntityLink,'personId'|'operatorId'|'role'>){
  const role=link.role.normalize('NFKC').trim().toLocaleLowerCase('en-GB').replace(/\s+/g,' ');
  if(!link.personId||!link.operatorId||!role)throw new Error('Select a Person, Dive Entity and role.');
  return `person-operator-link:${encodeURIComponent(link.personId)}:${encodeURIComponent(link.operatorId)}:${encodeURIComponent(role)}`;
}

type DraftLink=PersonEntityLink & {source?:string};
export function planPersonLinkChanges(person:LegacyPerson,original:ReadonlyArray<DraftLink>,next:ReadonlyArray<DraftLink>){
  const primaries=next.filter(link=>link.active&&link.primary);
  if(primaries.length>1)throw new Error('Choose only one active primary affiliation.');
  const identities=new Set<string>();
  for(const link of next){
    if(link.personId!==person.entityId)throw new Error('This relationship belongs to another Person.');
    const identity=personEntityLinkIdentity(link);
    if(identities.has(identity))throw new Error('This Person already has that role at the Dive Entity.');
    identities.add(identity);
    if(link.startDate&&link.endDate&&link.endDate<link.startDate)throw new Error('End date must follow the start date.');
  }
  const remainingPairs=new Set(next.map(link=>link.operatorId));
  const personPatch:Partial<LegacyPerson>={};
  if(person.operatorId&&!remainingPairs.has(person.operatorId))personPatch.operatorId='';
  if(person.currentDiveOperatorId&&!remainingPairs.has(person.currentDiveOperatorId))personPatch.currentDiveOperatorId='';
  else if(person.currentDiveOperatorId&&original.some(link=>link.source==='legacy'&&link.operatorId===person.currentDiveOperatorId&&link.primary)&&!next.some(link=>link.operatorId===person.currentDiveOperatorId&&link.primary))personPatch.currentDiveOperatorId='';
  const oldById=new Map(original.filter(link=>link.entityId).map(link=>[link.entityId!,link]));
  const kept=new Set(next.filter(link=>link.entityId&&link.source==='explicit'&&oldById.has(link.entityId)&&personEntityLinkIdentity(oldById.get(link.entityId)!)===personEntityLinkIdentity(link)).map(link=>link.entityId));
  const deletes=original.filter(link=>link.entityId&&link.source==='explicit'&&!kept.has(link.entityId)).map(link=>link.entityId!);
  const upserts=next.filter(link=>{
    if(link.source==='legacy'){
      const legacy=original.find(old=>old.source==='legacy'&&old.personId===link.personId&&old.operatorId===link.operatorId);
      if(legacy&&JSON.stringify(legacy)===JSON.stringify(link))return false;
    }
    const old=link.entityId?oldById.get(link.entityId):undefined;
    return !old||JSON.stringify(old)!==JSON.stringify(link);
  }).map(({source: _source,...link})=>{
    const previous=link.entityId?oldById.get(link.entityId):undefined;
    if(previous&&personEntityLinkIdentity(previous)!==personEntityLinkIdentity(link)){
      const {entityId: _entityId,...replacement}=link;return replacement;
    }
    return link;
  });
  return {personPatch,deletes,upserts};
}

/** Retire the previous primary before promoting its replacement. */
export function personLinkWritePhases(plan:ReturnType<typeof planPersonLinkChanges>){
  return {
    prepare:plan.upserts.filter(link=>!(link.active&&link.primary)),
    retire:plan.deletes,
    promote:plan.upserts.filter(link=>link.active&&link.primary),
  };
}
