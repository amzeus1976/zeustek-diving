import type {EnrichedDivePlan,StoredEnrichedDivePlan} from '../offline/dive-planning-centre';
import type {StoredGasPlanRecord} from '../offline/planning-pages';
import type {AllocatedGasPlan} from '../gas-allocation/integration';
import {buildRecreationalGasSnapshot} from '../offline/recreational-gas-planner';
import {initialRecreationalInput} from '../gas-allocation/editor-input';
/** New unsaved drafts: no writer, ID allocation, history or linked-record mutation. */
export function duplicateDivePlanDraft(source:StoredEnrichedDivePlan):Omit<EnrichedDivePlan,'createdAt'|'modifiedAt'>{
 const data=structuredClone(source) as unknown as EnrichedDivePlan&Record<string,unknown>;
 for(const key of ['entityId','createdAt','modifiedAt','tripId','linkedGasPlanId','linkedDivePlanId','linkedTripId','linkedDiveIds','originCalendarBookingId','calendarSource','bookingStatus','completedAt','archivedAt','deletedAt'])delete data[key];
 if(data.cylinderAssignments)data.cylinderAssignments=data.cylinderAssignments.map(row=>({...row,fillId:null,analysisId:null}));
 return{...data,name:`${source.name} (copy)`,status:'planned',lifecycleStatus:'draft',tripId:null,gasPlanLinks:[],conditions:{},equipmentReadiness:{},permitConfirmed:false,checklist:(source.checklist??[]).map(row=>({...row,completed:false}))};
}
export function duplicateGasPlanDraft(source:StoredGasPlanRecord):AllocatedGasPlan{
 const data=structuredClone(source) as AllocatedGasPlan&Record<string,unknown>;
 for(const key of ['entityId','createdAt','modifiedAt','completedAt','archivedAt','deletedAt'])delete data[key];
 const stamp=new Date().toISOString();
 if(data.allocationV1){
  delete data.allocationV1.assessment;delete data.allocationV1.savedAt;
  data.allocationV1.cylinders=data.allocationV1.cylinders.map(row=>({...row,snapshotId:crypto.randomUUID(),capturedAt:stamp,currentPressureBar:null,fillId:null,analysisId:null,analysisConfirmed:false,conditionConfirmed:false,analysedAt:null,analysisSource:'unknown'}));
 }
 data.cylinders=(data.cylinders??[]).map(row=>({...row,fillId:null,analysisId:null,startPressureBar:null,endPressureBar:null,...(row.rentalSnapshot?{rentalSnapshot:{...row.rentalSnapshot,startPressureBar:null,remainingPressureBar:null,analysisStatus:'missing',analysisSource:'unknown',analysedAt:null}}:{})}));
 // Saved calculation inputs/results also contain observed supply pressure. Rebuild in the editor.
 if(data.recGasPlan101)data.recGasPlan101=buildRecreationalGasSnapshot({...initialRecreationalInput(data,{litresPerMinute:data.rmvRateLitresMin??null,observationCount:0,diveIds:[]}),startPressureBar:null,analysedGases:[],pressureSource:null,fillProvenance:[],analysisProvenance:null});
 return{...data,name:`${source.name} (copy)`,divePlanId:null,status:'draft',warnings:[],safetyAcknowledgedAt:null,createdAt:stamp,modifiedAt:stamp};
}
