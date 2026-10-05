import {describe,it,expect} from 'vitest';
import {duplicateDivePlanDraft,duplicateGasPlanDraft} from '../lib/planning/duplicate-plans';
import type {StoredEnrichedDivePlan} from '../lib/offline/dive-planning-centre';
import type {StoredGasPlanRecord} from '../lib/offline/planning-pages';
import {evaluatePlanReadiness,assessPlanSiteAndTeam} from '../lib/offline/dive-planning-centre';
describe('Reviewed new planning copies',()=>{
 it('requires current loadout equipment in a repeated Dive while retaining independent selections and source history',()=>{
  const original={entityId:'loadout-plan',name:'Repeated loadout dive',equipmentSetId:'set',equipmentSetIds:['set'],equipmentIds:['old-mask','independent-torch'],equipmentSetApplications:[{equipmentSetId:'set',equipmentSetName:'Original loadout',appliedAt:'2026-09-01T09:00:00Z',slots:{'personal.mask':'old-mask'},overrides:{}}]} as unknown as StoredEnrichedDivePlan;
  const before=structuredClone(original);
  const copy=duplicateDivePlanDraft(original);
  expect(copy.equipmentSetId).toBe('set');
  expect(copy.equipmentSetIds).toEqual(['set']);
  expect(copy.equipmentIds).toEqual(['independent-torch']);
  expect(copy.equipmentSetApplications).toEqual([]);
  expect(original).toEqual(before);
 });
 it('removes equipment attributable to all original loadout snapshots including multi-item slots',()=>{
  const original={entityId:'multi',name:'Repeat',equipmentSetId:'current',equipmentIds:['mask','camera','light','spare-mask','independent-torch'],equipmentSetApplications:[{equipmentSetId:'first',slots:{'personal.mask':'mask',camera_video:['camera','light']},overrides:{}},{equipmentSetId:'second',slots:{'personal.mask':'spare-mask',other:['light']},overrides:{}}]} as unknown as StoredEnrichedDivePlan;
  const before=structuredClone(original);
  expect(duplicateDivePlanDraft(original).equipmentIds).toEqual(['independent-torch']);
  expect(original).toEqual(before);
 });
 it('retains legacy independent selections when no source snapshot establishes equipment attribution',()=>{
  const original={entityId:'legacy',name:'Legacy repeat',equipmentSetId:'set',equipmentIds:['mask','torch'],equipmentSetApplications:[{equipmentSetId:'set',overrides:{}}]} as unknown as StoredEnrichedDivePlan;
  expect(duplicateDivePlanDraft(original).equipmentIds).toEqual(['mask','torch']);
  const absent={...original,equipmentSetApplications:undefined};
  expect(duplicateDivePlanDraft(absent).equipmentIds).toEqual(['mask','torch']);
  expect(duplicateDivePlanDraft({...absent,equipmentIds:undefined}).equipmentIds).toBeUndefined();
 });
 it('retains technical cylinder inputs but requires fresh fill and analysis selections before readiness',()=>{const original={entityId:'technical',name:'Technical repeat',siteId:'site',startAt:'2026-10-10T09:00',planTeam:[{personId:'self',role:'Diver'}],equipmentSetId:'loadout',emergency:{emergencyContact:'Dummy centre'},humanFactors:{keyRisks:['Review']},checklist:[{id:'check',completed:true}],technicalMode:true,plannedMaxDepthM:42,plannedRuntimeMin:55,cylinderAssignments:[{id:'slot',cylinderEquipmentId:'equipment',fillId:'old-fill',analysisId:'old-analysis',role:'backgas',gasLabel:'21/35',startPressureBar:200,switchDepthM:21}]} as unknown as StoredEnrichedDivePlan;const before=structuredClone(original);expect(evaluatePlanReadiness(original).state).toBe('ready');const copy=duplicateDivePlanDraft(original);expect(copy.cylinderAssignments).toEqual([{id:'slot',cylinderEquipmentId:'equipment',fillId:null,analysisId:null,role:'backgas',gasLabel:'21/35',startPressureBar:200,switchDepthM:21}]);copy.checklist=copy.checklist!.map(row=>({...row,completed:true}));const readiness=evaluatePlanReadiness({...copy,createdAt:'new',modifiedAt:'new'});expect(readiness.state).not.toBe('ready');expect(readiness.warnings).toContain('Link current fill and analysis evidence for every planned cylinder.');expect(original).toEqual(before);});
 it('retains permit requirement but resets confirmation and restores the new Dive warning',()=>{const original={entityId:'permit',name:'Permit dive',planTeam:[],permitRequired:true,permitConfirmed:true} as unknown as StoredEnrichedDivePlan;const before=structuredClone(original);const copy=duplicateDivePlanDraft(original);expect(copy.permitRequired).toBe(true);expect(copy.permitConfirmed).toBe(false);expect(assessPlanSiteAndTeam({...copy,createdAt:'new',modifiedAt:'new'})).toContain('Access permit required but not confirmed.');expect(original).toEqual(before);});
 it('copies operational inputs but never original identity, completion or Trip/Gas/calendar relationships',()=>{const original={entityId:'plan',name:'Repeated dive',startDate:'2026-10-10',siteId:'site',notes:'Briefing',status:'completed',lifecycleStatus:'ready',tripId:'trip',linkedGasPlanId:'gas',gasPlanLinks:[{gasPlanId:'gas'}],bookingStatus:'completed',createdAt:'old',modifiedAt:'old',checklist:[{id:'check',label:'Check',completed:true}],conditions:{weather:'Old forecast'},planTeam:[{personId:'self',role:'Diver'}]} as unknown as StoredEnrichedDivePlan;const before=structuredClone(original);const copy=duplicateDivePlanDraft(original);expect(copy).toMatchObject({name:'Repeated dive (copy)',siteId:'site',notes:'Briefing',lifecycleStatus:'draft',status:'planned',checklist:[{completed:false}],conditions:{},planTeam:[{personId:'self'}]});expect(copy).not.toHaveProperty('entityId');expect(copy).not.toHaveProperty('createdAt');expect(copy.tripId).toBeNull();expect(copy.gasPlanLinks).toEqual([]);expect(copy).not.toHaveProperty('linkedGasPlanId');expect(original).toEqual(before);});
 it('gas duplication keeps editable inputs with fresh identity and no ready/used claim',()=>{const original={entityId:'gas',name:'Air plan',divePlanId:'old-plan',status:'used',createdAt:'old',modifiedAt:'old',safetyAcknowledgedAt:'old',plannedDepthM:14,cylinders:[{id:'slot',cylinderEquipmentId:'cylinder'}],recGasPlan101:{input:{plannedDepthM:14}},notes:'Keep notes',warnings:['Old warning']} as unknown as StoredGasPlanRecord;const before=structuredClone(original);const copy=duplicateGasPlanDraft(original);expect(copy).toMatchObject({name:'Air plan (copy)',status:'draft',divePlanId:null,plannedDepthM:14,cylinders:[{cylinderEquipmentId:'cylinder'}],notes:'Keep notes',warnings:[]});expect(copy).not.toHaveProperty('entityId');expect(copy.safetyAcknowledgedAt).toBeNull();copy.cylinders[0]!.cylinderEquipmentId='changed';expect(original).toEqual(before);});
});
