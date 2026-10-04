import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import * as topicView from '../components/insights/topic-explorer';
import type {TopicItem} from '../lib/insights/topic-explorer';
import {AnalysisWorkbench} from '../components/insights/analysis-workbench';
import {changeAnalysisCardMetric,validateAnalysisCards,type AnalysisCardConfig} from '../lib/insights/analysis-card-registry';
import {DEFAULT_ANALYSIS_SCOPE,buildExperienceAnalyticsProjection} from '../lib/offline/experience-analytics';
const item=(kind:string,id:string):TopicItem=>({id,recordId:id,kind,family:'training',title:'Exact source',status:'Saved',matchClass:'Recorded text match',field:'Title',reason:'Recorded text only',details:[{label:'Title',value:'<script>dummy()</script>'}],relatedIds:[]});
describe('Topic Explorer exact-source UI',()=>{
 it('changes a card metric without carrying incompatible settings into a different analysis',()=>{
  const card:AnalysisCardConfig={id:'t',metric:'topic-explorer',visualization:'topics',topic:{version:1,query:'Buoyancy',mode:'explicit-only',sources:['skills']},title:'My topic'};
  const changed=changeAnalysisCardMetric(card,'depth-bands');expect(changed).toMatchObject({id:'t',title:'My topic',metric:'depth-bands',visualization:'bar'});expect(changed).not.toHaveProperty('topic');expect(validateAnalysisCards([changed])).toEqual([]);expect(card.topic?.query).toBe('Buoyancy');
  expect(changeAnalysisCardMetric(changed,'topic-explorer').topic).toMatchObject({version:1,query:'',mode:'explicit-and-text'});
 });
 it('renders the optional Topic card with its own query and record action rather than a misleading Dive-count analysis',()=>{
  const html=renderToStaticMarkup(createElement(AnalysisWorkbench,{cards:[{id:'topic',metric:'topic-explorer',visualization:'topics',topic:{version:1,query:'Buoyancy',mode:'explicit-and-text',sources:['skills']}}],saveCards:async()=>{},scope:DEFAULT_ANALYSIS_SCOPE,changeScope:()=>{},projection:buildExperienceAnalyticsProjection([],[],[],DEFAULT_ANALYSIS_SCOPE),dives:[],sites:[],loadouts:[]}));
  expect(html).toContain('Enlarge Topic Explorer');expect(html).toContain('Source data for Topic Explorer');expect(html).toContain('Topic or phrase');expect(html).toContain('Buoyancy');expect(html).toContain('Library material');expect(html).not.toContain('0 source Dives');
 });
 it('maps existing canonical receivers by exact identity, never by a name or first record',()=>{
  expect(topicView.topicRecordDestination(item('dive','d'))).toContain('diveId=d');
  expect(topicView.topicRecordDestination(item('certification','c'))).toContain('certificationId=c');
  expect(topicView.topicRecordDestination(item('skill_evidence','e'))).toContain('evidenceId=e');
  expect(topicView.topicRecordDestination(item('site','s'))).toContain('siteId=s');
  for(const kind of ['question-set','test-attempt','news-article','dive-media','training-progress','unknown'])expect(topicView.topicRecordDestination(item(kind,'exact'))).toBeNull();
 });
 it('renders a safe recorded source panel with exact knowledge version and no arbitrary navigation',()=>{
  const html=renderToStaticMarkup(createElement(topicView.TopicRecordedSource,{item:{...item('test-attempt','attempt'),questionId:'q',setId:'bank',setVersion:1},close:()=>{}}));
  expect(html).toContain('Historical version 1');expect(html).toContain('q');
  expect(html).toContain('&lt;script&gt;dummy()&lt;/script&gt;');expect(html).not.toContain('<script>');
  expect(html).not.toContain('section=Logbook');
 });
 it('pages each real source family independently without changing the input',()=>{
  const rows=Array.from({length:52},(_,i)=>({...item('dive-media',String(i)),family:'bibliography' as const}));
  const before=JSON.stringify(rows);const page=topicView.topicFamilyPage(rows,'bibliography',1);
  expect(page.rows).toHaveLength(25);expect(page.rows[0]?.recordId).toBe('25');expect(page.count).toBe(52);expect(page.pages).toBe(3);
  expect(topicView.topicFamilyPage(rows,'bibliography',999).rows).toHaveLength(2);
  expect(JSON.stringify(rows)).toBe(before);
 });
});
