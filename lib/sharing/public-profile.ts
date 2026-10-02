export const PUBLIC_INSIGHTS=[
  ['totalDives','Logged Dives','Dives'],['totalMinutes','Logged dive time','minutes'],
  ['maxDepth','Maximum logged depth','metres'],['highestRecreationalAward','Highest recreational award','display award'],
] as const;
export type PublicInsightKey=typeof PUBLIC_INSIGHTS[number][0];
export type PublicationInput={displayName?:string;biography?:string;insights:PublicInsightKey[];photoId?:string};
export type PublicationSnapshot={version:1;displayName?:string;biography?:string;photoUrl?:string;asOf:string;source:'Owner-selected canonical evidence';insights:Array<{key:PublicInsightKey;label:string;value:string|number;unit:string}>};
export const opaqueId=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export function strictObject(value:unknown,fields:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!fields.includes(key)))throw new Error('Choose only the supported fields.');
  return value as Record<string,unknown>;
}
function text(value:unknown,max:number){if(typeof value!=='string'||value.length>max||Array.from(value).some(character=>character.charCodeAt(0)<32&&![9,10,13].includes(character.charCodeAt(0))))throw new Error('Use bounded plain text.');return value;}
export function validatePublicationInput(value:unknown):PublicationInput{
  const input=strictObject(value,['displayName','biography','insights','photoId']);
  if(!Array.isArray(input.insights)||input.insights.length>PUBLIC_INSIGHTS.length||input.insights.some(item=>!PUBLIC_INSIGHTS.some(([key])=>key===item))||new Set(input.insights).size!==input.insights.length)throw new Error('Select the supported Insights once each.');
  const result:PublicationInput={insights:input.insights as PublicInsightKey[]};
  if(input.displayName!==undefined)result.displayName=text(input.displayName,80);
  if(input.biography!==undefined)result.biography=text(input.biography,4000);
  if(input.photoId!==undefined){if(!opaqueId(input.photoId))throw new Error('Choose an approved photo derivative.');result.photoId=input.photoId;}
  return result;
}
/** Validate stored artifacts too: a corrupted snapshot must never become a record serializer. */
export function validatePublicationSnapshot(value:unknown):PublicationSnapshot{
  const object=strictObject(value,['version','displayName','biography','photoUrl','asOf','source','insights']);
  if(object.version!==1||object.source!=='Owner-selected canonical evidence'||typeof object.asOf!=='string'||!Number.isFinite(Date.parse(object.asOf)))throw new Error('Invalid publication.');
  if(object.displayName!==undefined)text(object.displayName,80);
  if(object.biography!==undefined)text(object.biography,4000);
  if(object.photoUrl!==undefined&&(typeof object.photoUrl!=='string'||!/^\/api\/public-profile\/photo\?id=[a-f0-9-]{36}$/.test(object.photoUrl)||!opaqueId(object.photoUrl.split('=')[1])))throw new Error('Invalid photo.');
  if(!Array.isArray(object.insights)||object.insights.length>4)throw new Error('Invalid Insights.');
  const seen=new Set();for(const item of object.insights){const insight=strictObject(item,['key','label','value','unit']);const definition=PUBLIC_INSIGHTS.find(([key])=>key===insight.key);if(!definition||seen.has(insight.key)||insight.label!==definition[1]||insight.unit!==definition[2])throw new Error('Invalid Insight.');seen.add(insight.key);if(insight.key==='highestRecreationalAward')text(insight.value,180);else if(['maxDepth','totalMinutes'].includes(String(insight.key))&&insight.value==='Not recorded')continue;else if(typeof insight.value!=='number'||!Number.isFinite(insight.value)||insight.value<0||insight.value>10000000)throw new Error('Invalid Insight value.');}
  return object as unknown as PublicationSnapshot;
}
