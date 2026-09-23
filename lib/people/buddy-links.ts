export function buddyInitials(name:string){return name.trim().split(/\s+/u).filter(Boolean).map(part=>Array.from(part)[0]!.toLocaleUpperCase('en-GB')+'.').slice(0,3).join('');}
export function buddyLinkRequest(personId:string,selectedIds:string[],dives:Array<{entityId:string;modifiedAt:string}>){
  const ids=[...new Set(selectedIds)];
  if(!personId||!ids.length||ids.length>200)throw Error('Select between 1 and 200 Dives and a saved Person.');
  return {personId,dives:ids.map(id=>{
    const row=dives.find(dive=>dive.entityId===id),revision=row?Date.parse(row.modifiedAt):NaN;
    if(!Number.isFinite(revision))throw Error('A selected Dive is unavailable. Refresh before linking.');
    return {id,revision};
  })};
}
/** One SQL statement; materialised eligibility is checked before any row is changed. */
export const ATOMIC_BUDDY_LINK_SQL=`
WITH input AS MATERIALIZED (SELECT ? AS selections,? AS owner,? AS person,? AS stamp,? AS total), requested AS MATERIALIZED (SELECT json_extract(value,'$.id') AS id,json_extract(value,'$.revision') AS revision FROM json_each((SELECT selections FROM input))),
eligible AS MATERIALIZED (
 SELECT r.id FROM dive_records r JOIN requested e ON e.id=r.id AND e.revision=r.updated_at
 WHERE r.user_id=(SELECT owner FROM input) AND r.kind='dive' AND r.deleted_at IS NULL
 AND COALESCE(json_type(r.data_json,'$.buddyIds'),'null') IN ('null','array')
 AND COALESCE(json_type(r.data_json,'$.diveTeamIds'),'null') IN ('null','array')
), valid AS MATERIALIZED (SELECT COUNT(*) AS n FROM eligible)
UPDATE dive_records SET data_json=json_set(data_json,
 '$.buddyIds',json(CASE WHEN EXISTS(SELECT 1 FROM json_each(data_json,'$.buddyIds') WHERE value=(SELECT person FROM input))
 THEN json_extract(data_json,'$.buddyIds') ELSE json_insert(COALESCE(json_extract(data_json,'$.buddyIds'),'[]'),'$[#]',(SELECT person FROM input)) END),
 '$.diveTeamIds',json(CASE WHEN EXISTS(SELECT 1 FROM json_each(data_json,'$.diveTeamIds') WHERE value=(SELECT person FROM input))
 THEN json_extract(data_json,'$.diveTeamIds') ELSE json_insert(COALESCE(json_extract(data_json,'$.diveTeamIds'),'[]'),'$[#]',(SELECT person FROM input)) END)
),updated_at=(SELECT stamp FROM input)
WHERE id IN (SELECT id FROM eligible) AND (SELECT n FROM valid)=(SELECT total FROM input)
AND EXISTS(SELECT 1 FROM dive_records p WHERE p.id=(SELECT person FROM input) AND p.user_id=(SELECT owner FROM input) AND p.kind='person' AND p.deleted_at IS NULL AND COALESCE(json_extract(p.data_json,'$.roles.ownerProfile'),0)=0)
`;

