import {expect,it} from 'vitest';
import {parseWorkflowDestination,workflowDestinationUrl} from '../lib/workflow/workflow-destination';
it('retains exact profile, cylinder history and relationship source context through canonical navigation',()=>{
 for(const [route,params] of [['Dive Computer Imports',{importId:'i',profileId:'p',resolutionId:'r'}],['Cylinders & Gas',{cylinderId:'c',fillId:'f',analysisId:'a'}],['People',{personId:'person',relationshipId:'person-link'}],['Dive Centres',{operatorId:'centre',relationshipId:'entity-link'}]] as const){
  const parsed=parseWorkflowDestination(workflowDestinationUrl({route,params}));expect(parsed.route).toBe(route);expect(parsed.params).toEqual(params);
 }
});
it('addresses a Calendar booking with its exact event ID and rejects unrelated query payloads',()=>{
 expect(parseWorkflowDestination(workflowDestinationUrl({route:'Diving Calendar & Bookings',recordId:'exact-event'}))).toMatchObject({route:'Diving Calendar & Bookings',recordId:'exact-event',params:{eventId:'exact-event'}});
 expect(parseWorkflowDestination('?section=People&personId=p&secret=PRIVATE').params).toEqual({personId:'p'});
});
