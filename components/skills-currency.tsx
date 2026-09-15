'use client';

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibleDialog } from './accessible-dialog';
import { ZeusTekIcon } from './zeustek-icon';
import { useRecordRefresh } from './record-status';
import {
  canonicalSkillGroups,
  CANONICAL_SKILLS_CHANGED_EVENT,
  resolveCanonicalSkillReference,
  SKILL_COMPETENCE_LEVELS,
  listCanonicalSkills,
  listSkillEvidence,
  saveDiveSkillEvidence,
  skillCompetenceLevelLabel,
  skillRecordGroup,
  skillRecordKey,
  skillRecordName,
  type CanonicalSkillRecord,
  type SkillCompetenceLevel,
  type SkillEvidenceRecord,
} from '../lib/offline/dive-context';
import { listDives, type DiveRecord } from '../lib/offline/dives';
import {
  listDiveTrips,
  listEquipmentSets,
  listPeople,
  type DiveTripRecord,
  type EquipmentSetRecord,
  type PersonRecord,
  type Stored,
} from '../lib/offline/dive-planning';
import {
  buildSkillsCurrencyProjection,
  currencySummary,
  listCurrencyPolicies,
  plannedSkillPractice,
  recommendedNextPractice,
  saveCurrencyPolicy,
  type CurrencyPolicyRecord,
  type SkillCurrencyStatus,
} from '../lib/offline/skills-currency';
import styles from './skills-currency.module.css';

const labels: Record<SkillCurrencyStatus, string> = {
  current: 'Current',
  'due-soon': 'Due soon',
  'needs-practice': 'Needs practice',
  'not-assessed': 'Not assessed',
};
const statusClass: Record<SkillCurrencyStatus, string> = {
  current: styles.current ?? '',
  'due-soon': styles.due ?? '',
  'needs-practice': styles.needs ?? '',
  'not-assessed': styles.unknown ?? '',
};
function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return <section className={`focus-card ${className}`}>{children}</section>;
}
function date(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Not recorded';
}
function localDateTime(value?: string) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isFinite(parsed.getTime())
    ? new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16)
    : '';
}

export function SkillsCurrency({ go }: { go?: (section: string) => void }) {
  const [skills, setSkills] = useState<CanonicalSkillRecord[]>([]);
  const [evidence, setEvidence] = useState<SkillEvidenceRecord[]>([]);
  const [policies, setPolicies] = useState<Array<Stored<CurrencyPolicyRecord>>>(
    [],
  );
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>(
    [],
  );
  const [plans, setPlans] = useState<Array<Stored<DiveTripRecord>>>([]);
  const [people, setPeople] = useState<Array<Stored<PersonRecord>>>([]);
  const [sets, setSets] = useState<Array<Stored<EquipmentSetRecord>>>([]);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [status, setStatus] = useState<'all' | SkillCurrencyStatus>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [asOf, setAsOf] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setAsOf(new Date());
    const timer = window.setInterval(tick, 60_000);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, []);
  const unavailableEvidence = evidence.filter(
    (item) => !resolveCanonicalSkillReference(item.skillKey, skills),
  );
  const unavailablePolicies = policies.filter(
    (item) => !resolveCanonicalSkillReference(item.skillKey, skills),
  );
  const [detail, setDetail] = useState<CanonicalSkillRecord | null>(null);
  const evidenceLinkOpened = useRef(false);
  useEffect(() => {
    if (evidenceLinkOpened.current) return;
    const id = new URLSearchParams(window.location.search).get('evidenceId');
    if (!id) { evidenceLinkOpened.current = true; return; }
    const linked = evidence.find(item => item.entityId === id);
    const skill = linked && resolveCanonicalSkillReference(linked.skillKey,skills);
    if (skill) { evidenceLinkOpened.current = true;setDetail(skill); }
  }, [evidence,skills]);
  const [policySkill, setPolicySkill] = useState<CanonicalSkillRecord | null>(
    null,
  );
  const [evidenceSkill, setEvidenceSkill] = useState<
    CanonicalSkillRecord | null | undefined
  >(undefined);
  const refresh = useCallback(async () => {
    const [
      skillRows,
      evidenceRows,
      policyRows,
      diveRows,
      planRows,
      personRows,
      setRows,
    ] = await Promise.all([
      listCanonicalSkills(),
      listSkillEvidence(),
      listCurrencyPolicies(),
      listDives(),
      listDiveTrips(),
      listPeople(),
      listEquipmentSets(),
    ]);
    setSkills(skillRows);
    setEvidence(evidenceRows);
    setPolicies(policyRows);
    setDives(diveRows);
    setPlans(planRows);
    setPeople(personRows);
    setSets(setRows);
  }, []);
  useRecordRefresh(refresh);
  useEffect(() => {
    const changed = () => {
      void refresh();
    };
    window.addEventListener(CANONICAL_SKILLS_CHANGED_EVENT, changed);
    return () =>
      window.removeEventListener(CANONICAL_SKILLS_CHANGED_EVENT, changed);
  }, [refresh]);
  const rows = useMemo(
    () =>
      buildSkillsCurrencyProjection(
        skills.filter((skill) => !skill.archived),
        evidence,
        policies,
        asOf,
      ),
    [skills, evidence, policies, asOf],
  );
  const summary = currencySummary(rows.map((row) => row.projection));
  const groups = useMemo(() => canonicalSkillGroups(skills), [skills]);
  const q = query.trim().toLocaleLowerCase('en-GB');
  const visible = rows.filter(
    (row) =>
      (group === 'all' || skillRecordGroup(row.skill) === group) &&
      (status === 'all' || row.projection.status === status) &&
      (!verifiedOnly || row.projection.evaluatorVerified) &&
      (!q ||
        `${skillRecordName(row.skill)} ${skillRecordGroup(row.skill)} ${row.skill.description ?? ''}`
          .toLocaleLowerCase('en-GB')
          .includes(q)),
  );
  const recommended = recommendedNextPractice(rows)
    .filter((row) => row.projection.status !== 'current')
    .slice(0, 4);
  const upcoming = plannedSkillPractice(
    plans as Array<Stored<DiveTripRecord & { plannedSkillKeys?: string[] }>>,
  ).slice(0, 5);
  const detailRow = detail
    ? rows.find((row) => row.skill.entityId === detail.entityId)
    : null;
  return (
    <>
      {(unavailableEvidence.length > 0 || unavailablePolicies.length > 0) && (
        <p role="status">
          Reference review required: {unavailableEvidence.length} evidence
          record(s) and {unavailablePolicies.length} policy record(s) refer to
          an unknown / unavailable Skill. History is retained; no automatic
          remapping occurs.
        </p>
      )}
      <button className="focus-secondary" onClick={() => go?.('Settings')}>
        Manage Skill Catalogue and CSV
      </button>
      <header className={styles.heading}>
        <div className="focus-heading-title">
          <ZeusTekIcon id="dive-skills" size="heading" />
          <div>
          <span className="focus-eyebrow">DEVELOPMENT CENTRE</span>
          <h1>Dive Skills</h1>
          <p>
            Track repeatable ability, evidence and recency independently from
            certification cards.
          </p>
          </div>
        </div>
        <button
          className="focus-primary"
          onClick={() => setEvidenceSkill(null)}
        >
          <Plus size={17} />
          Add evidence
        </button>
      </header>
      <Card className={styles.summary}>
        <button onClick={() => setStatus('current')}>
          <CheckCircle2 />
          <strong>{summary.current}</strong>
          <span>Current</span>
        </button>
        <button onClick={() => setStatus('due-soon')}>
          <Clock3 />
          <strong>{summary['due-soon']}</strong>
          <span>Due soon</span>
        </button>
        <button onClick={() => setStatus('needs-practice')}>
          <CalendarDays />
          <strong>{summary['needs-practice']}</strong>
          <span>Needs practice</span>
        </button>
        <button onClick={() => setStatus('not-assessed')}>
          <Clock3 /><strong>{summary['not-assessed']}</strong><span>Not assessed</span>
        </button>
        <button onClick={() => setVerifiedOnly((value) => !value)}>
          <ShieldCheck />
          <strong>{summary.verified}</strong>
          <span>Evaluator recorded</span>
        </button>
      </Card>
      <Card className={styles.filters}>
        <label>
          Search
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search skills"
          />
        </label>
        <label>
          Group
          <select
            value={group}
            onChange={(event) => setGroup(event.target.value)}
          >
            <option value="all">All groups</option>
            {groups.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as 'all' | SkillCurrencyStatus)
            }
          >
            <option value="all">All statuses</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(event) => setVerifiedOnly(event.target.checked)}
          />
          Evaluator recorded only
        </label>
      </Card>
      <div className={styles.layout}>
        <main>
          <div className={styles.skillGrid}>
            {visible.map((row) => {
              const latest = row.projection.latestEvidence;
              return (
                <button
                  key={row.skill.entityId}
                  className={`${styles.skillCard} ${statusClass[row.projection.status]}`}
                  onClick={() => setDetail(row.skill)}
                >
                  <div>
                    <span>{skillRecordGroup(row.skill)}</span>
                    <b>{skillRecordName(row.skill)}</b>
                  </div>
                  <em>{labels[row.projection.status]}</em>
                  <dl>
                    <div>
                      <dt>Last evidence</dt>
                      <dd>{date(latest?.performedAt)}</dd>
                    </div>
                    <div>
                      <dt>Competence</dt>
                      <dd>
                        {typeof latest?.competenceLevel === 'string'
                          ? skillCompetenceLevelLabel(
                              latest.competenceLevel as SkillCompetenceLevel,
                            )
                          : latest?.competenceLevel == null
                            ? 'Not assessed'
                            : `Legacy ${latest.competenceLevel}/5`}
                      </dd>
                    </div>
                    <div>
                      <dt>Evaluator</dt>
                      <dd>
                        {latest?.evaluatorPersonId
                          ? 'Recorded'
                          : 'Not recorded'}
                      </dd>
                    </div>
                    <div><dt>Confidence</dt><dd>{latest?.confidenceLevel == null ? 'Not recorded' : `${latest.confidenceLevel}/5`}</dd></div>
                  </dl>
                  <small>{row.projection.reason}</small>
                </button>
              );
            })}
          </div>
          {!visible.length && (
            <Card className="focus-empty">
              <h2>No matching Skills</h2>
              <p>
                Adjust the filters or add canonical Skills in the existing Skill
                Catalogue.
              </p>
            </Card>
          )}
        </main>
        <aside className={styles.side}>
          <Card>
            <h2>Recommended next practice</h2>
            {recommended.length ? (
              recommended.map((row) => (
                <article key={row.skill.entityId}>
                  <b>{skillRecordName(row.skill)}</b>
                  <span>{row.projection.reason}</span>
                  <div>
                    <button
                      className="focus-link"
                      onClick={() => setDetail(row.skill)}
                    >
                      Review evidence
                    </button>
                    <button
                      className="focus-link"
                      onClick={() => go?.('Dive Plans')}
                    >
                      Plan practice
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p>Nothing is currently flagged by an enabled currency policy.</p>
            )}
          </Card>
          <Card>
            <h2>Upcoming planned practice</h2>
            {upcoming.length ? (
              upcoming.map((plan) => (
                <article key={plan.planId}>
                  <b>{plan.planName}</b>
                  <span>
                    {plan.startsOn || 'Date not set'} · {plan.skillKeys.length}{' '}
                    planned skill{plan.skillKeys.length === 1 ? '' : 's'}
                  </span>
                </article>
              ))
            ) : (
              <p>
                No upcoming Plan has recorded practice Skills. Existing Plans remain available below.
              </p>
            )}
            <button
              className="focus-secondary"
              onClick={() => go?.('Dive Plans')}
            >
              Open Dive Plans
            </button>
          </Card>
        </aside>
      </div>
      {detail && detailRow && (
        <SkillDetail
          skill={detail}
          row={detailRow}
          evidence={evidence}
          dives={dives}
          people={people}
          close={() => setDetail(null)}
          editPolicy={() => setPolicySkill(detail)}
          addEvidence={() => setEvidenceSkill(detail)}
        />
      )}
      {policySkill && (
        <PolicyEditor
          skill={policySkill}
          policy={
            policies.find((policy) =>
              resolveCanonicalSkillReference(policy.skillKey, [policySkill]),
            ) ?? null
          }
          close={() => setPolicySkill(null)}
          saved={refresh}
        />
      )}
      {evidenceSkill !== undefined && (
        <EvidenceFromDiveDialog
          initialSkill={evidenceSkill}
          skills={skills.filter((skill) => !skill.archived)}
          dives={dives}
          people={people}
          equipmentSets={sets}
          close={() => setEvidenceSkill(undefined)}
          saved={refresh}
        />
      )}
    </>
  );
}

function SkillDetail({
  skill,
  row,
  evidence,
  dives,
  people,
  close,
  editPolicy,
  addEvidence,
}: {
  skill: CanonicalSkillRecord;
  row: ReturnType<typeof buildSkillsCurrencyProjection>[number];
  evidence: SkillEvidenceRecord[];
  dives: Array<DiveRecord & { entityId: string }>;
  people: Array<Stored<PersonRecord>>;
  close: () => void;
  editPolicy: () => void;
  addEvidence: () => void;
}) {
  const aliases = new Set(
    [skill.entityId, skill.skillKey, skill.key, skillRecordKey(skill)].filter(
      Boolean,
    ),
  );
  const history = evidence
    .filter((item) => aliases.has(item.skillKey))
    .sort((a, b) =>
      String(b.performedAt ?? '').localeCompare(String(a.performedAt ?? '')),
    );
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        label={`${skillRecordName(skill)} currency detail`}
        className={`focus-modal ${styles.detail}`}
        close={close}
      >
        <header>
          <div>
            <span className="focus-eyebrow">{skillRecordGroup(skill)}</span>
            <h2>{skillRecordName(skill)}</h2>
            <p>{skill.description || 'No Skill description recorded.'}</p>
          </div>
          <button
            className="focus-icon"
            aria-label="Close Skill detail"
            onClick={close}
          >
            <X />
          </button>
        </header>
        <section
          className={`${styles.statusHero} ${statusClass[row.projection.status]}`}
        >
          <div>
            <small>Derived currency</small>
            <strong>{labels[row.projection.status]}</strong>
            <span>{row.projection.reason}</span>
          </div>
          <div>
            <small>Policy</small>
            <strong>{row.policy?.enabled ? 'Enabled' : 'Not enabled'}</strong>
            <span>
              {row.policy?.recommendedIntervalDays
                ? `Every ${row.policy.recommendedIntervalDays} days`
                : 'No interval'}
            </span>
          </div>
        </section>
        <section>
          <h3>Evidence timeline</h3>
          {history.length ? (
            <div className={styles.timeline}>
              {history.map((item) => {
                const dive = dives.find(
                  (candidate) => candidate.entityId === item.diveId,
                );
                const evaluator = people.find(
                  (person) => person.entityId === item.evaluatorPersonId,
                );
                return (
                  <article key={item.entityId}>
                    <div>
                      <b>{date(item.performedAt)}</b>
                      <span>
                        {dive
                          ? `${dive.site} · Dive ${dive.diveNumber ?? ''}`
                          : 'No Dive linked'}
                      </span>
                    </div>
                    <div>
                      <span>
                        {typeof item.competenceLevel === 'string'
                          ? skillCompetenceLevelLabel(
                              item.competenceLevel as SkillCompetenceLevel,
                            )
                          : item.competenceLevel == null
                            ? 'Not assessed'
                            : `Legacy ${item.competenceLevel}/5`}
                      </span>
                      <span>
                        {evaluator
                          ? `Evaluator: ${evaluator.name}`
                          : 'No evaluator'}
                      </span>
                    </div>
                    {item.assessment && <p>{item.assessment}</p>}
                    <span>Confidence: {item.confidenceLevel == null ? 'Not recorded' : `${item.confidenceLevel}/5`}</span>
                    {item.environment && <span>Environment: {item.environment}</span>}
                    {Boolean(item.attachmentIds?.length) && <span>{item.attachmentIds!.length} evidence attachment(s) retained with the linked Dive.</span>}
                    {item.notes && <small>{item.notes}</small>}
                  </article>
                );
              })}
            </div>
          ) : (
            <p>No evidence recorded.</p>
          )}
        </section>
        <footer>
          <button className="focus-secondary" onClick={editPolicy}>
            <SlidersHorizontal size={15} />
            Currency policy
          </button>
          <span />
          <button className="focus-secondary" onClick={close}>
            Close
          </button>
          <button className="focus-primary" onClick={addEvidence}>
            <Plus size={15} />
            Add evidence
          </button>
        </footer>
      </AccessibleDialog>
    </div>
  );
}

function PolicyEditor({
  skill,
  policy,
  close,
  saved,
}: {
  skill: CanonicalSkillRecord;
  policy: Stored<CurrencyPolicyRecord> | null;
  close: () => void;
  saved: () => Promise<void> | void;
}) {
  const [enabled, setEnabled] = useState(policy?.enabled ?? true);
  const [interval, setInterval] = useState(
    policy
      ? policy.recommendedIntervalDays == null
        ? ''
        : String(policy.recommendedIntervalDays)
      : '90',
  );
  const [dueSoon, setDueSoon] = useState(
    policy
      ? policy.dueSoonDays == null
        ? ''
        : String(policy.dueSoonDays)
      : '14',
  );
  const [assessments, setAssessments] = useState(
    (policy?.qualifyingAssessmentValues ?? []).join(', '),
  );
  const [notes, setNotes] = useState(policy?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await saveCurrencyPolicy({
        ...(policy ? { entityId: policy.entityId } : {}),
        skillKey: skillRecordKey(skill),
        enabled,
        recommendedIntervalDays: interval ? Number(interval) : null,
        dueSoonDays: dueSoon ? Number(dueSoon) : null,
        qualifyingAssessmentValues: assessments
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        notes,
      });
      await saved();
      close();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Policy could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        editable
        containDismiss
        label={`Currency policy for ${skillRecordName(skill)}`}
        className="focus-modal"
        close={() => {
          if (!busy) close();
        }}
      >
        <form onSubmit={(event) => void submit(event)}>
          <header>
            <div>
              <span className="focus-eyebrow">ADVISORY CURRENCY POLICY</span>
              <h2>{skillRecordName(skill)}</h2>
              <p>
                Changing policy recomputes status; it never rewrites evidence.
              </p>
            </div>
            <button
              type="button"
              className="focus-icon"
              data-dialog-close
              aria-label="Close policy editor"
              onClick={close}
            >
              <X />
            </button>
          </header>
          <fieldset disabled={busy} className={styles.policyFields}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              Enable advisory currency
            </label>
            <label>
              Recommended practice interval (days)
              <input
                type="number"
                min="1"
                max="3650"
                value={interval}
                onChange={(event) => setInterval(event.target.value)}
              />
            </label>
            <label>
              Due-soon warning window (days)
              <input
                type="number"
                min="0"
                max="3650"
                value={dueSoon}
                onChange={(event) => setDueSoon(event.target.value)}
              />
            </label>
            <label>
              Qualifying assessment values
              <input
                value={assessments}
                onChange={(event) => setAssessments(event.target.value)}
                placeholder="Optional exact values, comma-separated"
              />
              <small>Leave blank to allow any valid evidence occurrence.</small>
            </label>
            <label>
              Policy notes
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
              {busy ? 'Saving…' : 'Save policy'}
            </button>
          </footer>
        </form>
      </AccessibleDialog>
    </div>
  );
}

function EvidenceFromDiveDialog({
  initialSkill,
  skills,
  dives,
  people,
  equipmentSets,
  close,
  saved,
}: {
  initialSkill: CanonicalSkillRecord | null;
  skills: CanonicalSkillRecord[];
  dives: Array<DiveRecord & { entityId: string }>;
  people: Array<Stored<PersonRecord>>;
  equipmentSets: Array<Stored<EquipmentSetRecord>>;
  close: () => void;
  saved: () => Promise<void> | void;
}) {
  const [skillKey, setSkillKey] = useState(
    initialSkill
      ? skillRecordKey(initialSkill)
      : skills[0]
        ? skillRecordKey(skills[0])
        : '',
  );
  const [diveId, setDiveId] = useState('');
  const [performedAt, setPerformedAt] = useState(localDateTime());
  const [competence, setCompetence] = useState<'' | SkillCompetenceLevel>('');
  const [confidence, setConfidence] = useState('');
  const [assessment, setAssessment] = useState('');
  const [environment, setEnvironment] = useState('');
  const [evaluator, setEvaluator] = useState('');
  const [equipmentSetId, setEquipmentSetId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function selectDive(id: string) {
    setDiveId(id);
    const dive = dives.find((item) => item.entityId === id);
    if (dive) {
      setPerformedAt(
        localDateTime(`${dive.date}T${dive.timeOut || dive.timeIn || '12:00'}`),
      );
      setEnvironment(dive.waterType || dive.site || '');
      setEquipmentSetId(dive.equipmentSetId || dive.equipmentSetIds?.[0] || '');
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!diveId) return;
    setBusy(true);
    setError('');
    try {
      await saveDiveSkillEvidence(diveId, {
        skillKey,
        performedAt: new Date(performedAt).toISOString(),
        planId:
          dives.find((dive) => dive.entityId === diveId)?.originatingPlanId ??
          null,
        environment,
        assessment,
        competenceLevel: competence || null,
        confidenceLevel: confidence ? Number(confidence) : null,
        evaluatorPersonId: evaluator || null,
        equipmentSetId: equipmentSetId || null,
        attachmentIds: [],
        notes,
      });
      await saved();
      close();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Evidence could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        editable
        containDismiss
        label="Add Skill evidence from Dive"
        className={`focus-modal ${styles.evidenceDialog}`}
        close={() => {
          if (!busy) close();
        }}
      >
        <form onSubmit={(event) => void submit(event)}>
          <header>
            <div>
              <span className="focus-eyebrow">RECORDED PRACTICE</span>
              <h2>Add evidence from a Dive</h2>
              <p>
                The occurrence links to the canonical Dive; Dive details are not
                duplicated.
              </p>
            </div>
            <button
              type="button"
              className="focus-icon"
              data-dialog-close
              aria-label="Close evidence editor"
              onClick={close}
            >
              <X />
            </button>
          </header>
          <fieldset disabled={busy} className={styles.evidenceFields}>
            <label>
              Skill
              <select
                required
                value={skillKey}
                onChange={(event) => setSkillKey(event.target.value)}
              >
                {skills.map((skill) => (
                  <option key={skill.entityId} value={skillRecordKey(skill)}>
                    {skillRecordGroup(skill)} — {skillRecordName(skill)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dive
              <select
                required
                value={diveId}
                onChange={(event) => selectDive(event.target.value)}
              >
                <option value="">Choose logged Dive</option>
                {dives.map((dive) => (
                  <option key={dive.entityId} value={dive.entityId}>
                    {dive.date} · {dive.site}
                    {dive.diveNumber ? ` · #${dive.diveNumber}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Practised at
              <input
                type="datetime-local"
                required
                value={performedAt}
                onChange={(event) => setPerformedAt(event.target.value)}
              />
            </label>
            <label>
              Environment
              <input
                value={environment}
                onChange={(event) => setEnvironment(event.target.value)}
              />
            </label>
            <label>
              Competence
              <select
                value={competence}
                onChange={(event) =>
                  setCompetence(event.target.value as '' | SkillCompetenceLevel)
                }
              >
                <option value="">Not assessed</option>
                {SKILL_COMPETENCE_LEVELS.map((value) => (
                  <option key={value} value={value}>
                    {skillCompetenceLevelLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Confidence
              <select
                value={confidence}
                onChange={(event) => setConfidence(event.target.value)}
              >
                <option value="">Not recorded</option>
                {[0, 1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Evaluator
              <select
                value={evaluator}
                onChange={(event) => setEvaluator(event.target.value)}
              >
                <option value="">No evaluator recorded</option>
                {people.map((person) => (
                  <option key={person.entityId} value={person.entityId}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Equipment configuration
              <select
                value={equipmentSetId}
                onChange={(event) => setEquipmentSetId(event.target.value)}
              >
                <option value="">None recorded</option>
                {equipmentSets.map((set) => (
                  <option key={set.entityId} value={set.entityId}>
                    {set.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.span2}>
              Assessment
              <input
                value={assessment}
                onChange={(event) => setAssessment(event.target.value)}
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
            <button
              className="focus-primary"
              disabled={!skillKey || !diveId || busy}
            >
              {busy ? 'Saving…' : 'Record evidence'}
            </button>
          </footer>
        </form>
      </AccessibleDialog>
    </div>
  );
}
