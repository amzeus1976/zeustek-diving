'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {ProfessionalRequirementBuilder} from './professional-requirement-builder';
import {ProfessionalGuide} from './professional-guide';
import {RecordEditorWorkspace} from './shared/record-editor-workspace';
import { AccessibleDialog } from './accessible-dialog';
import { ZeusTekIcon } from './zeustek-icon';
import { MediaGallery } from './media-gallery';
import { useRecordRefresh } from './record-status';
import { listDives, type DiveRecord } from '../lib/offline/dives';
import {
  listCanonicalSkills,
  listSkillEvidence,
  skillRecordName,
  type CanonicalSkillRecord,
  type SkillEvidenceRecord,
} from '../lib/offline/dive-context';
import {
  listCertifications,
  listDiveSites,
  listPeople,
  type CertificationRecord,
  type DiveSiteRecord,
  type PersonRecord,
  type Stored,
} from '../lib/offline/dive-planning';
import {
  PROFESSIONAL_EVIDENCE_CATEGORIES,
  professionalAssessmentFields,
  captureProfessionalRequirementSet,
  createRequirementEvidenceLink,
  deleteProfessionalEvidence,
  deleteProfessionalPathway,
  evaluateProfessionalReadiness,
  listProfessionalEvidence,
  listProfessionalPathways,
  listProfessionalRequirementSets,
  professionalEvidenceReferenceIssueSummary,
  professionalEvidenceSummary,
  professionalWaterSkillsProgress,
  requirementSetForPathway,
  saveProfessionalEvidence,
  saveProfessionalPathway,
  updateProfessionalEvidenceAttachments,
  type EvaluatedProfessionalRequirement,
  type ProfessionalEvidenceRecord,
  type ProfessionalPathwayRecord,
  type ProfessionalReferenceRequirementSetRecord,
  type ProfessionalRequirementDefinition,
} from '../lib/offline/professional-development';
import { isWaterSkillsRubric } from '../lib/professional-development/water-skills';
import styles from './professional-development.module.css';

const evidenceText=(value:unknown):string=>{if(value==null)return '';if(typeof value==='string')return value;if(typeof value==='number'||typeof value==='boolean')return String(value);return JSON.stringify(value)??'';};

type Props = { go?: (next: string) => void };
type EvidenceDraft = Stored<ProfessionalEvidenceRecord> | null;
type RequirementTarget = {
  requirement: EvaluatedProfessionalRequirement;
  requirementSet: Stored<ProfessionalReferenceRequirementSetRecord>;
} | null;

const statusLabels: Record<string, string> = {
  considering: 'Considering',
  enrolled: 'Enrolled',
  in_progress: 'In progress',
  paused: 'Paused',
  completed: 'Completed',
};
const stateLabels: Record<string, string> = {
  satisfied: 'Satisfied',
  not_satisfied: 'Needs evidence',
  unknown: 'Unknown',
  manual_review: 'Review required',
};
const nowLocal = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

export function ProfessionalDevelopment({ go }: Props) {
  const [pathways, setPathways] = useState<
    Array<Stored<ProfessionalPathwayRecord>>
  >([]);
  const [evidence, setEvidence] = useState<
    Array<Stored<ProfessionalEvidenceRecord>>
  >([]);
  const [requirementSets, setRequirementSets] = useState<
    Array<Stored<ProfessionalReferenceRequirementSetRecord>>
  >([]);
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>(
    [],
  );
  const [certifications, setCertifications] = useState<
    Array<Stored<CertificationRecord>>
  >([]);
  const [skills, setSkills] = useState<CanonicalSkillRecord[]>([]);
  const [skillEvidence, setSkillEvidence] = useState<SkillEvidenceRecord[]>([]);
  const [sites, setSites] = useState<Array<Stored<DiveSiteRecord>>>([]);
  const [people, setPeople] = useState<Array<Stored<PersonRecord>>>([]);
  const [selectedPathwayId, setSelectedPathwayId] = useState('');
  const [editingPathway, setEditingPathway] = useState<
    Stored<ProfessionalPathwayRecord> | null | undefined
  >(undefined);
  const [editingEvidence, setEditingEvidence] = useState<
    EvidenceDraft | undefined
  >(undefined);
  const [detailEvidence, setDetailEvidence] =
    useState<Stored<ProfessionalEvidenceRecord> | null>(null);
  const [referenceEditorOpen, setReferenceEditorOpen] = useState(false);
  const [requirementTarget, setRequirementTarget] =
    useState<RequirementTarget>(null);

  const refresh = useCallback(async () => {
    const [
      nextPathways,
      nextEvidence,
      nextRequirementSets,
      nextDives,
      nextCertifications,
      nextSkills,
      nextSkillEvidence,
      nextSites,
      nextPeople,
    ] = await Promise.all([
      listProfessionalPathways(),
      listProfessionalEvidence(),
      listProfessionalRequirementSets(),
      listDives(),
      listCertifications(),
      listCanonicalSkills(),
      listSkillEvidence(),
      listDiveSites(),
      listPeople(),
    ]);
    setPathways(
      nextPathways.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'en-GB'),
      ),
    );
    setEvidence(
      nextEvidence.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    );
    setRequirementSets(
      nextRequirementSets.sort((a, b) =>
        b.capturedAt.localeCompare(a.capturedAt),
      ),
    );
    setDives(nextDives);
    setCertifications(nextCertifications);
    setSkills(nextSkills);
    setSkillEvidence(nextSkillEvidence);
    setSites(nextSites);
    setPeople(nextPeople);
    setSelectedPathwayId((current) =>
      current && nextPathways.some((item) => item.entityId === current)
        ? current
        : (nextPathways[0]?.entityId ?? ''),
    );
  }, []);
  useRecordRefresh(refresh);

  const pathway =
    pathways.find((item) => item.entityId === selectedPathwayId) ?? null;
  const pathwayEvidence = useMemo(
    () => evidence.filter((item) => item.pathwayId === pathway?.entityId),
    [evidence, pathway?.entityId],
  );
  const requirementSet = useMemo(() => pathway
    ? requirementSetForPathway(pathway, requirementSets)
    : null, [pathway, requirementSets]);
  const waterRequirement = requirementSet?.requirements.find(item => item.kind === 'assessment' && item.rule.source === 'water-skills');
  const waterRubric = waterRequirement && isWaterSkillsRubric(waterRequirement.rule.rubric) ? waterRequirement.rule.rubric : null;
  const waterProgress = waterRubric && waterRequirement && requirementSet ? professionalWaterSkillsProgress(
    waterRubric, requirementSet.entityId, waterRequirement.key,
    { pathwayId: pathway?.entityId, dives, certifications, skills, skillEvidence, professionalEvidence: pathwayEvidence, sites, people },
  ) : null;
  const readiness = useMemo(
    () =>
      evaluateProfessionalReadiness(requirementSet, {
        pathwayId: pathway?.entityId,
        dives,
        certifications,
        skills,
        skillEvidence,
        professionalEvidence: pathwayEvidence,
        sites,
        people,
      }),
    [
      requirementSet,
      pathway?.entityId,
      dives,
      certifications,
      skills,
      skillEvidence,
      pathwayEvidence,
      sites,
      people,
    ],
  );
  const summary = useMemo(
    () => professionalEvidenceSummary(pathwayEvidence),
    [pathwayEvidence],
  );
  const referenceHealth = useMemo(
    () =>
      professionalEvidenceReferenceIssueSummary(pathwayEvidence, {
        dives,
        certifications,
        skills,
        skillEvidence,
        professionalEvidence: pathwayEvidence,
        sites,
        people,
      }),
    [
      pathwayEvidence,
      dives,
      certifications,
      skills,
      skillEvidence,
      sites,
      people,
    ],
  );
  const mentors =
    pathway?.mentorPersonIds
      .map((id) => people.find((person) => person.entityId === id)?.name)
      .filter(Boolean) ?? [];

  async function removePathway() {
    if (!pathway || pathwayEvidence.length) return;
    if (
      !window.confirm(
        `Delete ${pathway.displayName}? This is only allowed while it has no Professional Evidence.`,
      )
    )
      return;
    await deleteProfessionalPathway(pathway.entityId);
    await refresh();
  }

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div className="focus-heading-title">
          <ZeusTekIcon id="divemaster-pro" size="heading" />
          <div>
          <span className="focus-eyebrow">PROFESSIONAL DEVELOPMENT</span>
          <h1>Professional Development</h1>
          <p>
            Track professional readiness from versioned requirements and
            evidence already held in ZeusTek. Unknown stays unknown until you
            record or link evidence. Readiness is advisory, not agency certification or permission to dive.
          </p>
          </div>
        </div>
        <button
          className="focus-primary"
          onClick={() => setEditingEvidence(null)}
          disabled={!pathway}
        >
          <Plus size={17} />
          Log experience
        </button>
      </header>

      <ProfessionalGuide key={pathway?.entityId??'new'} pathwayId={pathway?.entityId??''} requirementSetId={requirementSet?.entityId??null} evidenceCount={pathwayEvidence.length} createPathway={()=>setEditingPathway(null)} captureRequirements={()=>setReferenceEditorOpen(true)} addEvidence={()=>setEditingEvidence(null)}/>

      {!pathways.length ? (
        <section className={`focus-card ${styles.empty}`}>
          <GraduationCap />
          <h2>Create your first professional pathway</h2>
          <p>
            ZeusTek does not bundle supposedly-current agency requirement
            numbers. Create the pathway, then attach a dated requirement
            snapshot from a source you have checked.
          </p>
          <button
            className="focus-primary"
            onClick={() => setEditingPathway(null)}
          >
            <Plus size={17} />
            Create pathway
          </button>
        </section>
      ) : (
        <>
          <section className={styles.pathwayBar}>
            <label>
              Pathway
              <select
                value={selectedPathwayId}
                onChange={(event) => setSelectedPathwayId(event.target.value)}
              >
                {pathways.map((item) => (
                  <option key={item.entityId} value={item.entityId}>
                    {item.agency} · {item.displayName}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button className="focus-secondary" onClick={() => setEditingPathway(null)}><Plus size={15}/>New pathway</button>
              <button
                className="focus-secondary"
                onClick={() => setEditingPathway(pathway!)}
              >
                <Pencil size={15} />
                Edit pathway
              </button>
              <button
                className="focus-secondary"
                onClick={() => setReferenceEditorOpen(true)}
              >
                <ClipboardCheck size={15} />
                {requirementSet
                  ? 'Capture newer requirement version'
                  : 'Capture requirements'}
              </button>
            </div>
          </section>

          <section className={`focus-card ${styles.hero}`}>
            <div className={styles.heroIntro}>
              <span className="focus-eyebrow">
                {pathway?.agency} ·{' '}
                {statusLabels[pathway?.status ?? ''] ?? pathway?.status}
              </span>
              <h2>{pathway?.displayName}</h2>
              <p>
                {requirementSet
                  ? `Requirement snapshot: ${requirementSet.versionLabel} · ${requirementSet.sourceCitation || 'source not recorded'}`
                  : 'No requirement snapshot selected. Readiness is intentionally Unknown.'}
              </p>
              <small>
                {mentors.length
                  ? `Mentors: ${mentors.join(', ')}`
                  : 'No mentor/evaluator linked yet.'}
              </small>
            </div>
            <div className={styles.score} data-state={readiness.state}>
              <b>{requirementSet ? `${readiness.percent}%` : '—'}</b>
              <span>
                {requirementSet ? stateLabels[readiness.state] : 'Unknown'}
              </span>
              {requirementSet && (readiness.unknown + readiness.manualReview > 0) && <small>Known checks only</small>}
            </div>
            <div className={styles.heroStats}>
              <div>
                <b>{readiness.satisfied}</b>
                <span>Satisfied</span>
              </div>
              <div>
                <b>{readiness.notSatisfied}</b>
                <span>Needs evidence</span>
              </div>
              <div>
                <b>{readiness.manualReview + readiness.unknown}</b>
                <span>Unknown / review</span>
              </div>
            </div>
          </section>
          {referenceHealth.issues.length > 0 && (
            <section className={styles.integrityWarning} aria-live="polite">
              <AlertTriangle size={18} />
              <div>
                <b>
                  {referenceHealth.affectedEvidenceCount} evidence record
                  {referenceHealth.affectedEvidenceCount === 1 ? '' : 's'} need
                  reference review
                </b>
                <span>
                  {referenceHealth.issues.length} saved link
                  {referenceHealth.issues.length === 1 ? '' : 's'} point to
                  records that are not currently available on this device. The
                  evidence itself has not been deleted.
                </span>
              </div>
            </section>
          )}

          {waterProgress && waterRequirement && waterRubric && requirementSet && pathway && (
            <section className={`focus-card ${styles.waterWorkspace}`} aria-label="Water skills and stamina progress">
              <div className={styles.sectionHead}>
                <div><span className="focus-eyebrow">WATER SKILLS &amp; STAMINA</span><h2>Five-exercise progress</h2>
                  <p>{waterRubric.source}. This tracks recorded points, not PADI course completion.</p></div>
                <strong>{waterProgress.complete ? `${waterProgress.total} / 25` : `${waterProgress.total} / 25 partial`}</strong>
              </div>
              <p>Progress: {waterProgress.status === 'not_started' ? 'Not started' :
                waterProgress.status === 'minimum_met' ? '15-point target met' :
                waterProgress.status === 'above_minimum' ? 'Above 15-point target / improving' : 'In progress'}.
                {waterProgress.incompleteAttemptCount > 0 ? ` ${waterProgress.incompleteAttemptCount} incomplete attempt(s).` : ''}
                {waterProgress.needsEvaluatorCount > 0 ? ` ${waterProgress.needsEvaluatorCount} formal attempt(s) need an evaluator.` : ''}</p>
              <p>{waterProgress.complete
                ? waterProgress.minimumProgressMet ? `${waterProgress.pointsAboveTarget} point(s) above the 15-point progress target; keep improving toward 25.` : `${waterProgress.pointsToTarget} point(s) to the 15-point progress target.`
                : `${waterProgress.exercises.filter(item => !item.formal).length} exercise(s) still need signed formal evidence. Partial points do not establish completion.`}</p>
              <progress max={25} value={waterProgress.total} aria-label="Recorded water-skills points out of 25" />
              <div className={styles.waterRows}>
                {waterProgress.exercises.map(row => <details key={row.key}>
                  <summary><b>{row.label}</b><span>{row.formal ? `${row.formal.score} / 5 formal` : 'No signed formal score'}</span></summary>
                  <p>Latest: {row.latest?.score ?? 'Incomplete / unassessed'} · Personal best: {row.best?.score ?? '—'}</p>
                  {row.attempts.map(attempt => <button type="button" className="focus-link" key={attempt.id}
                    onClick={() => { const item = pathwayEvidence.find(evidence => evidence.entityId === attempt.id); if (item) setDetailEvidence(item); }}>
                    {new Date(attempt.attempt.occurredAt).toLocaleDateString('en-GB')} · {attempt.attempt.mode} · {attempt.score ?? 'Incomplete'}
                    {attempt.reasons.length ? ` · ${attempt.reasons.join('; ')}` : ''}
                    {attempt.warnings.length ? ` · ${attempt.warnings.join('; ')}` : ''}
                  </button>)}
                  <button type="button" className="focus-secondary" onClick={() => setEditingEvidence({
                    ...emptyEvidence(pathway.entityId, 'stamina'), entityId: '',
                    requirementSetId: requirementSet.entityId, requirementKey: waterRequirement.key,
                    payload: { rubricId: waterRubric.id, exerciseKey: row.key, attemptMode: 'practice',
                      ...((row.key === 'swim-400' || row.key === 'snorkel-800' || row.key === 'tow-100')
                        ? { distanceM: row.key === 'swim-400' ? 400 : row.key === 'snorkel-800' ? 800 : 100 } : {}) },
                  } as Stored<ProfessionalEvidenceRecord>)}>Record {row.label} attempt</button>
                </details>)}
              </div>
              <small>Instructor sign-off and current PADI standards are separate from this 15-point progress target. A formal Equipment Exchange assessment may have additional minimum criteria.</small>
            </section>
          )}

          <section className={styles.workspace}>
            <div className={styles.matrix}>
              <div className={styles.sectionHead}>
                <div>
                  <span className="focus-eyebrow">
                    REQUIREMENT / EVIDENCE MATRIX
                  </span>
                  <h2>Readiness evidence</h2>
                </div>
                {!requirementSet && (
                  <button
                    className="focus-primary"
                    onClick={() => setReferenceEditorOpen(true)}
                  >
                    Capture requirement version
                  </button>
                )}
              </div>
              {requirementSet ? (
                readiness.requirements.map((item) => (
                  <button
                    key={item.requirement.key}
                    className={styles.requirement}
                    data-state={item.state}
                    onClick={() =>
                      setRequirementTarget({
                        requirement: item,
                        requirementSet,
                      })
                    }
                  >
                    <span className={styles.requirementIcon}>
                      {item.state === 'satisfied' ? (
                        <CheckCircle2 />
                      ) : (
                        <AlertTriangle />
                      )}
                    </span>
                    <span>
                      <b>{item.requirement.label}</b>
                      <small>{item.detail}</small>
                    </span>
                    <em>{stateLabels[item.state]}</em>
                  </button>
                ))
              ) : (
                <p className={styles.muted}>
                  Attach a versioned requirement snapshot before ZeusTek claims
                  readiness. Existing Dives, certifications and Skill Evidence
                  remain available and are not copied into this workspace.
                </p>
              )}
            </div>

            <div className={styles.categories}>
              {PROFESSIONAL_EVIDENCE_CATEGORIES.map((category) => {
                const items = pathwayEvidence.filter(
                  (item) => item.evidenceType === category.type,
                );
                return (
                  <section key={category.type} className="focus-card">
                    <div className={styles.cardHead}>
                      <div>
                        <span className="focus-eyebrow">
                          {category.label.toUpperCase()}
                        </span>
                        <p>{category.type === 'stamina' && waterProgress
                          ? 'General and legacy watermanship evidence. Use the five-exercise tracker above for scored attempts.'
                          : category.description}</p>
                      </div>
                      <b>{summary[category.type] ?? 0}</b>
                    </div>
                    <details
                      className={styles.evidenceDisclosure}
                      open={items.length <= 3}
                    >
                      <summary>Recorded evidence · {items.length}</summary>
                      {items.length ? (
                        <ul>
                          {items.map((item) => (
                            <li key={item.entityId}>
                              <button
                                className={styles.evidenceRow}
                                onClick={() => setDetailEvidence(item)}
                              >
                                <span>
                                  <b>
                                    {evidenceText(item.payload.title ||
                                        item.payload.activity ||
                                        category.label,
                                    )}
                                  </b>
                                  <small>
                                    {new Date(
                                      item.occurredAt,
                                    ).toLocaleDateString('en-GB')}
                                    {item.notes ? ` · ${item.notes}` : ''}
                                  </small>
                                </span>
                                <FileText size={16} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={styles.muted}>
                          No evidence recorded yet.
                        </p>
                      )}
                    </details>
                    <button
                      className="focus-link"
                      onClick={() =>
                        setEditingEvidence({
                          ...emptyEvidence(pathway!.entityId, category.type),
                          entityId: '',
                        } as Stored<ProfessionalEvidenceRecord>)
                      }
                    >
                      <Plus size={14} />
                      {category.type === 'stamina' && waterProgress ? 'Add unscored watermanship evidence' : `Add ${category.label.toLocaleLowerCase('en-GB')} evidence`}
                    </button>
                  </section>
                );
              })}
            </div>
          </section>

          <footer className={styles.actions}>
            <button
              className="focus-secondary"
              onClick={() => go?.('Training')}
            >
              Open Training
            </button>
            <button className="focus-secondary" onClick={() => go?.('People')}>
              <Users size={16} />
              People & mentors
            </button>
            <button className="focus-secondary" onClick={() => go?.('Logbook')}>
              Open Logbook
            </button>
            <button
              className="focus-secondary danger"
              disabled={pathwayEvidence.length > 0}
              title={
                pathwayEvidence.length
                  ? 'Delete evidence first; historical evidence is protected from accidental pathway deletion.'
                  : 'Delete pathway'
              }
              onClick={() => void removePathway()}
            >
              <Trash2 size={16} />
              Delete pathway
            </button>
          </footer>
        </>
      )}

      {editingPathway !== undefined && (
        <PathwayEditor
          existing={editingPathway}
          people={people}
          requirementSets={requirementSets}
          close={() => setEditingPathway(undefined)}
          saved={refresh}
        />
      )}
      {referenceEditorOpen && pathway && (
        <ReferenceEditor
          pathway={pathway}
          current={requirementSet}
          skills={skills}
          close={() => setReferenceEditorOpen(false)}
          saved={async (requirementSetId) => {
            await saveProfessionalPathway({
              ...pathway,
              entityId: pathway.entityId,
              requirementSetId,
            });
            await refresh();
            setReferenceEditorOpen(false);
          }}
        />
      )}
      {editingEvidence !== undefined && pathway && (
        <EvidenceEditor
          pathway={pathway}
          existing={editingEvidence?.entityId ? editingEvidence : null}
          seed={editingEvidence?.entityId === '' ? editingEvidence : null}
          dives={dives}
          skillEvidence={skillEvidence}
          skills={skills}
          certifications={certifications}
          sites={sites}
          people={people}
          close={() => setEditingEvidence(undefined)}
          saved={async () => {
            await refresh();
            setEditingEvidence(undefined);
          }}
        />
      )}
      {detailEvidence && (
        <EvidenceDetail
          item={detailEvidence}
          dives={dives}
          skillEvidence={skillEvidence}
          skills={skills}
          certifications={certifications}
          sites={sites}
          people={people}
          close={() => setDetailEvidence(null)}
          edit={() => {
            const item = detailEvidence;
            setDetailEvidence(null);
            setEditingEvidence(item);
          }}
          removed={async () => {
            setDetailEvidence(null);
            await refresh();
          }}
          changed={async () => {
            await refresh();
            const next = (await listProfessionalEvidence()).find(
              (item) => item.entityId === detailEvidence.entityId,
            );
            setDetailEvidence(next ?? null);
          }}
        />
      )}
      {requirementTarget && pathway && (
        <RequirementDialog
          pathway={pathway}
          target={requirementTarget}
          pathwayEvidence={pathwayEvidence}
          openEvidence={(item) => { setRequirementTarget(null); setDetailEvidence(item); }}
          close={() => setRequirementTarget(null)}
          addEvidence={() => {
            const target = requirementTarget;
            const rule = target.requirement.requirement.rule;
            const evidenceType = typeof rule.evidenceType === 'string' && rule.evidenceType
              ? rule.evidenceType
              : rule.scope === 'requirement' && target.requirement.requirement.kind === 'manual'
                ? 'mentor-feedback' : 'requirement-link';
            setRequirementTarget(null);
            setEditingEvidence({
              ...emptyEvidence(pathway.entityId, evidenceType),
              entityId: '',
              requirementSetId: target.requirementSet.entityId,
              requirementKey: target.requirement.requirement.key,
              payload: typeof rule.activityCode === 'string' ? { activityCode: rule.activityCode } : {},
            } as Stored<ProfessionalEvidenceRecord>);
          }}
          linkCandidate={async (candidate) => {
            await createRequirementEvidenceLink({
              pathwayId: pathway.entityId,
              requirementSetId: requirementTarget.requirementSet.entityId,
              requirementKey: requirementTarget.requirement.requirement.key,
              candidate,
            });
            await refresh();
            setRequirementTarget(null);
          }}
        />
      )}
    </main>
  );
}

function emptyEvidence(
  pathwayId: string,
  evidenceType = 'other',
): ProfessionalEvidenceRecord {
  return {
    pathwayId,
    evidenceType,
    occurredAt: new Date().toISOString(),
    relatedDiveId: null,
    relatedCertificationId: null,
    relatedSkillEvidenceId: null,
    relatedSkillEvidenceIds: [],
    relatedSiteId: null,
    evaluatorPersonId: null,
    relatedPersonIds: [],
    attachmentIds: [],
    requirementSetId: null,
    requirementKey: null,
    payload: {},
    notes: null,
    createdAt: '',
    modifiedAt: '',
  };
}

function PathwayEditor({
  existing,
  people,
  requirementSets,
  close,
  saved,
}: {
  existing: Stored<ProfessionalPathwayRecord> | null;
  people: Array<Stored<PersonRecord>>;
  requirementSets: Array<Stored<ProfessionalReferenceRequirementSetRecord>>;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [agency, setAgency] = useState(existing?.agency ?? '');
  const [pathwayKey, setPathwayKey] = useState(existing?.pathwayKey ?? '');
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '');
  const [status, setStatus] = useState<ProfessionalPathwayRecord['status']>(
    existing?.status ?? 'considering',
  );
  const [startedAt, setStartedAt] = useState(
    existing?.startedAt?.slice(0, 10) ?? '',
  );
  const [requirementSetId, setRequirementSetId] = useState(
    existing?.requirementSetId ?? '',
  );
  const [mentorPersonIds, setMentorPersonIds] = useState<string[]>(
    existing?.mentorPersonIds ?? [],
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const matchingSets = requirementSets.filter(
    (set) =>
      (!agency ||
        set.agency.toLocaleLowerCase('en-GB') ===
          agency.toLocaleLowerCase('en-GB')) &&
      (!pathwayKey ||
        set.pathwayKey.toLocaleLowerCase('en-GB') ===
          pathwayKey.toLocaleLowerCase('en-GB')),
  );
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await saveProfessionalPathway({
        ...(existing ? { ...existing, entityId: existing.entityId } : {}),
        agency,
        pathwayKey,
        displayName,
        status,
        startedAt: startedAt
          ? new Date(`${startedAt}T12:00:00`).toISOString()
          : null,
        requirementSetId: requirementSetId || null,
        mentorPersonIds,
        notes,
      });
      await saved();
      close();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Pathway could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <RecordEditorWorkspace
        busy={busy}
        label={
          existing ? 'Edit professional pathway' : 'Create professional pathway'
        }
        contentClassName={styles.editor}
        close={() => {
          if (!busy) close();
        }}
      >
        <form onSubmit={(event) => void submit(event)}>
          <header>
            <div>
              <span className="focus-eyebrow">PROFESSIONAL PATHWAY</span>
              <h2>{existing ? 'Edit pathway' : 'Create pathway'}</h2>
              <p>
                Agency labels are descriptive only; requirement truth comes from
                the selected versioned source snapshot.
              </p>
            </div>
            <button
              type="button"
              className="focus-icon"
              data-dialog-close
              onClick={close}
              aria-label="Close pathway editor"
            >
              <X />
            </button>
          </header>
          <fieldset disabled={busy} className={styles.formGrid}>
            <label>
              Agency
              <input
                required
                value={agency}
                onChange={(event) => setAgency(event.target.value)}
                placeholder="Agency name"
              />
            </label>
            <label>
              Pathway key
              <input
                required
                value={pathwayKey}
                onChange={(event) => setPathwayKey(event.target.value)}
                placeholder="Stable local key"
              />
            </label>
            <label>
              Display name
              <input
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Professional pathway"
              />
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as ProfessionalPathwayRecord['status'],
                  )
                }
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Started
              <input
                type="date"
                value={startedAt}
                onChange={(event) => setStartedAt(event.target.value)}
              />
            </label>
            <label>
              Requirement snapshot
              <select
                value={requirementSetId}
                onChange={(event) => setRequirementSetId(event.target.value)}
              >
                <option value="">None — readiness Unknown</option>
                {matchingSets.map((set) => (
                  <option key={set.entityId} value={set.entityId}>
                    {set.versionLabel} ·{' '}
                    {set.sourceCitation || 'source not recorded'}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className={styles.span2}>
              <legend>Mentors / evaluators</legend>
              <div className={styles.peopleChoices}>
                {people.map((person) => (
                  <label key={person.entityId}>
                    <input
                      type="checkbox"
                      checked={mentorPersonIds.includes(person.entityId)}
                      onChange={(event) =>
                        setMentorPersonIds((current) =>
                          event.target.checked
                            ? [...new Set([...current, person.entityId])]
                            : current.filter((id) => id !== person.entityId),
                        )
                      }
                    />
                    {person.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className={styles.span2}>
              Notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </fieldset>
          {error && (
            <p role="alert" className="dive-save-error">
              {error}
            </p>
          )}
          <footer>
            <button
              type="button"
              className="focus-secondary"
              data-dialog-close
              onClick={close}
            >
              Cancel
            </button>
            <button className="focus-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save pathway'}
            </button>
          </footer>
        </form>
      </RecordEditorWorkspace>
    </>
  );
}

function ReferenceEditor({
  pathway,
  current,
  skills,
  close,
  saved,
}: {
  pathway: Stored<ProfessionalPathwayRecord>;
  current: Stored<ProfessionalReferenceRequirementSetRecord> | null;
  skills: CanonicalSkillRecord[];
  close: () => void;
  saved: (id: string) => Promise<void>;
}) {
  const [versionLabel, setVersionLabel] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [sourceCitation, setSourceCitation] = useState(
    current?.sourceCitation ?? '',
  );
  const [requirementsText, setRequirementsText] = useState(
    JSON.stringify(current?.requirements ?? [], null, 2),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const requirements = JSON.parse(
        requirementsText,
      ) as ProfessionalRequirementDefinition[];
      if (!Array.isArray(requirements))
        throw new Error('Requirements JSON must be an array.');
      const result = await captureProfessionalRequirementSet({
        agency: pathway.agency,
        pathwayKey: pathway.pathwayKey,
        pathwayLabel: pathway.displayName,
        versionLabel,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: null,
        sourceCitation,
        requirements,
        capturedAt: new Date().toISOString(),
      });
      await saved(result.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Requirement snapshot could not be captured.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <RecordEditorWorkspace
        busy={busy}
        label="Capture professional requirement version"
        contentClassName={styles.referenceEditor}
        close={() => {
          if (!busy) close();
        }}
      >
        <form onSubmit={(event) => void submit(event)}>
          <header>
            <div>
              <span className="focus-eyebrow">VERSIONED REQUIREMENTS</span>
              <h2>Capture requirement version</h2>
              <p>
                This creates a new immutable snapshot. Do not overwrite an older
                standard when the agency changes requirements. Existing captured
                requirements are prefilled only as a drafting aid; the new
                version remains a separate record.
              </p>
            </div>
            <button
              type="button"
              className="focus-icon"
              data-dialog-close
              onClick={close}
              aria-label="Close requirement editor"
            >
              <X />
            </button>
          </header>
          <fieldset disabled={busy} className={styles.formGrid}>
            <label>
              Agency
              <input readOnly value={pathway.agency} />
            </label>
            <label>
              Pathway
              <input readOnly value={pathway.displayName} />
            </label>
            <label>
              Version label
              <input
                required
                value={versionLabel}
                onChange={(event) => setVersionLabel(event.target.value)}
                placeholder="e.g. manual edition / captured date"
              />
            </label>
            <label>
              Effective from
              <input
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </label>
            <label className={styles.span2}>
              Source citation
              <input
                required
                value={sourceCitation}
                onChange={(event) => setSourceCitation(event.target.value)}
                placeholder="Official manual/page/version you checked"
              />
            </label>
            <ProfessionalRequirementBuilder value={requirementsText} change={setRequirementsText} skills={skills}/>
            <details className={styles.span2}><summary>Advanced requirement rules</summary>
            <label className={styles.span2}>
              Requirements JSON
              <textarea
                rows={16}
                aria-label="Requirements JSON"
                value={requirementsText}
                onChange={(event) => setRequirementsText(event.target.value)}
                spellCheck={false}
              />
              <small>
                Supported kinds: certification, count, recency, assessment,
                document, manual. For count rules, professional evidence uses{' '}
                {`{"metric":"professional-evidence","evidenceType":"guided-dive","min":1}`}
                .
              </small>
            </label></details>
          </fieldset>
          {error && (
            <p role="alert" className="dive-save-error">
              {error}
            </p>
          )}
          <footer>
            <button
              type="button"
              className="focus-secondary"
              data-dialog-close
              onClick={close}
            >
              Cancel
            </button>
            <button className="focus-primary" disabled={busy}>
              {busy ? 'Capturing…' : 'Capture new version'}
            </button>
          </footer>
        </form>
      </RecordEditorWorkspace>
    </>
  );
}

function EvidenceEditor({
  pathway,
  existing,
  seed,
  dives,
  skillEvidence,
  skills,
  certifications,
  sites,
  people,
  close,
  saved,
}: {
  pathway: Stored<ProfessionalPathwayRecord>;
  existing: Stored<ProfessionalEvidenceRecord> | null;
  seed: Stored<ProfessionalEvidenceRecord> | null;
  dives: Array<DiveRecord & { entityId: string }>;
  skillEvidence: SkillEvidenceRecord[];
  skills: CanonicalSkillRecord[];
  certifications: Array<Stored<CertificationRecord>>;
  sites: Array<Stored<DiveSiteRecord>>;
  people: Array<Stored<PersonRecord>>;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const base = existing ?? seed ?? emptyEvidence(pathway.entityId);
  const [evidenceType, setEvidenceType] = useState(base.evidenceType);
  const [occurredAt, setOccurredAt] = useState(
    base.occurredAt
      ? new Date(
          new Date(base.occurredAt).getTime() -
            new Date(base.occurredAt).getTimezoneOffset() * 60_000,
        )
          .toISOString()
          .slice(0, 16)
      : nowLocal(),
  );
  const [relatedDiveId, setRelatedDiveId] = useState(base.relatedDiveId ?? '');
  const [relatedCertificationId, setRelatedCertificationId] = useState(
    base.relatedCertificationId ?? '',
  );
  const [relatedSkillEvidenceIds, setRelatedSkillEvidenceIds] = useState<
    string[]
  >([
    ...new Set([
      ...(base.relatedSkillEvidenceIds ?? []),
      ...(base.relatedSkillEvidenceId ? [base.relatedSkillEvidenceId] : []),
    ]),
  ]);
  const [relatedSiteId, setRelatedSiteId] = useState(base.relatedSiteId ?? '');
  const [evaluatorPersonId, setEvaluatorPersonId] = useState(
    base.evaluatorPersonId ?? '',
  );
  const [relatedPersonIds, setRelatedPersonIds] = useState<string[]>(
    base.relatedPersonIds ?? [],
  );
  const [title, setTitle] = useState(
    evidenceText(base.payload.title ?? base.payload.activity ?? ''),
  );
  const [detail, setDetail] = useState(
    evidenceText(base.payload.detail ?? base.payload.outcome ?? ''),
  );
  const [payloadValues, setPayloadValues] = useState<Record<string, unknown>>({
    ...base.payload,
  });
  const [notes, setNotes] = useState(base.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const categoryFields = professionalAssessmentFields(evidenceType, typeof payloadValues.exerciseKey === 'string' ? payloadValues.exerciseKey : undefined, Boolean(base.payload.rubricId));
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const primarySkillEvidenceId = relatedSkillEvidenceIds[0] ?? null;
      await saveProfessionalEvidence({
        ...(existing ? { ...existing, entityId: existing.entityId } : {}),
        pathwayId: pathway.entityId,
        evidenceType,
        occurredAt: new Date(occurredAt).toISOString(),
        relatedDiveId: relatedDiveId || null,
        relatedCertificationId: relatedCertificationId || null,
        relatedSkillEvidenceId: primarySkillEvidenceId,
        relatedSkillEvidenceIds,
        relatedSiteId: relatedSiteId || null,
        evaluatorPersonId: evaluatorPersonId || null,
        relatedPersonIds,
        attachmentIds: existing?.attachmentIds ?? base.attachmentIds ?? [],
        requirementSetId: base.requirementSetId ?? null,
        requirementKey: base.requirementKey ?? null,
        payload: {
          ...(existing?.payload ?? base.payload),
          ...payloadValues,
          title: title.trim(),
          detail: detail.trim(),
        },
        notes,
      });
      await saved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Professional Evidence could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <RecordEditorWorkspace
        busy={busy}
        label={
          existing ? 'Edit professional evidence' : 'Log professional evidence'
        }
        contentClassName={styles.editor}
        close={() => {
          if (!busy) close();
        }}
      >
        <form onSubmit={(event) => void submit(event)}>
          <header>
            <div>
              <span className="focus-eyebrow">PROFESSIONAL EVIDENCE</span>
              <h2>{existing ? 'Edit evidence' : 'Log experience'}</h2>
              {base.requirementKey && (
                <p>
                  This evidence will retain a link to requirement{' '}
                  <code>{base.requirementKey}</code> and its captured
                  requirement version.
                </p>
              )}
            </div>
            <button
              type="button"
              className="focus-icon"
              data-dialog-close
              onClick={close}
              aria-label="Close evidence editor"
            >
              <X />
            </button>
          </header>
          <fieldset disabled={busy} className={styles.formGrid}>
            <label>
              Evidence type
              <select
                value={evidenceType}
                disabled={Boolean(base.payload.rubricId)}
                onChange={(event) => setEvidenceType(event.target.value)}
              >
                {PROFESSIONAL_EVIDENCE_CATEGORIES.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Occurred at
              <input
                required
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
              />
            </label>
            <label>
              Related Dive
              <select
                value={relatedDiveId}
                onChange={(event) => setRelatedDiveId(event.target.value)}
              >
                <option value="">No Dive link</option>
                {dives.map((dive) => (
                  <option key={dive.entityId} value={dive.entityId}>
                    {dive.date} · {dive.site}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Related certification
              <select
                value={relatedCertificationId}
                onChange={(event) =>
                  setRelatedCertificationId(event.target.value)
                }
              >
                <option value="">No certification link</option>
                {certifications.map((cert) => (
                  <option key={cert.entityId} value={cert.entityId}>
                    {cert.agency} · {cert.certification || cert.level}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className={styles.span2}>
              <legend>Related Skill Evidence</legend>
              <div className={styles.peopleChoices}>
                {skillEvidence.map((item) => {
                  const skill = skills.find((candidate) =>
                    [candidate.entityId, candidate.skillKey, candidate.key]
                      .filter(Boolean)
                      .includes(item.skillKey),
                  );
                  return (
                    <label key={item.entityId}>
                      <input
                        type="checkbox"
                        checked={relatedSkillEvidenceIds.includes(
                          item.entityId,
                        )}
                        onChange={(event) =>
                          setRelatedSkillEvidenceIds((current) =>
                            event.target.checked
                              ? [...new Set([...current, item.entityId])]
                              : current.filter((id) => id !== item.entityId),
                          )
                        }
                      />
                      {skill ? skillRecordName(skill) : 'Saved Skill'} ·{' '}
                      {item.performedAt
                        ? new Date(item.performedAt).toLocaleDateString('en-GB')
                        : 'undated'}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label>
              Related Site
              <select
                value={relatedSiteId}
                onChange={(event) => setRelatedSiteId(event.target.value)}
              >
                <option value="">No Site link</option>
                {sites.map((site) => (
                  <option key={site.entityId} value={site.entityId}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Evaluator / mentor
              <select
                value={evaluatorPersonId}
                onChange={(event) => setEvaluatorPersonId(event.target.value)}
              >
                <option value="">No evaluator recorded</option>
                {people.map((person) => (
                  <option key={person.entityId} value={person.entityId}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className={styles.span2}>
              <legend>Other people involved</legend>
              <div className={styles.peopleChoices}>
                {people.map((person) => (
                  <label key={person.entityId}>
                    <input
                      type="checkbox"
                      checked={relatedPersonIds.includes(person.entityId)}
                      onChange={(event) =>
                        setRelatedPersonIds((current) =>
                          event.target.checked
                            ? [...new Set([...current, person.entityId])]
                            : current.filter((id) => id !== person.entityId),
                        )
                      }
                    />
                    {person.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              Title / activity
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What was practised or completed?"
              />
            </label>
            {categoryFields.map((field) => (
              <label
                key={field.key}
                className={field.kind === 'textarea' ? styles.span2 : undefined}
              >
                {field.label}
                {field.kind === 'textarea' ? (
                  <textarea
                    value={evidenceText(payloadValues[field.key] ?? '')}
                    onChange={(event) =>
                      setPayloadValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                  />
                ) : field.kind === 'select' ? (
                  <select
                    value={evidenceText(payloadValues[field.key] ?? '')}
                    onChange={(event) =>
                      setPayloadValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Not recorded</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.kind === 'boolean' ? (
                  <select
                    value={
                      payloadValues[field.key] === true
                        ? 'yes'
                        : payloadValues[field.key] === false
                          ? 'no'
                          : ''
                    }
                    onChange={(event) =>
                      setPayloadValues((current) => ({
                        ...current,
                        [field.key]:
                          event.target.value === ''
                            ? null
                            : event.target.value === 'yes',
                      }))
                    }
                  >
                    <option value="">Not recorded</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                ) : field.kind === 'number' ? (
                  <span className={styles.unitInput}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={field.min}
                      step={field.step ?? 'any'}
                      value={
                        payloadValues[field.key] == null
                          ? ''
                          : evidenceText(payloadValues[field.key])
                      }
                      onChange={(event) =>
                        setPayloadValues((current) => ({
                          ...current,
                          [field.key]:
                            event.target.value === ''
                              ? null
                              : Number(event.target.value),
                        }))
                      }
                    />
                    {field.suffix && <small>{field.suffix}</small>}
                  </span>
                ) : (
                  <input
                    value={evidenceText(payloadValues[field.key] ?? '')}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setPayloadValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                  />
                )}
              </label>
            ))}
            <label className={styles.span2}>
              Outcome / detail
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
              />
            </label>
            <label className={styles.span2}>
              Notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </fieldset>
          {error && (
            <p role="alert" className="dive-save-error">
              {error}
            </p>
          )}
          <footer>
            <button
              type="button"
              className="focus-secondary"
              data-dialog-close
              onClick={close}
            >
              Cancel
            </button>
            <button className="focus-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save evidence'}
            </button>
          </footer>
        </form>
      </RecordEditorWorkspace>
    </>
  );
}

function EvidenceDetail({
  item,
  dives,
  skillEvidence,
  skills,
  certifications,
  sites,
  people,
  close,
  edit,
  removed,
  changed,
}: {
  item: Stored<ProfessionalEvidenceRecord>;
  dives: Array<DiveRecord & { entityId: string }>;
  skillEvidence: SkillEvidenceRecord[];
  skills: CanonicalSkillRecord[];
  certifications: Array<Stored<CertificationRecord>>;
  sites: Array<Stored<DiveSiteRecord>>;
  people: Array<Stored<PersonRecord>>;
  close: () => void;
  edit: () => void;
  removed: () => Promise<void>;
  changed: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  const dive = dives.find(
    (candidate) => candidate.entityId === item.relatedDiveId,
  );
  const certification = certifications.find(
    (candidate) => candidate.entityId === item.relatedCertificationId,
  );
  const linkedSkillIds = [
    ...new Set([
      ...(item.relatedSkillEvidenceIds ?? []),
      ...(item.relatedSkillEvidenceId ? [item.relatedSkillEvidenceId] : []),
    ]),
  ];
  const linkedSkills = linkedSkillIds
    .map((id) => skillEvidence.find((candidate) => candidate.entityId === id))
    .filter((candidate): candidate is SkillEvidenceRecord =>
      Boolean(candidate),
    );
  const site = sites.find(
    (candidate) => candidate.entityId === item.relatedSiteId,
  );
  const evaluator = people.find(
    (candidate) => candidate.entityId === item.evaluatorPersonId,
  );
  const relatedPeople = (item.relatedPersonIds ?? [])
    .map((id) => people.find((candidate) => candidate.entityId === id)?.name)
    .filter(Boolean);
  const extraPayload = Object.entries(item.payload).filter(
    ([key, value]) =>
      !['title', 'activity', 'detail'].includes(key) &&
      value !== '' &&
      value != null,
  );
  async function attach(ids: string[]) {
    await updateProfessionalEvidenceAttachments(item.entityId, ids);
    await changed();
  }
  async function detach(id: string) {
    await updateProfessionalEvidenceAttachments(item.entityId, [], [id]);
    await changed();
  }
  async function remove() {
    if (
      !window.confirm(
        'Delete this Professional Evidence record? Linked Dives, Skills, Sites, People and media originals are not deleted.',
      )
    )
      return;
    try {
      await deleteProfessionalEvidence(item.entityId);
      await removed();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Evidence could not be deleted.');
    }
  }
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        label="Professional evidence detail"
        className={`focus-modal ${styles.detail}`}
        close={close}
      >
        <header>
          <div>
            <span className="focus-eyebrow">
              {item.evidenceType.toUpperCase()}
            </span>
            <h2>
              {evidenceText(item.payload.title ||
                  item.payload.activity ||
                  'Professional evidence',
              )}
            </h2>
            <p>{new Date(item.occurredAt).toLocaleString('en-GB')}</p>
          </div>
          <button
            className="focus-icon"
            aria-label="Close evidence detail"
            onClick={close}
          >
            <X />
          </button>
        </header>
        <div className={styles.detailGrid}>
          <div>
            <small>Related Dive</small>
            <b>{dive ? `${dive.date} · ${dive.site}` : 'None'}</b>
          </div>
          <div>
            <small>Certification</small>
            <b>
              {certification
                ? `${certification.agency} · ${certification.certification || certification.level}`
                : 'None'}
            </b>
          </div>
          <div>
            <small>Skill Evidence</small>
            <b>
              {linkedSkills.length
                ? linkedSkills
                    .map((entry) => {
                      const skill = skills.find((candidate) =>
                        [candidate.entityId, candidate.skillKey, candidate.key]
                          .filter(Boolean)
                          .includes(entry.skillKey),
                      );
                      return skill
                        ? skillRecordName(skill)
                        : 'Saved Skill Evidence';
                    })
                    .join(', ')
                : 'None'}
            </b>
          </div>
          <div>
            <small>Site</small>
            <b>{site?.name || 'None'}</b>
          </div>
          <div>
            <small>Evaluator</small>
            <b>{evaluator?.name || 'None'}</b>
          </div>
          <div>
            <small>Other people</small>
            <b>{relatedPeople.length ? relatedPeople.join(', ') : 'None'}</b>
          </div>
          <div>
            <small>Requirement version link</small>
            <b>
              {item.requirementSetId && item.requirementKey
                ? `${item.requirementKey} · ${item.requirementSetId}`
                : 'General evidence'}
            </b>
          </div>
        </div>
        {extraPayload.length > 0 && (
          <dl className={styles.payloadGrid}>
            {extraPayload.map(([key, value]) => (
              <div key={key}>
                <dt>{key.replace(/([A-Z])/g, ' $1')}</dt>
                <dd>
                  {typeof value === 'boolean'
                    ? value
                      ? 'Yes'
                      : 'No'
                    : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {Boolean(item.payload.detail) && <p>{evidenceText(item.payload.detail)}</p>}
        {item.notes && <p>{item.notes}</p>}
        <MediaGallery
          ownerKind="professional-evidence"
          ownerId={item.entityId}
          acceptFiles
          retainOfflineMetadata
          onUploaded={attach}
          onRemoved={detach}
        />
        {error && <p role="alert" className="dive-save-error">{error}</p>}
        <footer>
          {!item.payload.rubricId && <button
            className="focus-secondary danger"
            onClick={() => void remove()}
          >
            <Trash2 size={15} />
            Delete evidence
          </button>}
          <span />
          <button className="focus-secondary" onClick={close}>
            Close
          </button>
          {!item.payload.rubricId && <button className="focus-primary" onClick={edit}>
            <Pencil size={15} />
            Edit
          </button>}
        </footer>
      </AccessibleDialog>
    </div>
  );
}

function RequirementDialog({
  pathway,
  target,
  pathwayEvidence,
  openEvidence,
  close,
  addEvidence,
  linkCandidate,
}: {
  pathway: Stored<ProfessionalPathwayRecord>;
  target: NonNullable<RequirementTarget>;
  pathwayEvidence: Array<Stored<ProfessionalEvidenceRecord>>;
  openEvidence: (item: Stored<ProfessionalEvidenceRecord>) => void;
  close: () => void;
  addEvidence: () => void;
  linkCandidate: (
    candidate: EvaluatedProfessionalRequirement['evidence'][number],
  ) => Promise<void>;
}) {
  const { requirement, requirementSet } = target;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rule = requirement.requirement.rule;
  const olderCandidates = pathwayEvidence.filter(item =>
    item.evidenceType !== 'requirement-link' &&
    (!rule.evidenceType || item.evidenceType === rule.evidenceType)).map(item => ({
      kind: 'professional-evidence' as const, id: item.entityId,
      label: `${item.evidenceType} · ${new Date(item.occurredAt).toLocaleDateString('en-GB')}`,
    }));
  const uniqueEvidence = [...requirement.evidence, ...olderCandidates].filter(
    (item, index, all) =>
      all.findIndex(
        (candidate) => candidate.kind === item.kind && candidate.id === item.id,
      ) === index,
  );
  async function link(
    item: EvaluatedProfessionalRequirement['evidence'][number],
  ) {
    setBusy(true);
    setError('');
    try {
      await linkCandidate(item);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Evidence could not be linked.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        label="Requirement evidence"
        className={`focus-modal ${styles.detail}`}
        close={() => {
          if (!busy) close();
        }}
        containDismiss
      >
        <header>
          <div>
            <span className="focus-eyebrow">{requirementSet.versionLabel}</span>
            <h2>{requirement.requirement.label}</h2>
            <p>{requirement.detail}</p>
          </div>
          <button
            className="focus-icon"
            aria-label="Close requirement evidence"
            disabled={busy}
            onClick={close}
          >
            <X />
          </button>
        </header>
        <section className={styles.requirementMeta}>
          <p>
            <b>Agency:</b> {requirementSet.agency}
          </p>
          <p>
            <b>Pathway:</b> {pathway.displayName}
          </p>
          <p>
            <b>Captured source:</b>{' '}
            {requirementSet.sourceCitation || 'Not recorded'}
          </p>
          <p>
            <b>State:</b> {stateLabels[requirement.state]}
          </p>
        </section>
        <section>
          <h3>Evidence candidates / links</h3>
          {uniqueEvidence.length ? (
            <ul className={styles.linkList}>
              {uniqueEvidence.map((item) => (
                <li key={`${item.kind}:${item.id}`}>
                  <b>{item.kind}</b>
                  <span>{item.label}</span>
                  {item.kind === 'professional-evidence' && pathwayEvidence.some(evidence => evidence.entityId === item.id) && <button type="button" className="focus-link" onClick={() => openEvidence(pathwayEvidence.find(evidence => evidence.entityId === item.id)!)}>Open source</button>}
                  {!pathwayEvidence.some(
                    (evidence) =>
                      evidence.requirementSetId === requirementSet.entityId &&
                      evidence.requirementKey === requirement.requirement.key &&
                      ((item.kind === 'professional-evidence' && evidence.entityId === item.id) ||
                        (evidence.payload.sourceKind === item.kind && evidence.payload.sourceId === item.id)),
                  ) ? (
                    <button
                      type="button"
                      className="focus-link"
                      disabled={busy}
                      onClick={() => void link(item)}
                    >
                      Link to this requirement
                    </button>
                  ) : (
                    <em>Linked</em>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>
              No matching canonical evidence candidate is currently available.
              Add explicit evidence without copying the underlying Dive, Skill,
              Site or Person.
            </p>
          )}
        </section>
        {error && (
          <p role="alert" className="dive-save-error">
            {error}
          </p>
        )}
        <footer>
          <button className="focus-secondary" disabled={busy} onClick={close}>
            Close
          </button>
          <button
            className="focus-primary"
            disabled={busy}
            onClick={addEvidence}
          >
            <UserCheck size={16} />
            Add evidence for this version
          </button>
        </footer>
      </AccessibleDialog>
    </div>
  );
}
