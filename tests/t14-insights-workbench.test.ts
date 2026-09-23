import {describe,expect,it} from 'vitest';
import {DEFAULT_ANALYSIS_SCOPE,applyAnalysisScope,buildExperienceAnalyticsProjection,type DiveWithId} from '../lib/offline/experience-analytics';
import {matchesAnalysisFilter,validateAnalysisFilter,type AnalysisFilterNode} from '../lib/insights/analysis-filter-expression';
import {ANALYSIS_CARD_REGISTRY,DEFAULT_ANALYSIS_CARDS,normaliseAnalysisCards,validateAnalysisCards,buildAnalysisCardData,type AnalysisMetricKey} from '../lib/insights/analysis-card-registry';
import {mergeWorkbenchSettings} from '../lib/insights/workbench-settings';
const dive=(id:string,patch:Partial<DiveWithId>={}):DiveWithId=>({entityId:id,date:'2026-09-01',site:'Harbour',siteId:'site-1',maxDepthM:18,bottomTimeMin:40,totalElapsedMin:45,gas:'Air',source:'manual',notes:'',createdAt:'',modifiedAt:'',waterType:'Saltwater',diveMode:'recreational',...patch});
const predicate=(field:string,comparator:string,value?:unknown)=>({kind:'predicate',id:field,field,comparator,...(value!==undefined?{value}:{})}) as AnalysisFilterNode;

describe('T14 additive analysis expressions',()=>{
  it('preserves the result of every legacy scope field with no advanced expression',()=>{
    const rows=[dive('a',{diveTypes:['Boat'],equipmentSetIds:['set-1']}),dive('b',{maxDepthM:5,waterType:'Freshwater',diveTypes:['Pool']}),dive('c',{date:'2025-01-02',diveMode:'technical-training'})];
    for(const scope of [DEFAULT_ANALYSIS_SCOPE,{...DEFAULT_ANALYSIS_SCOPE,includePool:false,includeTraining:false},{...DEFAULT_ANALYSIS_SCOPE,siteIds:['site-1'],minDepthM:10,maxTimeMin:50},{...DEFAULT_ANALYSIS_SCOPE,equipmentSetIds:['set-1'],excludedDiveIds:['a']}]){
      expect(applyAnalysisScope(rows,{...scope,advancedFilter:null})).toEqual(applyAnalysisScope(rows,scope));
    }
  });
  it('evaluates nested AND/OR/NOT and then explicit exclusions without modifying canonical dives',()=>{
    const rows=[dive('a'),dive('b',{waterType:'Freshwater',maxDepthM:25}),dive('c',{waterType:'Freshwater',maxDepthM:12})],before=structuredClone(rows);
    const expression:AnalysisFilterNode={kind:'group',id:'root',operator:'and',children:[{kind:'group',id:'either',operator:'or',children:[predicate('waterType','equals','Saltwater'),predicate('maxDepthM','gte',20)]},{kind:'group',id:'not-training',operator:'and',negated:true,children:[predicate('diveMode','equals','technical-training')]}]};
    expect(applyAnalysisScope(rows,{...DEFAULT_ANALYSIS_SCOPE,advancedFilter:expression,excludedDiveIds:['b']}).map(r=>r.entityId)).toEqual(['a']);expect(rows).toEqual(before);
  });
  it('compares ISO dates chronologically and rejects malformed or reversed ranges',()=>{
    expect(matchesAnalysisFilter(dive('a'),predicate('date','between',['2026-08-31','2026-09-02']))).toBe(true);
    expect(matchesAnalysisFilter(dive('a'),predicate('date','gte','2026-10-01'))).toBe(false);
    expect(validateAnalysisFilter(predicate('date','equals','2026-02-30'))).not.toHaveLength(0);
    expect(validateAnalysisFilter(predicate('maxDepthM','between',[30,10]))).not.toHaveLength(0);
  });
  it('keeps missing measurements unknown even inside NOT; explicit absence is queryable',()=>{
    const row=dive('a',{maxDepthM:null});
    expect(matchesAnalysisFilter(row,predicate('maxDepthM','not-equals',20))).toBe(false);
    expect(matchesAnalysisFilter(row,{kind:'group',id:'not',operator:'and',negated:true,children:[predicate('maxDepthM','gte',20)]})).toBe(false);
    expect(matchesAnalysisFilter(row,predicate('maxDepthM','missing'))).toBe(true);
  });
  it('matches canonical IDs exactly and searches text without case sensitivity',()=>{
    expect(matchesAnalysisFilter(dive('a'),predicate('siteId','equals','SITE-1'))).toBe(false);
    expect(matchesAnalysisFilter(dive('a',{diveTypes:['Night dive']}),predicate('diveType','contains','NIGHT'))).toBe(true);
    expect(matchesAnalysisFilter(dive('a',{equipmentSetApplications:[{equipmentSetId:'set-1'}] as NonNullable<DiveWithId['equipmentSetApplications']>}),predicate('equipmentSetId','equals','set-1'))).toBe(true);
  });
  it('fails closed for invalid fields, empty groups and excessive nesting, including negation',()=>{
    const invalid={kind:'group',id:'n',operator:'and',negated:true,children:[predicate('privateNotes','equals','x')]} as AnalysisFilterNode;
    expect(matchesAnalysisFilter(dive('a'),invalid)).toBe(false);
    expect(validateAnalysisFilter({kind:'group',id:'empty',operator:'or',children:[]})).not.toHaveLength(0);
    let deep:AnalysisFilterNode=predicate('maxDepthM','gte',1);
    for(let i=0;i<10;i++)deep={kind:'group',id:String(i),operator:'and',children:[deep]};
    expect(validateAnalysisFilter(deep)).not.toHaveLength(0);
  });
  it('toggles environment focus independently from salinity and restores all data',()=>{
    const rows=[dive('a',{diveTypes:['Boat']}),dive('b',{diveTypes:['Shore']})];
    expect(applyAnalysisScope(rows,{...DEFAULT_ANALYSIS_SCOPE,environmentFocus:'boat'}).map(r=>r.entityId)).toEqual(['a']);
    expect(applyAnalysisScope(rows,{...DEFAULT_ANALYSIS_SCOPE,environmentFocus:null})).toHaveLength(2);
  });
});

describe('T14 workbench registry and provenance',()=>{
  it('retains six defaults, bounds layout at nine and prevents invalid metric/visualisation pairs',()=>{
    expect(DEFAULT_ANALYSIS_CARDS).toHaveLength(6);
    expect(normaliseAnalysisCards(Array.from({length:12},(_,i)=>({...DEFAULT_ANALYSIS_CARDS[0],id:String(i)})))).toHaveLength(9);
    expect(validateAnalysisCards([{id:'bad',metric:'sac-trend',visualization:'donut'}])).not.toHaveLength(0);
    expect(validateAnalysisCards([{...DEFAULT_ANALYSIS_CARDS[0]!,id:'same'},{...DEFAULT_ANALYSIS_CARDS[1]!,id:'same'}])).not.toHaveLength(0);
    expect(normaliseAnalysisCards(undefined)).toEqual(DEFAULT_ANALYSIS_CARDS);
    expect(normaliseAnalysisCards([])).toEqual([]);
  });
  it('provides real source IDs and units for every registered metric without conflating SAC and RMV',()=>{
    const rows=[dive('a',{sacRate:1.1,rmvRate:18,equipmentSetIds:['set-1']}),dive('b',{maxDepthM:null,rmvRate:null})],projection=buildExperienceAnalyticsProjection(rows,[],[],DEFAULT_ANALYSIS_SCOPE);
    for(const metric of Object.keys(ANALYSIS_CARD_REGISTRY) as AnalysisMetricKey[]){
      const data=buildAnalysisCardData(metric,projection,rows,[]);
      for(const row of data.rows)for(const id of row.diveIds)expect(['a','b']).toContain(id);
    }
    expect(buildAnalysisCardData('sac-trend',projection,rows,[])).toMatchObject({unit:'bar/min',rows:[{value:1.1,diveIds:['a']}]});
    expect(buildAnalysisCardData('rmv-trend',projection,rows,[])).toMatchObject({unit:'L/min',rows:[{value:18,diveIds:['a']}]});
    expect(buildAnalysisCardData('depth-v-duration',projection,rows,[]).rows.map(row=>row.diveIds)).toEqual([['a']]);
    expect(buildAnalysisCardData('depth-bands',projection,rows,[]).missingCount).toBe(1);
    expect(buildAnalysisCardData('depth-v-duration',projection,rows,[]).missingCount).toBe(1);
  });
  it('merges layout into settings without replacing awards, Maps or newsletter configuration',()=>{
    const original={entityId:'settings',selectedAwards:['depth'],maxAwards:4,customGoogleMapEmbedUrl:'map',newsletterEmail:'private@example.invalid',createdAt:'',modifiedAt:''};
    const merged=mergeWorkbenchSettings(original,DEFAULT_ANALYSIS_CARDS);
    expect(merged).toMatchObject({...original,analysisWorkbench:{version:1,cards:DEFAULT_ANALYSIS_CARDS}});
    expect(original).not.toHaveProperty('analysisWorkbench');
  });
});
