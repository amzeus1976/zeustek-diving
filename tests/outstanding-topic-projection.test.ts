import {describe,expect,it} from 'vitest';
import {buildTopicProjection,normaliseTopicLabel,topicSourceUrl,type TopicRecord,type TopicSnapshot} from '../lib/insights/topic-explorer';
import {ANALYSIS_CARD_REGISTRY,DEFAULT_ANALYSIS_CARDS,normaliseAnalysisCards,validateAnalysisCards} from '../lib/insights/analysis-card-registry';
const row=(kind:string,id:string,data:Record<string,unknown>):TopicRecord=>({kind,id,data:{entityId:id,...data}});
const question=(id:string,topic='Buoyancy')=>({id,topic,exactTopic:topic,prompt:'Buoyancy practice',explanation:'Recorded explanation',provenance:'Recorded source',type:'single-choice',difficulty:'foundation',options:['A','B','C','D'],answers:['A']});
const bank=(id:string,version:number,reviewed=true)=>row('question-set',id,{format:'zeustek-question-set',schemaVersion:1,setId:'bank',version,title:'Bank',reviewed,questions:[question('q')]});
const snapshot=(records:TopicRecord[]):TopicSnapshot=>({accountId:'owner',snapshotAt:'2026-10-03T00:00:00Z',records,coverage:[]});
const project=(records:TopicRecord[],patch:Partial<Parameters<typeof buildTopicProjection>[1]>={})=>buildTopicProjection(snapshot(records),{query:'Buoyancy',mode:'explicit-and-text',sources:['knowledge','bibliography','news','skills','training','dives','sites'],includedDiveIds:['d1'],...patch});
describe('approved Topic Explorer canonical projection',()=>{
 it('discovers normalized recorded labels, without merging canonical source records',()=>{
  expect(normaliseTopicLabel('  ＢＵＯＹＡＮＣＹ\t skills ')).toBe('buoyancy skills');
  const result=project([row('dive-media','m1',{title:'Book',topics:['Ｂｕｏｙａｎｃｙ']}),row('dive-media','m2',{title:'Another',topics:['buoyancy'],url:'https://example.invalid/book'})]);
  expect(result.items.map(item=>item.recordId)).toEqual(['m1','m2']);expect(result.topics.filter(topic=>normaliseTopicLabel(topic)==='buoyancy')).toHaveLength(1);
 });
 it('supports all five source families with explicit provenance and safe recorded URLs',()=>{
  const result=project([bank('b',1),row('dive-media','m',{title:'Book',creator:'Author',topics:['Buoyancy'],url:'https://example.invalid/book'}),row('news-article','n',{title:'Buoyancy news',source:'Publisher',summary:'Recorded story',state:'saved',link:'https://example.invalid/news'}),row('skill','s',{name:'Buoyancy',group:'Buoyancy & trim'}),row('training-progress','t',{agency:'PADI',courseTitle:'Buoyancy',courseId:'peak',status:'planned'})]);
  expect(new Set(result.items.map(item=>item.family))).toEqual(new Set(['knowledge','bibliography','news','skills','training']));
  expect(result.items.every(item=>item.matchClass&&item.reason&&item.details.length)).toBe(true);
  expect(result.items.find(item=>item.recordId==='n')?.matchClass).toBe('Recorded text match');
  expect(result.items.find(item=>item.recordId==='m')?.matchClass).toBe('Explicit topic');
 });
 it('does not index notes, recommendation prose, credentials or arbitrary nested fields',()=>{
  const records=[row('dive-media','m',{title:'Unrelated',topics:[],notes:'Buoyancy',recommendedFor:'Buoyancy',secret:'Buoyancy'}),row('news-article','n',{title:'Other',summary:'Other',notes:'Buoyancy',state:'saved'}),row('gmail-connection','secret',{title:'Buoyancy',token:'dummy-secret'})];
  expect(project(records).items).toEqual([]);
  expect(JSON.stringify(project(records))).not.toMatch(/dummy-secret|recommendedFor|notes/);
 });
 it('keeps current reviewed bank version and suppresses exact question identity',()=>{
  const result=project([bank('b1',1),bank('b2',2),row('question-review-state','r',{setId:'bank',setVersion:2,questionId:'q',usageState:'suppressed'})]);
  expect(result.items.filter(item=>item.family==='knowledge')).toEqual([]);
  expect(project([bank('b1',1),bank('b2',2,false)]).items).toEqual([]);
  expect(project([bank('b1',1),bank('b2',2)]).items).toMatchObject([{recordId:'b2',questionId:'q',setVersion:2}]);
 });
 it('preserves historical attempt snapshots instead of remapping them to a current bank',()=>{
  const result=project([bank('b',3),row('test-attempt','attempt',{completedAt:'2026-01-01T12:00:00Z',questions:[{...question('q'),prompt:'Historical buoyancy question',setId:'bank',setVersion:1,correct:true}]})]);
  const historical=result.items.find(item=>item.recordId==='attempt');
  expect(historical).toMatchObject({status:'Historical attempt snapshot',setVersion:1,questionId:'q'});
  expect(historical?.details).toContainEqual({label:'Question',value:'Historical buoyancy question'});
 });
 it('scope exclusions remove Dive-linked practice and Site contributions but retain independent library material',()=>{
  const records=[row('skill','skill',{skillKey:'legacy-skill',name:'Buoyancy'}),row('skill_evidence','practice',{skillKey:'legacy-skill',diveId:'d1',performedAt:'2026-09-01'}),row('dive','d1',{date:'2026-09-01',siteId:'site1',site:'Site',diveTypes:['Buoyancy']}),row('site','site1',{name:'Site'}),row('dive-media','m',{title:'Book',topics:['Buoyancy']})];
  const full=project(records),excluded=project(records,{includedDiveIds:[]});
  expect(full.items.find(item=>item.recordId==='practice')?.matchClass).toBe('Exact saved relationship');
  expect(full.items.find(item=>item.recordId==='site1')?.relatedIds).toEqual(['d1']);
  expect(excluded.items.map(item=>item.recordId)).toEqual(['m','skill']);
  expect(records[1]?.data.diveId).toBe('d1');
 });
 it('missing or ambiguous Skill aliases never substitute an arbitrary record',()=>{
  const records=[row('skill','a',{skillKey:'same',name:'Buoyancy'}),row('skill','b',{skillKey:'same',name:'Buoyancy'}),row('skill_evidence','e',{skillKey:'same',diveId:'d1'})];
  const result=project(records);expect(result.items.some(item=>item.recordId==='e')).toBe(false);expect(result.unavailableReferences).toBe(1);
 });
 it('retains distinct progress histories and archived material, excludes deleted or suppressed sources',()=>{
  const records=[row('training-progress','t1',{agency:'PADI',courseId:'x',courseTitle:'Buoyancy',status:'planned'}),row('training-progress','t2',{agency:'PADI',courseId:'x',courseTitle:'Buoyancy',status:'completed'}),row('news-article','a',{title:'Buoyancy',state:'archived'}),row('news-article','deleted',{title:'Buoyancy',state:'deleted'}),row('dive-media','hidden',{title:'Buoyancy',suppressedFromUse:true})];
  expect(project(records).items.map(item=>item.recordId)).toEqual(['a','t1','t2']);
 });
 it('explicit-only mode never treats recorded prose as a tag and source selection is exact',()=>{
  const records=[row('news-article','n',{title:'Buoyancy',state:'saved'}),row('dive-media','m',{title:'Other',topics:['Buoyancy']})];
  expect(project(records,{mode:'explicit-only'}).items.map(item=>item.recordId)).toEqual(['m']);
  expect(project(records,{sources:['news']}).items.map(item=>item.recordId)).toEqual(['n']);
 });
 it('rejects unsafe URLs and bounds queries, partial sources and source item expansion',()=>{
  expect(topicSourceUrl('javascript:alert(1)')).toBeUndefined();expect(topicSourceUrl('https://user:pass@example.invalid')).toBeUndefined();
  expect(()=>project([],{query:'x'.repeat(161)})).toThrow();expect(project([],{query:''}).items).toEqual([]);
  const partial=snapshot([]);partial.coverage=[{kind:'dive-media',state:'unknown',reason:'not-cached'}];
  expect(buildTopicProjection(partial,{query:'Buoyancy',sources:['bibliography'],mode:'explicit-only',includedDiveIds:[]}).partial).toBe(true);
 });
});
describe('Topic Explorer registry integration',()=>{
 it('occupies an existing optional slot and preserves six defaults and max nine',()=>{
  expect(ANALYSIS_CARD_REGISTRY['topic-explorer'].allowed).toEqual(['topics','table']);expect(DEFAULT_ANALYSIS_CARDS).toHaveLength(6);
  expect(DEFAULT_ANALYSIS_CARDS.some(card=>card.metric==='topic-explorer')).toBe(false);
  const topic={id:'topic',metric:'topic-explorer',visualization:'topics',topic:{version:1,query:'Buoyancy',mode:'explicit-only',sources:['knowledge','skills']}};
  expect(validateAnalysisCards([topic])).toEqual([]);expect(normaliseAnalysisCards([topic])).toEqual([topic]);
  expect(validateAnalysisCards([{...topic,visualization:'scatter'}])).not.toHaveLength(0);
  expect(validateAnalysisCards([{...topic,topic:{...topic.topic,query:'x'.repeat(161)}}])).not.toHaveLength(0);
  expect(validateAnalysisCards(Array.from({length:10},(_,i)=>({...topic,id:String(i)})))).not.toHaveLength(0);
 });
});
