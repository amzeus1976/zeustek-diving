import {zeustekDb} from '../offline/db';
import {currentDiveAccount} from '../offline/dive-store';
import {saveRecord} from '../offline/dive-planning';
import {saveDivePlanWithGasLinks,type StoredGasPlanRecord} from '../offline/planning-pages';
import type {CalendarBooking} from './calendar-booking-workflow';
import {calendarTripLinkState} from './calendar-link-identity';

/** A reviewed new Plan and its event association commit together in the existing owner store. */
export async function saveCalendarPlanFromDraft(entry:CalendarBooking,input:Parameters<typeof saveDivePlanWithGasLinks>[0],gasPlans:StoredGasPlanRecord[],selectedIds:string[]){
 const account=currentDiveAccount(),accountModule=`dive:${account}`;
 const sameAccount=()=>{if(!account||currentDiveAccount()!==account)throw new Error('The account changed. Reopen the event before saving.');};
 sameAccount();
 if(entry.calendarSource==='dive-trip'||input.entityId)throw new Error('Reopen this event to create a new Plan.');
 return zeustekDb.transaction('rw',[zeustekDb.entities,zeustekDb.events,zeustekDb.eventParents,zeustekDb.entityHeads,zeustekDb.outbox,zeustekDb.settings,zeustekDb.syncState],async()=>{
  sameAccount();const row=await zeustekDb.entities.get(`${accountModule}:${entry.entityId}`);
  const current=row?.record as unknown as CalendarBooking|undefined;
  if(!row||row.deleted||row.entityType!=='trip'||!current||!('bookingKind' in current)||current.modifiedAt!==entry.modifiedAt)throw new Error('This event changed or is unavailable. Reopen it before creating a Plan.');
  if(current.linkedDivePlanId)throw new Error('This event already links to a Dive Plan. Open that Plan instead.');
  const tripRows=await zeustekDb.entities.where('[module+entityType]').equals([accountModule,'dive-trip']).toArray();
  const trips=tripRows.filter(row=>!row.deleted&&row.record).map(row=>row.record as unknown as {entityId:string;calendarBookingIds?:unknown;originCalendarBookingId?:unknown});
  const association=calendarTripLinkState(current.entityId,current.linkedTripId,trips);
  if(association.conflict||association.linkedTripId!==(entry.linkedTripId??null))throw new Error('This event’s Trip association changed or needs review. Reopen the event before saving.');
  if(input.tripId&&!trips.some(trip=>trip.entityId===input.tripId))throw new Error('The selected Trip is unavailable. Refresh it before saving.');
  const pending=(await zeustekDb.settings.get(`pending:${accountModule}:${entry.entityId}`))?.value as {state?:string}|undefined;
  if(pending?.state==='conflict')throw new Error('Review this event’s sync differences before creating a Plan.');
  const freshGas:StoredGasPlanRecord[]=[];
  for(const id of new Set(selectedIds)){
   sameAccount();const gasRow=await zeustekDb.entities.get(`${accountModule}:${id}`),reviewed=gasPlans.find(gas=>gas.entityId===id);
   const gas=gasRow?.record as unknown as StoredGasPlanRecord|undefined;
   const gasPending=(await zeustekDb.settings.get(`pending:${accountModule}:${id}`))?.value as {state?:string}|undefined;
   if(!gasRow||gasRow.deleted||gasRow.entityType!=='gas-plan'||!gas||!reviewed||gas.modifiedAt!==reviewed.modifiedAt||gasPending?.state==='conflict')throw new Error('A selected Gas Plan changed. Refresh and review it before saving.');
   freshGas.push(gas);
  }
  const result=await saveDivePlanWithGasLinks(input,freshGas,selectedIds);
  sameAccount();await saveRecord('trip',{...current,linkedDivePlanId:result.id});sameAccount();
  return result;
 });
}
