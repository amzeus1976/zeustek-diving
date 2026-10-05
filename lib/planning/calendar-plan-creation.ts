import Dexie from 'dexie';
import {zeustekDb} from '../offline/db';
import {currentDiveAccount} from '../offline/dive-store';
import {recordHash} from '../offline/canonical';
import type {JsonValue} from '../offline/types';
import {saveRecord} from '../offline/dive-planning';
import {saveDivePlanWithGasLinks,type StoredGasPlanRecord} from '../offline/planning-pages';
import type {CalendarBooking} from './calendar-booking-workflow';
import {calendarTripLinkState} from './calendar-link-identity';
type ReviewedTrip={entityId:string;modifiedAt:string};
type ReviewedPlan={entityId:string;modifiedAt:string};
/** Plan, event and inverse Trip links use reviewed revisions and one owner-store transaction. */
export async function savePlanDraftWithConnections(input:Parameters<typeof saveDivePlanWithGasLinks>[0],gasPlans:StoredGasPlanRecord[],selectedIds:string[],reviewedTrips:readonly ReviewedTrip[],reviewedPlan?:ReviewedPlan|null,entry?:CalendarBooking|null){
 const account=currentDiveAccount(),accountModule=`dive:${account}`;
 const sameAccount=()=>{if(!account||currentDiveAccount()!==account)throw new Error('The account changed. Reopen the editor before saving.');};
 sameAccount();
 if(entry&&(entry.calendarSource==='dive-trip'||input.entityId))throw new Error('Reopen this event to create a new Plan.');
 return zeustekDb.transaction('rw',[zeustekDb.entities,zeustekDb.events,zeustekDb.eventParents,zeustekDb.entityHeads,zeustekDb.outbox,zeustekDb.settings,zeustekDb.syncState],async()=>{
  sameAccount();
  const pendingConflict=async(id:string)=>((await zeustekDb.settings.get(`pending:${accountModule}:${id}`))?.value as {state?:string}|undefined)?.state==='conflict';
  const tripRows=await zeustekDb.entities.where('[module+entityType]').equals([accountModule,'dive-trip']).toArray();
  const trips=tripRows.filter(row=>!row.deleted&&row.record).map(row=>row.record as unknown as ReviewedTrip&{planIds?:string[];calendarBookingIds?:unknown;originCalendarBookingId?:unknown});
  let current:CalendarBooking|undefined;
  if(entry){
   const row=await zeustekDb.entities.get(`${accountModule}:${entry.entityId}`);
   current=row?.record as unknown as CalendarBooking|undefined;
   if(!row||row.deleted||row.entityType!=='trip'||!current||!('bookingKind' in current)||current.modifiedAt!==entry.modifiedAt)throw new Error('This event changed or is unavailable. Reopen it before creating a Plan.');
   if(current.linkedDivePlanId)throw new Error('This event already links to a Dive Plan. Open that Plan instead.');
   const association=calendarTripLinkState(current.entityId,current.linkedTripId,trips);
   if(association.conflict||association.linkedTripId!==(entry.linkedTripId??null))throw new Error('This event’s Trip association changed or needs review. Reopen the event before saving.');
   if(await pendingConflict(entry.entityId))throw new Error('Review this event’s sync differences before creating a Plan.');
  }
  let oldTripId:string|undefined;
  if(input.entityId){
   const row=await zeustekDb.entities.get(`${accountModule}:${input.entityId}`),plan=row?.record as unknown as ReviewedPlan&{tripId?:string;bookingKind?:unknown}|undefined;
   if(!reviewedPlan||reviewedPlan.entityId!==input.entityId||!row||row.deleted||row.entityType!=='trip'||!plan||'bookingKind' in plan||plan.modifiedAt!==reviewedPlan.modifiedAt||await pendingConflict(input.entityId))throw new Error('This Dive Plan changed or needs sync review. Reopen it before saving.');
   oldTripId=plan.tripId;
  }
  const changedTrips=new Map<string,typeof trips[number]>();
  for(const id of new Set([input.tripId,oldTripId&&oldTripId!==input.tripId?oldTripId:null].filter((id):id is string=>Boolean(id)))){
   const trip=trips.find(row=>row.entityId===id),reviewed=reviewedTrips.find(row=>row.entityId===id);
   if(!trip||!reviewed||trip.modifiedAt!==reviewed.modifiedAt||await Dexie.waitFor(recordHash(trip as unknown as JsonValue))!==await Dexie.waitFor(recordHash(reviewed as unknown as JsonValue))||await pendingConflict(id))throw new Error('A linked Trip changed or needs review. Reopen it before saving.');
   if(trip.planIds!==undefined&&!Array.isArray(trip.planIds))throw new Error('The Trip Plan links need review before saving.');
   changedTrips.set(id,trip);
  }
  const freshGas:StoredGasPlanRecord[]=[];
  for(const id of new Set(selectedIds)){
   sameAccount();const gasRow=await zeustekDb.entities.get(`${accountModule}:${id}`),reviewed=gasPlans.find(gas=>gas.entityId===id);
   const gas=gasRow?.record as unknown as StoredGasPlanRecord|undefined;
   if(!gasRow||gasRow.deleted||gasRow.entityType!=='gas-plan'||!gas||!reviewed||gas.modifiedAt!==reviewed.modifiedAt||await pendingConflict(id))throw new Error('A selected Gas Plan changed. Refresh and review it before saving.');
   freshGas.push(gas);
  }
  const result=await saveDivePlanWithGasLinks(input,freshGas,selectedIds);sameAccount();
  if(current)await saveRecord('trip',{...current,linkedDivePlanId:result.id});
  for(const [id,trip] of changedTrips){
   const planIds=trip.planIds??[];
   const next=id===input.tripId?planIds.includes(result.id)?planIds:[...planIds,result.id]:planIds.filter(planId=>planId!==result.id);
   if(JSON.stringify(next)!==JSON.stringify(planIds))await saveRecord('dive-trip',{...trip,planIds:next});
  }
  sameAccount();return result;
 });
}
export function saveCalendarPlanFromDraft(entry:CalendarBooking,input:Parameters<typeof saveDivePlanWithGasLinks>[0],gasPlans:StoredGasPlanRecord[],selectedIds:string[],reviewedTrips:readonly ReviewedTrip[]=[]){
 return savePlanDraftWithConnections(input,gasPlans,selectedIds,reviewedTrips,null,entry);
}
