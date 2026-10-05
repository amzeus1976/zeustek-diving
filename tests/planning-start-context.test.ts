import {describe,it,expect} from 'vitest';
import {calendarPlanDestination,planDraftForTrip} from '../lib/planning/planning-start-context';
import {parseWorkflowDestination} from '../lib/workflow/workflow-destination';
import type {Stored} from '../lib/offline/dive-planning';
import type {DiveExpeditionTripRecord} from '../lib/offline/trips-expeditions';
import type {EnrichedDivePlan} from '../lib/offline/dive-planning-centre';
describe('Canonical planning workflow context',()=>{
 it('opens the exact canonical event Plan or explicitly linked Plan',()=>{expect(parseWorkflowDestination(calendarPlanDestination({entityId:'event'}))).toMatchObject({route:'Dive Plans',recordId:'event'});expect(parseWorkflowDestination(calendarPlanDestination({entityId:'event',linkedDivePlanId:'specific'}))).toMatchObject({recordId:'specific'});});
 it('opens a new reviewed draft for a Trip-backed event, keeping its exact ID',()=>{expect(parseWorkflowDestination(calendarPlanDestination({entityId:'trip & Unicode船',calendarSource:'dive-trip'}))).toMatchObject({route:'Dive Plans',params:{newPlanForTrip:'trip & Unicode船'}});});
 it('prefills only reviewable Trip/date/single-Site context and preserves the original Trip',()=>{const trip={entityId:'holiday',name:'Holiday',startsOn:'2026-11-10',endsOn:'2026-11-12',siteIds:['site'],notes:'Private source',planIds:['old']} as Stored<DiveExpeditionTripRecord>;const before=structuredClone(trip);const draft=planDraftForTrip({name:'',startDate:'today',endDate:'today',lifecycleStatus:'draft'} as EnrichedDivePlan,trip);expect(draft).toMatchObject({name:'Holiday — Dive Plan',tripId:'holiday',startDate:'2026-11-10',endDate:'2026-11-12',siteId:'site',lifecycleStatus:'draft'});expect(draft).not.toHaveProperty('entityId');expect(draft).not.toHaveProperty('notes');expect(trip).toEqual(before);});
 it('does not guess a Site when a Trip has several Sites',()=>{expect(planDraftForTrip({name:'',startDate:'today',endDate:'today'} as EnrichedDivePlan,{entityId:'trip',name:'Trip',siteIds:['first','second']} as Stored<DiveExpeditionTripRecord>)).not.toHaveProperty('siteId');});
});
