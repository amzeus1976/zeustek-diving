import {describe,it,expect} from 'vitest';
import {selectUpcomingTrip} from '../lib/planning/upcoming-trip';
import {pageCatalogue} from '../lib/skills/catalogue-page';
import {resolveInsightHeadline} from '../lib/insights/headline-evidence';
import {INSIGHT_AWARD_DEFINITIONS} from '../lib/insights/insight-awards';
import {workflowDestinationUrl,parseWorkflowDestination} from '../lib/workflow/workflow-destination';
import type {DiveWithId} from '../lib/offline/experience-analytics';
import type {CertificationRecord} from '../lib/offline/dive-planning';

const today='2026-10-02';
const trip=(entityId:string,startDate:string,endDate='',status='planned')=>({entityId,startDate,endDate,status});
const dive=(entityId:string,patch:Record<string,unknown>={}):DiveWithId=>({entityId,date:'2026-09-01',site:'Fixture Bay',timeIn:'10:00',timeOut:'10:40',maxDepthM:24,averageDepthM:12,bottomTimeMin:40,gas:'Air',notes:'',source:'manual',createdAt:'',modifiedAt:'',diveMode:'recreational',waterType:'Saltwater',diveTypes:['Shore'],...patch} as DiveWithId);
describe('eligible upcoming trip',()=>{
 it('excludes expired, completed, cancelled and undated records',()=>{expect(selectUpcomingTrip([trip('old','2026-09-01'),trip('completed','2026-10-03','','completed'),trip('cancelled','2026-10-03','','cancelled'),trip('undated',''),trip('next','2026-10-04')],today)?.entityId).toBe('next');});
 it('keeps an ongoing multi-day trip ahead of future trips',()=>{expect(selectUpcomingTrip([trip('future','2026-10-03'),trip('ongoing','2026-09-30','2026-10-04')],today)?.entityId).toBe('ongoing');});
 it('retains today and excludes invalid or reversed dates without writing',()=>{const items=[trip('bad','2026-02-30'),trip('reverse','2026-10-04','2026-10-01'),trip('today',today)];const before=JSON.stringify(items);expect(selectUpcomingTrip(items,today)?.entityId).toBe('today');expect(JSON.stringify(items)).toBe(before);});
 it('does not call an undated plan the next dive',()=>{expect(selectUpcomingTrip([trip('undated','')],today)).toBeNull();});
});
describe('bounded catalogue pages',()=>{
 const items=Array.from({length:3874},(_,i)=>({entityId:'skill-'+i}));
 it('renders a bounded page with accurate totals and exact identities',()=>{expect(pageCatalogue(items,0)).toMatchObject({total:3874,page:0,pages:155,from:1,to:25});expect(pageCatalogue(items,1).items.map(item=>item.entityId)).toEqual(Array.from({length:25},(_,i)=>'skill-'+(i+25)));});
 it('clamps after narrowing filters and handles empty results',()=>{expect(pageCatalogue(items.slice(0,3),100)).toMatchObject({page:0,from:1,to:3,total:3});expect(pageCatalogue([],4)).toMatchObject({page:0,pages:1,from:0,to:0,items:[]});});
});
describe('headline evidence never falls back to unrelated Dives',()=>{
 const owner={entityId:'person-owner',roles:{ownerProfile:true},name:'Fixture owner'};
 const certifications=[{entityId:'award-msd',personId:'person-owner',certification:'Master Scuba Diver',agency:'Fixture Agency',courseType:'experience',issuedAt:'2026-01-01'}] as unknown as Array<CertificationRecord&{entityId:string}>;
 const dives=[dive('shore'),dive('technical',{diveMode:'technical',diveTypes:['Boat'],maxDepthM:42}),dive('fresh',{waterType:'Freshwater',maxDepthM:12})];
 it('opens canonical Certification award evidence with truthful source',()=>{expect(resolveInsightHeadline('highestRecCert',{dives,owner,certifications})).toMatchObject({value:'Master Scuba Diver',sourceKind:'certification',sourceIds:['award-msd']});});
 it('reports missing awards without inventing Dive provenance',()=>{expect(resolveInsightHeadline('highestTecCert',{dives,owner,certifications})).toMatchObject({value:'Not recorded',sourceKind:'certification',sourceIds:[]});});
 it('selects only the matching records for type, water and depth counts',()=>{expect(resolveInsightHeadline('technicalDives',{dives,owner,certifications})?.sourceIds).toEqual(['technical']);expect(resolveInsightHeadline('deep30',{dives,owner,certifications})?.sourceIds).toEqual(['technical']);expect(resolveInsightHeadline('freshwaterDives',{dives,owner,certifications})?.sourceIds).toEqual(['fresh']);});
 it('resolves every configured headline without a generic fallback',()=>{for(const [id,label] of INSIGHT_AWARD_DEFINITIONS){const result=resolveInsightHeadline(id,{dives,owner,certifications});expect(result?.label).toBe(label);expect(result?.sourceKind).toBe(id.startsWith('highest')?'certification':'dive');}expect(resolveInsightHeadline('unknown',{dives,owner,certifications})).toBeNull();});
 it('does not change canonical record values or order',()=>{const before=JSON.stringify({dives,owner,certifications});resolveInsightHeadline('highestRecCert',{dives,owner,certifications});expect(JSON.stringify({dives,owner,certifications})).toBe(before);});
});
describe('canonical evidence destinations',()=>{
 it('retains the exact Certification ID through route parsing',()=>{const url=workflowDestinationUrl({route:'Training',recordId:'award-msd'});expect(new URLSearchParams(url.slice(1)).get('certificationId')).toBe('award-msd');expect(parseWorkflowDestination(url).recordId).toBe('award-msd');});
 it('retains exact Skill and Skill Evidence deep links',()=>{expect(new URLSearchParams(workflowDestinationUrl({route:'Skills & Currency',recordId:'skill-3000'}).slice(1)).get('skillId')).toBe('skill-3000');expect(parseWorkflowDestination('?section=Skills+%26+Currency&evidenceId=evidence-2').params?.evidenceId).toBe('evidence-2');});
});
