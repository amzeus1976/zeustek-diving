import {KNOWLEDGE_TOPICS} from '../knowledge-tests';

export const TOPIC_FAMILIES=['knowledge','bibliography','news','skills','training','dives','sites'] as const;
export type TopicFamily=typeof TOPIC_FAMILIES[number];
export type TopicSettings={version:1;query:string;mode:'explicit-and-text'|'explicit-only';sources:TopicFamily[]};
export const DEFAULT_TOPIC_SETTINGS:TopicSettings={version:1,query:'',mode:'explicit-and-text',sources:[...TOPIC_FAMILIES]};
export interface TopicRecord {kind:string;id:string;data:Record<string,unknown>}
export interface TopicCoverage {kind:string;state:'complete'|'unknown';reason?:string}
export interface TopicSnapshot {accountId:string;snapshotAt:string;records:TopicRecord[];coverage:TopicCoverage[]}
export interface TopicItem {
 id:string;recordId:string;kind:string;family:TopicFamily;title:string;status:string;date?:string;
 matchClass:'Explicit topic'|'Recorded text match'|'Exact saved relationship';field:string;reason:string;
 details:Array<{label:string;value:string}>;relatedIds:string[];url?:string;questionId?:string;setId?:string;setVersion?:number;
}
export interface TopicProjection {query:string;topics:string[];items:TopicItem[];partial:boolean;unavailableReferences:number;truncated:boolean;snapshotAt:string}
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max=2000)=>typeof value==='string'?Array.from(value).filter(char=>{const code=char.charCodeAt(0);return code!==127&&(code>=32||code===9||code===10||code===13);}).join('').slice(0,max).trim():'';
const strings=(value:unknown)=>Array.isArray(value)?value.filter((item):item is string=>typeof item==='string').slice(0,100):[];
export const normaliseTopicLabel=(value:string)=>value.normalize('NFKC').trim().toLocaleLowerCase('en-GB').replace(/\s+/g,' ');
export function topicSourceUrl(value:unknown){
 if(typeof value!=='string'||value.length>2000)return undefined;
 try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}
}
export function validateTopicSettings(value:unknown):value is TopicSettings {
 if(!object(value)||Object.keys(value).some(key=>!['version','query','mode','sources'].includes(key)))return false;
 return value.version===1&&typeof value.query==='string'&&value.query.length<=160&&
  ['explicit-and-text','explicit-only'].includes(String(value.mode))&&Array.isArray(value.sources)&&value.sources.length<=TOPIC_FAMILIES.length&&
  new Set(value.sources).size===value.sources.length&&value.sources.every(item=>TOPIC_FAMILIES.includes(item as TopicFamily));
}

/** Pure, bounded projection. No embeddings, inferred associations, note indexing or canonical writes. */
export function buildTopicProjection(snapshot:TopicSnapshot,options:Omit<TopicSettings,'version'>&{includedDiveIds:readonly string[]}):TopicProjection {
 if(!validateTopicSettings({version:1,query:options.query,mode:options.mode,sources:options.sources}))throw new Error('Use a topic of at most 160 characters and supported sources.');
 const query=normaliseTopicLabel(options.query),selected=new Set(options.sources),scope=new Set(options.includedDiveIds),items:TopicItem[]=[];
 const records=snapshot.records.filter(row=>row.id&&object(row.data)&&!row.data.suppressedFromUse&&row.data.state!=='deleted'&&!row.data.deletedAt);
 const result:TopicProjection={query:options.query.trim(),topics:[],items,partial:snapshot.coverage.some(row=>row.state==='unknown'),unavailableReferences:0,truncated:false,snapshotAt:snapshot.snapshotAt};
 const labels=new Map<string,string>();
 const label=(value:unknown)=>{const recorded=text(value,160),key=normaliseTopicLabel(recorded);if(key&&!labels.has(key)&&labels.size<2000)labels.set(key,recorded);};
 KNOWLEDGE_TOPICS.forEach(label);
 const detail=(label:string,value:unknown)=>({label,value:text(value)||'Not recorded'});
 const match=(explicit:readonly string[],fields:Array<[string,unknown]>):{matchClass:TopicItem['matchClass'];field:string;reason:string}|null=>{
  if(!query)return null;
  for(const recorded of explicit)if(normaliseTopicLabel(recorded)===query)return {matchClass:'Explicit topic' as const,field:'Recorded topic',reason:'The recorded topic exactly matches the selected label.'};
  if(options.mode==='explicit-only')return null;
  for(const [field,value] of fields)if(normaliseTopicLabel(text(value)).includes(query))return {matchClass:'Recorded text match' as const,field,reason:`The recorded ${field.toLowerCase()} contains the selected phrase; this is a text match, not an inferred relationship.`};
  return null;
 };
 const add=(row:TopicRecord,family:TopicFamily,title:string,status:string,matching:ReturnType<typeof match>,details:TopicItem['details'],extra:Partial<TopicItem>={})=>{
  if(!matching||!selected.has(family))return;
  if(items.length>=10000){result.truncated=true;result.partial=true;return;}
  items.push({id:JSON.stringify([row.kind,row.id,extra.questionId??'']),recordId:row.id,kind:row.kind,family,title:title||'Untitled saved record',status:status||'Not recorded',...matching,details,relatedIds:[],...extra});
 };
 const latest=new Map<string,TopicRecord[]>(),reviews=records.filter(row=>row.kind==='question-review-state');
 for(const row of records.filter(row=>row.kind==='question-set')){
  const data=row.data;if(data.format!=='zeustek-question-set'||data.schemaVersion!==1||!text(data.setId)||!Number.isSafeInteger(data.version)||Number(data.version)<1||!Array.isArray(data.questions)){result.partial=true;continue;}
  const key=text(data.setId),previous=latest.get(key)??[],version=Number(previous[0]?.data.version??0);
  if(Number(data.version)>version)latest.set(key,[row]);else if(Number(data.version)===version)latest.set(key,[...previous,row]);
 }
 for(const banks of latest.values()){
  if(banks.length!==1){result.unavailableReferences++;result.partial=true;continue;}
  const row=banks[0]!,data=row.data;if(data.reviewed!==true)continue;
  const questions=data.questions as unknown[],seen=new Set<string>();
  if(questions.length>3000){result.partial=true;result.truncated=true;}
  for(const input of questions.slice(0,3000)){
   if(!object(input)||!text(input.id)||seen.has(text(input.id))){result.partial=true;continue;}seen.add(text(input.id));
   if(reviews.some(review=>review.data.setId===data.setId&&review.data.setVersion===data.version&&review.data.questionId===input.id&&review.data.usageState==='suppressed'))continue;
   label(input.topic);label(input.exactTopic);
   add(row,'knowledge',`${text(data.title,180)} · ${text(input.prompt,240)}`,'Current reviewed question',match([text(input.topic),text(input.exactTopic)],[['Question',input.prompt],['Objective',input.objective]]),[
    detail('Bank',data.title),detail('Bank identity',data.setId),detail('Version',String(data.version)),detail('Question',input.prompt),detail('Explanation',input.explanation),detail('Recorded provenance',input.provenance),
   ],{questionId:text(input.id),setId:text(data.setId),setVersion:Number(data.version)});
  }
 }
 for(const row of records.filter(row=>row.kind==='test-attempt')){
  if(!Array.isArray(row.data.questions)){result.partial=true;continue;}
  if(row.data.questions.length>3000){result.partial=true;result.truncated=true;}
  for(const input of row.data.questions.slice(0,3000)){
   if(!object(input)||!text(input.id)||!text(input.setId)||!Number.isSafeInteger(input.setVersion)){result.partial=true;continue;}
   label(input.topic);label(input.exactTopic);
   add(row,'knowledge',text(input.prompt,240),'Historical attempt snapshot',match([text(input.topic),text(input.exactTopic)],[['Question',input.prompt]]),[
    detail('Question',input.prompt),detail('Explanation in saved attempt',input.explanation),detail('Recorded provenance',input.provenance),detail('Completed',row.data.completedAt),detail('Bank identity',input.setId),detail('Saved version',String(input.setVersion)),
   ],{questionId:text(input.id),setId:text(input.setId),setVersion:Number(input.setVersion),date:text(row.data.completedAt)});
  }
 }
 const skillRows=records.filter(row=>row.kind==='skill'),skillAliases=new Map<string,TopicRecord[]>();
 for(const skill of skillRows){for(const alias of new Set([skill.id,text(skill.data.skillKey),text(skill.data.key)].filter(Boolean)))skillAliases.set(alias,[...(skillAliases.get(alias)??[]),skill]);}
 for(const row of records){const data=row.data;
  if(row.kind==='dive-media'){
   const topics=strings(data.topics);topics.forEach(label);
   const url=topicSourceUrl(data.url);add(row,'bibliography',text(data.title,240),text(data.status),match(topics,[['Title',data.title],['Creator',data.creator],['Format',data.format]]),[detail('Title',data.title),detail('Creator',data.creator),detail('Format',data.format),detail('Status',data.status),detail('Recorded topics',topics.join(', '))],url?{url}:{});
  }else if(row.kind==='news-article'){
   const url=topicSourceUrl(data.link);add(row,'news',text(data.title,240),text(data.state),match([], [['Title',data.title],['Summary',data.summary],['Publisher',data.source]]),[detail('Title',data.title),detail('Summary',data.summary),detail('Publisher',data.source),detail('Published',data.publishedAt),detail('State',data.state)],{...(url?{url}:{}),date:text(data.publishedAt)});
  }else if(row.kind==='skill'){
   label(data.group);const name=text(data.name)||text(data.title);
   add(row,'skills',name,data.archived?'Archived Skill':'Skill catalogue',match([text(data.group)],[['Skill name',name],['Description',data.description]]),[detail('Name',name),detail('Group',data.group),detail('Description',data.description)]);
  }else if(row.kind==='training-progress'){
   add(row,'training',text(data.courseTitle,240),text(data.status),match([], [['Course title',data.courseTitle],['Agency',data.agency]]),[detail('Course title',data.courseTitle),detail('Agency',data.agency),detail('Course reference',data.courseId),detail('Saved status',data.status)]);
  }else if(row.kind==='certification'){
   const owners=records.filter(person=>person.kind==='person'&&object(person.data.roles)&&person.data.roles.ownerProfile===true);
   if(owners.length!==1||data.personId&&data.personId!==owners[0]!.id)continue;
   add(row,'training',text(data.title,240)||text(data.name,240),'Recorded owner award',match([], [['Award title',data.title??data.name],['Agency',data.agency]]),[detail('Award title',data.title??data.name),detail('Agency',data.agency),detail('Recorded award date',data.date)]);
  }
 }
 const diveRows=records.filter(row=>row.kind==='dive'&&scope.has(row.id)),diveById=new Map(diveRows.map(row=>[row.id,row]));
 const relevantDiveIds=new Set<string>();
 for(const row of diveRows){
  const types=strings(row.data.diveTypes);types.forEach(label);const matching=match(types,[]);
  if(matching){relevantDiveIds.add(row.id);add(row,'dives',`${text(row.data.date)} · ${text(row.data.site,180)}`,'Recorded Dive',matching,[detail('Date',row.data.date),detail('Site',row.data.site),detail('Recorded Dive types',types.join(', '))]);}
 }
 for(const row of records.filter(row=>row.kind==='skill_evidence')){
  const diveId=text(row.data.diveId);if(diveId&&!scope.has(diveId))continue;
  const candidates=skillAliases.get(text(row.data.skillKey))??[];
  if(candidates.length!==1){result.unavailableReferences++;continue;}
  const skill=candidates[0]!,name=text(skill.data.name)||text(skill.data.title),skillMatch=match([text(skill.data.group)],[['Skill name',name],['Description',skill.data.description]]);
  if(!skillMatch)continue;
  if(diveId&&!diveById.has(diveId)){result.unavailableReferences++;continue;}
  if(diveId)relevantDiveIds.add(diveId);
  add(row,'skills',name,'Recorded practice evidence',{matchClass:'Exact saved relationship',field:'Saved Skill reference',reason:'The evidence references this exact canonical Skill or its unambiguous saved alias. Practice is not a qualification.'},[detail('Skill',name),detail('Performed',row.data.performedAt),detail('Recorded assessment',row.data.assessment)],{relatedIds:[skill.id,...(diveId?[diveId]:[])],date:text(row.data.performedAt)});
 }
 for(const id of relevantDiveIds){const row=diveById.get(id);if(!row)continue;
  if(!items.some(item=>item.kind==='dive'&&item.recordId===id))add(row,'dives',`${text(row.data.date)} · ${text(row.data.site,180)}`,'Recorded Dive',{matchClass:'Exact saved relationship',field:'Skill evidence Dive reference',reason:'A matching saved practice record references this exact scoped Dive.'},[detail('Date',row.data.date),detail('Site',row.data.site)]);
 }
 const siteIds=new Map<string,string[]>();
 for(const diveId of relevantDiveIds){const siteId=text(diveById.get(diveId)?.data.siteId);if(siteId)siteIds.set(siteId,[...(siteIds.get(siteId)??[]),diveId]);}
 for(const [siteId,diveIds] of siteIds){const row=records.find(row=>row.kind==='site'&&row.id===siteId);if(!row){result.unavailableReferences++;continue;}
  add(row,'sites',text(row.data.name,240),'Recorded Site',{matchClass:'Exact saved relationship',field:'Saved Dive Site reference',reason:'A matching scoped Dive references this exact canonical Site; its name did not establish the relationship.'},[detail('Site',row.data.name),detail('Linked scoped Dives',String(diveIds.length))],{relatedIds:diveIds});
 }
 result.topics=[...labels.values()].sort((a,b)=>a.localeCompare(b,'en-GB'));
 items.sort((a,b)=>a.recordId.localeCompare(b.recordId,'en-GB')||a.id.localeCompare(b.id,'en-GB'));
 return result;
}
