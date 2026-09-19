import type { DiveRecord } from './dives';
import type { CertificationRecord, PersonRecord } from './dive-planning';
import type { PlanTeamMember } from './dive-planning-centre';
import {
  diveSacBarPerMinute,
  diveSacLitresPerMinute,
} from './experience-analytics';

export type StoredPerson = PersonRecord & { entityId: string };
export type ProfileDerivedField =
  | 'highestRecreationalCertification'
  | 'highestTechnicalCertification'
  | 'highestProfessionalCertification'
  | 'totalLinkedDives'
  | 'maxDepthM'
  | 'averageSac'
  | 'averageRmv'
  | 'boatDives'
  | 'shoreDives'
  | 'nightDives'
  | 'wreckDives'
  | 'technicalDives'
  | 'lastDivedTogether';

export interface DerivedPersonStats extends Pick<
  PersonRecord,
  ProfileDerivedField
> {
  sources: Partial<
    Record<
      ProfileDerivedField,
      'auto-logbook' | 'auto-certifications' | 'unknown'
    >
  >;
}

export function personDisplayName(
  person: Pick<PersonRecord, 'name' | 'displayName' | 'forename' | 'surname'>,
) {
  return (
    person.displayName?.trim() ||
    [person.forename, person.surname].filter(Boolean).join(' ').trim() ||
    person.name
  );
}

export function hasPersonRole(
  person: PersonRecord,
  role: keyof NonNullable<PersonRecord['roles']>,
) {
  if (person.roles?.[role]) return true;
  if (role === 'buddy')
    return person.role === 'buddy' || person.role === 'both';
  if (role === 'instructor')
    return person.role === 'instructor' || person.role === 'both';
  return false;
}

export function personSearchText(person: PersonRecord) {
  return [
    personDisplayName(person),
    person.name,
    person.agency,
    person.operatorName,
    person.operatorLocation,
    person.highestKnownQualification,
    person.highestRecreationalCertification,
    person.highestTechnicalCertification,
    person.highestProfessionalCertification,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('en-GB');
}

export function planTeamMemberFromPerson(
  person: StoredPerson,
): PlanTeamMember {
  const specialties = Object.entries(person.certificationFlags ?? {})
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
    .join(', ');
  const capabilityEvidence =
    person.certificationEvidenceNotes ||
    person.highestKnownQualification ||
    person.highestTechnicalCertification ||
    person.highestRecreationalCertification ||
    person.highestProfessionalCertification ||
    person.highestQualification ||
    null;
  const recordedQualifications = [
    person.highestKnownQualification,
    person.highestRecreationalCertification,
    person.highestTechnicalCertification,
    person.highestProfessionalCertification,
    person.highestQualification,
  ]
    .filter(Boolean)
    .join(' ');
  const role = hasPersonRole(person, 'instructor')
    ? 'Instructor'
    : hasPersonRole(person, 'guide')
      ? 'Divemaster'
      : hasPersonRole(person, 'buddy')
        ? 'Buddy'
        : 'Diver';
  return {
    personId: person.entityId,
    role,
    rescueDiverStatus:
      person.certificationFlags?.rescue || /\brescue\b/i.test(recordedQualifications)
        ? 'yes'
        : 'unknown',
    certifiedDepthM: person.maxAllowedDepthM ?? null,
    capabilityEvidence,
    specialties: specialties || null,
  };
}

export function findOwnerProfile<T extends PersonRecord>(
  people: T[],
): T | null {
  return people.find((person) => person.roles?.ownerProfile) ?? null;
}

type EditablePerson = Omit<PersonRecord, 'createdAt' | 'modifiedAt'> & {
  entityId?: string;
};

export function assertSingleOwnerProfile(
  people: StoredPerson[],
  candidate: EditablePerson,
) {
  if (!candidate.roles?.ownerProfile) return;
  const duplicate = people.find(
    (person) =>
      person.roles?.ownerProfile && person.entityId !== candidate.entityId,
  );
  if (duplicate)
    throw new Error(
      'A My Profile Person already exists. Open that profile instead of creating another.',
    );
}

function average(values: Array<number | null | undefined>) {
  const qualifying = values.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value > 0,
  );
  return qualifying.length
    ? Math.round(
        (qualifying.reduce((sum, value) => sum + value, 0) /
          qualifying.length) *
          10,
      ) / 10
    : null;
}

function highestCertification(
  certifications: CertificationRecord[],
  track: 'rec' | 'tec' | 'pro',
) {
  const filtered = certifications.filter((certification) => {
    const text =
      `${certification.certification} ${certification.level} ${certification.courseType ?? ''}`.toLowerCase();
    const pro =
      /professional|divemaster|dive master|instructor|course director/.test(
        text,
      );
    const tec =
      /technical|\btec\b|trimix|decompression|extended range|ccr|rebreather/.test(
        text,
      );
    return track === 'pro' ? pro : track === 'tec' ? tec : !pro && !tec;
  });
  return (
    filtered.sort(
      (a, b) =>
        (b.awardPriority ?? 0) - (a.awardPriority ?? 0) ||
        (b.issuedAt || '').localeCompare(a.issuedAt || ''),
    )[0]?.certification ||
    filtered[0]?.level ||
    ''
  );
}

export function derivePersonProfileStats(
  person: EditablePerson,
  dives: Array<DiveRecord & { entityId: string }>,
  certifications: CertificationRecord[],
): DerivedPersonStats {
  const owner = Boolean(person.roles?.ownerProfile);
  const linked = owner
    ? dives
    : dives.filter((dive) => {
        const id = person.entityId;
        return Boolean(
          id &&
          [
            ...(dive.buddyIds ?? []),
            ...(dive.diveTeamIds ?? []),
            dive.diveLeaderId,
          ].includes(id),
        );
      });
  const values = {
    highestRecreationalCertification: highestCertification(
      certifications,
      'rec',
    ),
    highestTechnicalCertification: highestCertification(certifications, 'tec'),
    highestProfessionalCertification: highestCertification(
      certifications,
      'pro',
    ),
    totalLinkedDives: linked.length,
    maxDepthM: linked.length
      ? Math.max(
          ...linked
            .map((dive) => dive.maxDepthM ?? -Infinity)
            .filter(Number.isFinite),
        )
      : null,
    averageSac: average(linked.map(diveSacBarPerMinute)),
    averageRmv: average(linked.map(diveSacLitresPerMinute)),
    boatDives:
      linked.filter((dive) =>
        /boat/i.test([...(dive.diveTypes ?? []), dive.vessel ?? ''].join(' ')),
      ).length || null,
    shoreDives:
      linked.filter((dive) => /shore/i.test((dive.diveTypes ?? []).join(' ')))
        .length || null,
    nightDives:
      linked.filter((dive) => /night/i.test((dive.diveTypes ?? []).join(' ')))
        .length || null,
    wreckDives:
      linked.filter((dive) => /wreck/i.test((dive.diveTypes ?? []).join(' ')))
        .length || null,
    technicalDives:
      linked.filter(
        (dive) =>
          Boolean(dive.isTechnicalDive) ||
          /technical/.test(dive.diveMode ?? ''),
      ).length || null,
    lastDivedTogether:
      [...linked].sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? '',
  } satisfies Pick<PersonRecord, ProfileDerivedField>;
  if (values.maxDepthM === -Infinity) values.maxDepthM = null;
  const sources: DerivedPersonStats['sources'] = {};
  (Object.keys(values) as ProfileDerivedField[]).forEach((key) => {
    const value = values[key];
    sources[key] = key.startsWith('highest')
      ? value
        ? 'auto-certifications'
        : 'unknown'
      : value !== null && value !== ''
        ? 'auto-logbook'
        : 'unknown';
  });
  return { ...values, sources };
}

export function refreshPersonDerivedStats<
  T extends Omit<PersonRecord, 'createdAt' | 'modifiedAt'>,
>(person: T, derived: DerivedPersonStats, overwriteOverrides = false): T {
  const overrides = new Set(person.manualOverrideFields ?? []);
  const next = {
    ...person,
    profileValueSources: { ...person.profileValueSources },
  };
  (Object.keys(derived.sources) as ProfileDerivedField[]).forEach((key) => {
    if (overrides.has(key) && !overwriteOverrides) return;
    (next as Record<string, unknown>)[key] = derived[key];
    next.profileValueSources![key] = derived.sources[key] ?? 'unknown';
  });
  next.derivedStatsUpdatedAt = new Date().toISOString();
  next.derivedStatsSource = 'Canonical Dive and Certification records';
  return next as T;
}

export function sourceLabel(source?: string, overridden = false) {
  if (overridden) return 'Owner-entered · overrides auto-fill';
  if (source === 'auto') return 'Auto-filled';
  if (source === 'auto-logbook') return 'Auto-filled from Logbook';
  if (source === 'auto-certifications' || source === 'certification-derived')
    return 'Auto-filled from Certifications';
  if (source === 'owner-entered') return 'Owner-entered';
  return 'Unknown';
}
