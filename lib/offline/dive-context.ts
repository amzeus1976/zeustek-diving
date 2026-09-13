import { zeustekDb } from './db';
import { currentDiveAccount, listLocalDiveRecords, saveLocalRecord } from './dive-store';
import { recordHash } from './canonical';
import type { DiveRecord } from './dives';
import type { DiveTripRecord } from './dive-planning';

/** Shared evidence, not a second skills catalogue or copied course progress. */
export interface SkillEvidenceRecord {
  entityId: string;
  skillKey: string;
  userId?: string;
  performedAt?: string;
  diveId?: string | null;
  assessment?: string;
  environment?: string;
  evaluatorPersonId?: string | null;
  attachmentIds?: string[];
  notes?: string;
}
export const listSkillEvidence = () => listLocalDiveRecords<SkillEvidenceRecord>('skill_evidence');

export async function createDiveDraftFromPlan(planId: string): Promise<Partial<DiveRecord>> {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in to use this Dive Plan.');
  const key = `dive:${account}:${planId}`;
  let entity = await zeustekDb.entities.get(key);
  if (!entity || entity.deleted || entity.entityType !== 'trip' || !entity.record) throw new Error('Load this Dive Plan before creating a log.');
  let event = entity.updatedEventId ? await zeustekDb.events.get(entity.updatedEventId) : undefined;
  // Legacy cloud projections have no immutable local revision. Retain a revision
  // through the SAME Plan mutation API/ID before linking it, never a copied Plan.
  if (!event || event.recordHash !== await recordHash(entity.record)) {
    if (currentDiveAccount() !== account) throw new Error('Account changed. Reopen this Dive Plan.');
    await saveLocalRecord('trip', { entityId: planId });
    entity = await zeustekDb.entities.get(key);
    event = entity?.updatedEventId ? await zeustekDb.events.get(entity.updatedEventId) : undefined;
  }
  if (currentDiveAccount() !== account || !entity?.record || entity.deleted || !event?.record || event.entityId !== key || event.recordHash !== await recordHash(entity.record)) throw new Error('The Plan changed while preparing this log. Reopen it and try again.');
  const plan = entity.record as unknown as DiveTripRecord;
  const start = plan.startAt || plan.startDate;
  return {
    site: plan.siteName || plan.name, siteId: plan.siteId ?? '',
    originatingPlanId: planId,
    originatingPlanRevision: { eventId: event.eventId, recordHash: event.recordHash, modifiedAt: plan.modifiedAt },
    date: start?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    timeIn: start?.includes('T') ? start.slice(11, 16) : '',
    notes: [plan.notes, `Created from dive plan: ${plan.name}`].filter(Boolean).join('\n\n'),
    source: 'manual', gas: 'Air',
  };
}

/** Resolve the immutable revision, NEVER substitute a later editable Plan. */
export async function loadOriginatingPlan(dive: DiveRecord): Promise<DiveTripRecord | null> {
  const revision = dive.originatingPlanRevision;
  const account = currentDiveAccount();
  if (!account || !dive.originatingPlanId || !revision) return null;
  const event = await zeustekDb.events.get(revision.eventId);
  if (currentDiveAccount() !== account || !event?.record || event.entityId !== `dive:${account}:${dive.originatingPlanId}` || event.entityType !== 'trip' || event.recordHash !== revision.recordHash || await recordHash(event.record) !== revision.recordHash) return null;
  return event.record as unknown as DiveTripRecord;
}

export function planComparison(plan: DiveTripRecord, dive: DiveRecord): Array<[string, string, string]> {
  const enriched = plan as DiveTripRecord & { plannedMaxDepthM?: number; plannedDurationMin?: number };
  return [
    ['Site', plan.siteName || 'Not recorded', dive.site || 'Not recorded'],
    ['Start', plan.startAt || plan.startDate || 'Not recorded', [dive.date, dive.timeIn].filter(Boolean).join(' ') || 'Not recorded'],
    ['Buddy / team', plan.buddy || 'Not recorded', 'See recorded Dive team'],
    ['Maximum depth', enriched.plannedMaxDepthM == null ? 'Not recorded' : `${enriched.plannedMaxDepthM} m`, dive.maxDepthM == null ? 'Not recorded' : `${dive.maxDepthM} m`],
    ['Dive duration', enriched.plannedDurationMin == null ? 'Not recorded' : `${enriched.plannedDurationMin} min`, (dive.totalElapsedMin ?? dive.bottomTimeMin) == null ? 'Not recorded' : `${dive.totalElapsedMin ?? dive.bottomTimeMin} min`],
  ];
}
