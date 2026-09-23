import {diveRuntimeMinutes,type DiveWithId,type ExperienceAnalyticsProjection} from '../offline/experience-analytics';
import type {DiveSiteRecord,Stored} from '../offline/dive-planning';
export type AnalysisVisualization='kpi'|'bar'|'line'|'scatter'|'donut'|'table'|'site-map';
type Registration={label:string;defaultVisualization:AnalysisVisualization;allowed:AnalysisVisualization[];description:string};
export const ANALYSIS_CARD_REGISTRY={
  'total-dives':{label:'Total Dives',defaultVisualization:'kpi',allowed:['kpi','table'],description:'Canonical Dives inside the active scope.'},
  'total-time':{label:'Total dive time',defaultVisualization:'kpi',allowed:['kpi','table'],description:'Elapsed runtime, with bottom time used only when elapsed time is absent.'},
  'max-depth':{label:'Maximum depth',defaultVisualization:'kpi',allowed:['kpi','table'],description:'Maximum recorded depth. Missing depths are excluded.'},
  'depth-bands':{label:'Depth bands',defaultVisualization:'bar',allowed:['bar','donut','table'],description:'Dives grouped by maximum depth; missing depth is unknown.'},
  environment:{label:'Environment / activity',defaultVisualization:'donut',allowed:['donut','bar','table'],description:'Primary recorded environment, separately from salinity. Select a row to filter or unfilter.'},
  'water-type':{label:'Water type',defaultVisualization:'donut',allowed:['donut','bar','table'],description:'Recorded salinity; missing or unrecognised values remain Other / unknown.'},
  'sac-trend':{label:'SAC trend',defaultVisualization:'line',allowed:['line','scatter','table'],description:'Validated pressure SAC in bar/min. Never interpreted as volume RMV.'},
  'rmv-trend':{label:'RMV trend',defaultVisualization:'line',allowed:['line','scatter','table'],description:'Validated volume rate in L/min; missing or ambiguous measurements are excluded.'},
  'site-usage':{label:'Most-dived Sites',defaultVisualization:'bar',allowed:['bar','table','site-map'],description:'Canonical Site references and labelled legacy names. Site view plots recorded coordinates only.'},
  'equipment-usage':{label:'Most-used equipment sets',defaultVisualization:'bar',allowed:['bar','donut','table'],description:'Canonical equipment-set use. A Dive may reference several sets.'},
  'dive-timeline':{label:'Dive timeline',defaultVisualization:'line',allowed:['line','bar','table'],description:'Dive count by recorded calendar month.'},
  'depth-v-duration':{label:'Depth vs duration',defaultVisualization:'scatter',allowed:['scatter','table'],description:'Recorded maximum depth against elapsed duration. Missing measurements are excluded.'},
} satisfies Record<string,Registration>;
export type AnalysisMetricKey=keyof typeof ANALYSIS_CARD_REGISTRY;
export type AnalysisCardConfig={id:string;metric:AnalysisMetricKey;visualization:AnalysisVisualization;title?:string;span?:1|2};
export const DEFAULT_ANALYSIS_CARDS:AnalysisCardConfig[]=[
  {id:'depth',metric:'depth-bands',visualization:'bar'},{id:'environment',metric:'environment',visualization:'donut'},
  {id:'sac',metric:'sac-trend',visualization:'line'},{id:'rmv',metric:'rmv-trend',visualization:'line'},
  {id:'equipment',metric:'equipment-usage',visualization:'bar'},{id:'sites',metric:'site-usage',visualization:'bar'},
];
export function validateAnalysisCards(cards:unknown):string[]{
  if(!Array.isArray(cards))return ['Choose a card layout.'];
  const errors:string[]=cards.length>9?['Choose at most nine cards.']:[],ids=new Set<string>();
  for(const input of cards){
    if(!input||typeof input!=='object'){errors.push('Invalid card configuration.');continue;}
    const card=input as Record<string,unknown>,entry=typeof card.metric==='string'&&Object.hasOwn(ANALYSIS_CARD_REGISTRY,card.metric)?ANALYSIS_CARD_REGISTRY[card.metric as AnalysisMetricKey] as Registration:null;
    if(!entry||!entry.allowed.includes(card.visualization as AnalysisVisualization))errors.push('Choose a supported metric and visualisation pair.');
    if(typeof card.id!=='string'||!card.id||ids.has(card.id))errors.push('Cards need distinct identities.');else ids.add(card.id);
    if(card.span!==undefined&&card.span!==1&&card.span!==2)errors.push('Card width must be one or two columns.');
    if(card.title!==undefined&&(typeof card.title!=='string'||card.title.length>100))errors.push('Card titles must be at most 100 characters.');
  }
  return [...new Set(errors)];
}
export function normaliseAnalysisCards(value:unknown):AnalysisCardConfig[]{
  if(!Array.isArray(value))return structuredClone(DEFAULT_ANALYSIS_CARDS);
  const ids=new Set<string>(),cards:AnalysisCardConfig[]=[];
  for(const entry of value){
    if(validateAnalysisCards([entry]).length)continue;
    const card=entry as AnalysisCardConfig;if(ids.has(card.id))continue;ids.add(card.id);
    cards.push({id:card.id,metric:card.metric,visualization:card.visualization,...(card.title?{title:card.title}:{}),...(card.span?{span:card.span}:{})});
    if(cards.length===9)break;
  }
  return value.length&&!cards.length?structuredClone(DEFAULT_ANALYSIS_CARDS):cards;
}
export type AnalysisDataRow={id:string;label:string;value:number;diveIds:string[];x?:number;siteId?:string;equipmentSetId?:string;latitude?:number;longitude?:number};
export type AnalysisCardData={unit:string;rows:AnalysisDataRow[];value?:number|null;missingCount:number};
export function buildAnalysisCardData(metric:AnalysisMetricKey,projection:ExperienceAnalyticsProjection,dives:DiveWithId[],sites:Stored<DiveSiteRecord>[]):AnalysisCardData{
  const scoped=dives.filter(dive=>projection.includedDiveIds.includes(dive.entityId));
  const result=(unit:string,rows:AnalysisDataRow[],missingCount=0):AnalysisCardData=>({unit,rows,missingCount});
  switch(metric){
    case 'total-dives':case 'total-time':case 'max-depth':{
      const observation=metric==='total-dives'?projection.headlines.totalDives:metric==='total-time'?projection.headlines.totalDiveTimeMin:projection.headlines.maxDepthM;
      return {unit:observation.unit,value:observation.value,missingCount:observation.missingCount,rows:scoped.filter(d=>observation.sourceDiveIds.includes(d.entityId)).map(dive=>({id:dive.entityId,label:dive.date+' · '+dive.site,value:metric==='total-dives'?1:metric==='total-time'?diveRuntimeMinutes(dive)!:dive.maxDepthM!,diveIds:[dive.entityId]}))};
    }
    case 'depth-bands':return result('dives',projection.depthBands.map(row=>({id:row.key,label:row.label,value:row.count,diveIds:row.diveIds})),scoped.length-new Set(projection.depthBands.flatMap(row=>row.diveIds)).size);
    case 'environment':case 'water-type':return result('dives',(metric==='environment'?projection.environmentSplit:projection.waterTypeSplit).map(row=>({id:row.key,label:row.label,value:row.count,diveIds:row.diveIds})));
    case 'sac-trend':return result('bar/min',projection.sacTrend.map(row=>({id:row.diveId,label:row.date+' · '+row.site,value:row.sacBarMin,x:Date.parse(row.date+'T00:00:00Z'),diveIds:[row.diveId]})),projection.headlines.averageSacBarMin.missingCount);
    case 'rmv-trend':return result('L/min',projection.rmvTrend.map(row=>({id:row.diveId,label:row.date+' · '+row.site,value:row.rmvLMin,x:Date.parse(row.date+'T00:00:00Z'),diveIds:[row.diveId]})),projection.headlines.averageRmvLMin.missingCount);
    case 'site-usage':return result('dives',projection.siteUsage.map((row,index)=>{
      const site=sites.find(site=>site.entityId===row.siteId);
      return {id:row.siteId??'legacy-'+index,label:row.name,value:row.dives,diveIds:row.diveIds,...(row.siteId?{siteId:row.siteId}:{}),
        ...(typeof site?.latitude==='number'&&Number.isFinite(site.latitude)&&typeof site.longitude==='number'&&Number.isFinite(site.longitude)?{latitude:site.latitude,longitude:site.longitude}:{})};
    }));
    case 'equipment-usage':return result('dives',projection.equipmentSetUsage.map(row=>({id:row.equipmentSetId,label:row.name,value:row.dives,diveIds:row.diveIds,equipmentSetId:row.equipmentSetId})));
    case 'dive-timeline':{
      const groups=new Map<string,string[]>();for(const dive of scoped){if(!/^\d{4}-\d{2}-\d{2}$/.test(dive.date))continue;const month=dive.date.slice(0,7);groups.set(month,[...(groups.get(month)??[]),dive.entityId]);}
      return result('dives',[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([label,diveIds])=>({id:label,label,value:diveIds.length,diveIds})));
    }
    case 'depth-v-duration':{
      const rows=scoped.flatMap(dive=>{
        const time=diveRuntimeMinutes(dive);return time===null||dive.maxDepthM==null||!Number.isFinite(dive.maxDepthM)||dive.maxDepthM<0?[]:[{id:dive.entityId,label:dive.date+' · '+dive.site,value:dive.maxDepthM,x:time,diveIds:[dive.entityId]}];
      });
      return result('m',rows,scoped.length-rows.length);
    }
  }
}
