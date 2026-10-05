import {workflowDestinationUrl} from '../workflow/workflow-destination';
import type {CalendarBooking} from './calendar-booking-workflow';
import type {DiveExpeditionTripRecord} from '../offline/trips-expeditions';
import type {Stored} from '../offline/dive-planning';
import type {EnrichedDivePlan} from '../offline/dive-planning-centre';
export function calendarPlanDestination(entry:Pick<CalendarBooking,'entityId'|'linkedDivePlanId'|'calendarSource'>){return workflowDestinationUrl(entry.calendarSource==='dive-trip'?{route:'Dive Plans',params:{newPlanForTrip:entry.entityId}}:{route:'Dive Plans',recordId:entry.linkedDivePlanId||entry.entityId});}
/** Read both canonical directions without manufacturing another persisted relationship. */
export function linkedPlanIdsForTrip(trip:Pick<Stored<DiveExpeditionTripRecord>,'entityId'|'planIds'>,plans:ReadonlyArray<{entityId:string;tripId?:string|null}>){return [...new Set([...trip.planIds,...plans.filter(plan=>plan.tripId===trip.entityId).map(plan=>plan.entityId)])];}
export function resolvePlanSelection(plans:ReadonlyArray<{entityId:string}>,current:string,requested:string|null,consumed:boolean){if(requested&&!consumed)return plans.some(plan=>plan.entityId===requested)?{id:requested,consumed:true}:{id:'',consumed:false};return{id:plans.some(plan=>plan.entityId===current)?current:plans[0]?.entityId??'',consumed:true};}
export function planDraftForTrip(draft:Omit<EnrichedDivePlan,'createdAt'|'modifiedAt'>,trip:Stored<DiveExpeditionTripRecord>){return {...draft,name:`${trip.name} — Dive Plan`,tripId:trip.entityId,startDate:trip.startsOn?.slice(0,10)||draft.startDate,endDate:trip.endsOn?.slice(0,10)||trip.startsOn?.slice(0,10)||draft.endDate,...(trip.siteIds.length===1?{siteId:trip.siteIds[0]}:{})};}
