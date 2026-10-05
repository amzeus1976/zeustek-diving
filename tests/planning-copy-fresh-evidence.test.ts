import {describe,it,expect} from 'vitest';
import {duplicateGasPlanDraft} from '../lib/planning/duplicate-plans';
import {newAllocationCylinder,initialGasAllocation,initialRecreationalInput} from '../lib/gas-allocation/editor-input';
import {emptyAllocation,allocationReadiness,gasPlanWithAllocation} from '../lib/gas-allocation/integration';
import {buildRecreationalGasSnapshot} from '../lib/offline/recreational-gas-planner';
import {reviewAllocationEvidence} from '../lib/gas-allocation/evidence-review';
import type {StoredGasPlanRecord} from '../lib/offline/planning-pages';
describe('Repeated Gas Plans need fresh observed evidence',()=>{
 for(const mode of ['hire','temporary','own-full','own-empty'] as const)it('clears '+mode+' observations while retaining planned configuration and source',()=>{
  const allocation=emptyAllocation();allocation.cylinders=[{...newAllocationCylinder(mode,0.21),id:'supply',canonicalId:mode.startsWith('own')?'cylinder':null,label:'12L',waterVolumeL:12,ratedPressureBar:232,plannedStartPressureBar:200,currentPressureBar:200,fillId:'old-fill',analysisId:'old-analysis',analysisConfirmed:true,conditionConfirmed:true,analysedAt:'2026-10-01',analysisSource:'analysed-by-me'}];
  const source={entityId:'gas',name:'Repeat',cylinders:[],allocationV1:allocation,plannedDepthM:12,plannedBottomTimeMin:20,createdAt:'old',modifiedAt:'old'} as unknown as StoredGasPlanRecord,before=structuredClone(source),copy=duplicateGasPlanDraft(source),row=copy.allocationV1!.cylinders[0]!;
  expect(row).toMatchObject({id:'supply',label:'12L',waterVolumeL:12,ratedPressureBar:232,plannedStartPressureBar:200,gas:{oxygen:0.21,helium:0},currentPressureBar:null,fillId:null,analysisId:null,analysisConfirmed:false,conditionConfirmed:false,analysedAt:null,analysisSource:'unknown'});
  expect(row.snapshotId).not.toBe(allocation.cylinders[0]!.snapshotId);expect(source).toEqual(before);
  if(mode==='hire'||mode==='temporary'){const reviewed=reviewAllocationEvidence(copy.allocationV1!,copy,[],[],[]),input=initialRecreationalInput(copy,{litresPerMinute:15,observationCount:0,diveIds:[]}),snapshot=buildRecreationalGasSnapshot(input);const result=allocationReadiness(input,snapshot,reviewed);expect(result.status).not.toBe('PASS');const saved=gasPlanWithAllocation(copy,input,snapshot,initialGasAllocation(copy,false)!);expect(saved.allocationV1!.cylinders[0]!.currentPressureBar).toBeNull();expect(saved.allocationV1!.cylinders[0]!.analysisConfirmed).toBe(false);}
 });
 it('clears legacy rental observations and source evidence without dropping the supply',()=>{const source={entityId:'gas',name:'Legacy',cylinders:[{id:'supply',role:'primary',sourceMode:'rental',fillId:'fill',analysisId:'analysis',startPressureBar:200,endPressureBar:50,rentalSnapshot:{label:'12L',waterVolumeL:12,workingPressureBar:232,startPressureBar:200,remainingPressureBar:50,oxygenFraction:0.32,heliumFraction:0,analysisStatus:'current',analysisSource:'analysed-by-operator',analysedAt:'old'}}]} as unknown as StoredGasPlanRecord,before=structuredClone(source);expect(duplicateGasPlanDraft(source).cylinders).toMatchObject([{id:'supply',fillId:null,analysisId:null,startPressureBar:null,endPressureBar:null,rentalSnapshot:{label:'12L',waterVolumeL:12,workingPressureBar:232,oxygenFraction:0.32,startPressureBar:null,remainingPressureBar:null,analysisStatus:'missing',analysisSource:'unknown',analysedAt:null}}]);expect(source).toEqual(before);});
});

