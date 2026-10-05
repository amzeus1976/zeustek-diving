import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {T14GasPlanEditor} from '../components/planning/t14-gas-plan-editor';
import {emptyAllocation} from '../lib/gas-allocation/integration';
import {newAllocationCylinder,initialGasAllocation,initialRecreationalInput} from '../lib/gas-allocation/editor-input';
import {duplicateGasPlanDraft} from '../lib/planning/duplicate-plans';
import {gasPlanWithAllocation} from '../lib/gas-allocation/integration';
import {buildRecreationalGasSnapshot} from '../lib/offline/recreational-gas-planner';
import type {StoredGasPlanRecord} from '../lib/offline/planning-pages';

const baseline={litresPerMinute:15,observationCount:0,diveIds:[]};
function renderCopy(copyFrom:StoredGasPlanRecord){
 return renderToStaticMarkup(createElement(T14GasPlanEditor,{item:null,copyFrom,newGasPlanFor:null,divePlans:[],equipment:[],fills:[],analyses:[],dives:[],trips:[],sites:[],rmvBaseline:baseline,close:()=>{},saved:()=>{}}));
}
describe('Actual copied Gas Plan editor allocation',()=>{
 it('initially renders the source allocation, rather than a new empty allocation',()=>{
  const allocation=emptyAllocation();
  allocation.cylinders=[{...newAllocationCylinder('temporary',0.21),label:'Repeat rental 12L',waterVolumeL:12,plannedStartPressureBar:200,currentPressureBar:200}];
  const source={entityId:'gas',name:'Repeat gas',status:'draft',plannedDepthM:12,plannedBottomTimeMin:20,cylinders:[],allocationV1:allocation,createdAt:'old',modifiedAt:'old'} as unknown as StoredGasPlanRecord;
  const before=structuredClone(source);
  expect(renderCopy(source)).toContain('Repeat rental 12L');
  expect(source).toEqual(before);
 });
 it('retains legacy supply mode when copying a plan without allocationV1',()=>{
  const source={entityId:'legacy',name:'Legacy gas',status:'draft',cylinders:[{id:'supply',sourceMode:'owned',cylinderEquipmentId:'cylinder'}],createdAt:'old',modifiedAt:'old'} as unknown as StoredGasPlanRecord;
  expect(renderCopy(source)).toContain('Review T14 supply allocation');
  expect(initialGasAllocation(duplicateGasPlanDraft(source),false)).toBeNull();
 });
 it('immediate copied save retains every allocated supply without changing the original',()=>{
  const allocation=emptyAllocation();
  allocation.cylinders=[{...newAllocationCylinder('temporary',0.21),id:'first',label:'12L hire',waterVolumeL:12,currentPressureBar:200,plannedStartPressureBar:200},{...newAllocationCylinder('temporary',0.32),id:'second',label:'Backup',waterVolumeL:7,currentPressureBar:180,plannedStartPressureBar:180}];
  const source={entityId:'original',name:'Gas',status:'draft',plannedDepthM:12,plannedBottomTimeMin:20,cylinders:[],allocationV1:allocation,createdAt:'old',modifiedAt:'old'} as unknown as StoredGasPlanRecord;
  const before=structuredClone(source),draft=duplicateGasPlanDraft(source);
  const state=initialGasAllocation(draft,false)!;
  const input=initialRecreationalInput(draft,baseline);
  const saved=gasPlanWithAllocation(draft,input,buildRecreationalGasSnapshot(input),state);
  expect(saved.cylinders.map(row=>row.id)).toEqual(['first','second']);
  expect(saved.allocationV1?.cylinders).toEqual(allocation.cylinders);
  expect(saved).not.toHaveProperty('entityId');
  state.cylinders[0]!.label='Edited copy';
  expect(source).toEqual(before);
 });
});
