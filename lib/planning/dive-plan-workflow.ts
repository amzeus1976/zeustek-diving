import {currentDiveAccount,listLocalDiveRecords,saveLocalRecord} from '../offline/dive-store';
import {createDiveDraftFromEnrichedPlan,type PlanTeamMember} from '../offline/dive-planning-centre';
import type {DiveRecord} from '../offline/dives';

export function plannedOxygenTeam(team:PlanTeamMember[] = [],selected:string[] = []) {
  const ids=new Set(team.map(member=>member.personId));
  return [...new Set(selected)].filter(id=>ids.has(id));
}

/** Explicitly link one reviewed log; never replace its observations or another origin. */
export async function linkLoggedDiveToPlan(planId:string,diveId:string,expectedModifiedAt:string) {
  const account=currentDiveAccount();
  if(!account)throw new Error('Sign in to link this Dive.');
  const draft=await createDiveDraftFromEnrichedPlan(planId);
  const dive=(await listLocalDiveRecords<DiveRecord>('dive')).find(row=>row.entityId===diveId);
  if(!dive)throw new Error('This Dive is no longer available. Refresh the list.');
  if(dive.originatingPlanId)throw new Error('This Dive is already linked to a Plan; its original provenance is retained.');
  if(dive.modifiedAt!==expectedModifiedAt||currentDiveAccount()!==account)throw new Error('The selected Dive or account changed. Review it again.');
  return saveLocalRecord('dive',{entityId:diveId,originatingPlanId:planId,originatingPlanRevision:draft.originatingPlanRevision});
}
