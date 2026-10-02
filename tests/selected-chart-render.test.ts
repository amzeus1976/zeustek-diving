import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {AnalysisWorkbench} from '../components/insights/analysis-workbench';
import {DEFAULT_ANALYSIS_CARDS} from '../lib/insights/analysis-card-registry';
import {buildExperienceAnalyticsProjection,DEFAULT_ANALYSIS_SCOPE,type DiveWithId} from '../lib/offline/experience-analytics';

afterEach(()=>vi.restoreAllMocks());
describe('initial Insights chart rendering',()=>{
 it('renders real default analysis cards without invalid dimension warnings before measurement',()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  const dives: DiveWithId[]=[{entityId:'local-chart-dive',date:'2026-09-01',site:'Fixture bay',siteId:'local-chart-site',maxDepthM:18,bottomTimeMin:40,gas:'Air',source:'manual',notes:'',createdAt:'',modifiedAt:'',waterType:'Saltwater',diveTypes:['Shore'],sacRate:1.2,rmvRate:18,equipmentSetIds:['local-chart-loadout']}];
  const projection=buildExperienceAnalyticsProjection(dives,[],[],DEFAULT_ANALYSIS_SCOPE);
  const markup=renderToString(createElement(AnalysisWorkbench,{cards:DEFAULT_ANALYSIS_CARDS,saveCards:async()=>{},scope:DEFAULT_ANALYSIS_SCOPE,changeScope:()=>{},projection,dives,sites:[],loadouts:[]}));
  expect(markup).toContain('Analysis workbench');
  expect(markup).toContain('Accessible data table');
  expect(markup.replaceAll('<!-- -->','')).toContain('1 source Dives');
  expect(warn.mock.calls.filter(args=>String(args[0]).includes('width('))).toEqual([]);
 });
});
