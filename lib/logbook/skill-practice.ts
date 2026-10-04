import { DIVE_SETTING_GROUPS } from '../dive-setting-options';
import type { DiveRecord } from '../offline/dives';
import { resolveCanonicalSkillReference, skillRecordGroup, skillRecordName, type CanonicalSkillRecord, type SkillEvidenceRecord } from '../offline/dive-context';

const waterBodies: readonly string[] = DIVE_SETTING_GROUPS[0].options;
export const SKILL_ENVIRONMENTS = [...waterBodies, 'Open water', 'Confined water', 'Saltwater', 'Freshwater', 'Brackish', 'Other'] as const;
export const SKILL_ASSESSMENTS = ['Self assessed', 'Buddy observed', 'Instructor assessed', 'Guide observed', 'Practice — not formally assessed', 'Other'] as const;

/** Saved Dive evidence only. No location/name inference or automatic record write. */
export function diveSkillEnvironment(dive: Pick<DiveRecord, 'diveTypes' | 'waterType'>): string {
  const recorded = [...new Set((dive.diveTypes ?? []).filter(value => waterBodies.includes(value)))];
  return recorded.join(' / ') || dive.waterType || '';
}

export function availableDiveSkills(dive: Pick<DiveRecord, 'debrief'> & {entityId:string}, skills: CanonicalSkillRecord[], evidence: SkillEvidenceRecord[]): CanonicalSkillRecord[] {
  const linked = new Set(dive.debrief?.skillEvidenceIds ?? []);
  const practised = new Set(evidence.filter(item => item.diveId === dive.entityId || linked.has(item.entityId))
    .map(item => resolveCanonicalSkillReference(item.skillKey, skills)?.entityId ?? item.skillKey));
  return skills.filter(skill => !skill.archived && !practised.has(skill.entityId))
    .sort((a,b) => skillRecordGroup(a).localeCompare(skillRecordGroup(b),'en-GB') || skillRecordName(a).localeCompare(skillRecordName(b),'en-GB'));
}
