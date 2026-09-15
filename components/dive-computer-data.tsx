'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileUp,
  HardDriveDownload,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { AccessibleDialog } from './accessible-dialog';
import { useRecordRefresh } from './record-status';
import { listDives, type DiveRecord } from '../lib/offline/dives';
import { listRecords, type Stored } from '../lib/offline/dive-planning';
import {
  assignStageSegments,
  commitComputerImport,
  listComputerImportStages,
  stageOceanicImport,
  type ComputerEvidenceStore,
  type ComputerImportRecord,
  type ComputerImportStage,
  type ComputerProfileRecord,
  type StagedAssignment,
} from '../lib/offline/computer-import';
import {
  decisionsComplete,
  fieldCandidatesForDive,
  rebaseImportDecisions,
  type ImportFieldCandidate,
  type ImportFieldDecision,
  type ImportResolutionAction,
} from '../lib/offline/import-resolution';
import type { OceanicSegment } from '../lib/offline/oceanic-uddf';
import { currentDiveAccount } from '../lib/offline/dive-store';
import {
  createComputerEvidenceStore,
  flushComputerEvidenceAttachments,
} from '../lib/offline/evidence-attachments';
import styles from './dive-computer-data.module.css';

type Props = {
  go?: (next: string) => void;
  evidenceStore?: ComputerEvidenceStore;
};

export function DiveComputerData({ evidenceStore }: Props) {
  const [imports, setImports] = useState<Array<Stored<ComputerImportRecord>>>(
    [],
  );
  const [profiles, setProfiles] = useState<
    Array<Stored<ComputerProfileRecord>>
  >([]);
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>(
    [],
  );
  const [stages, setStages] = useState<ComputerImportStage[]>([]);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [reviewing, setReviewing] = useState<ComputerImportStage | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const durableEvidenceStore = useMemo(
    () => evidenceStore ?? createComputerEvidenceStore(currentDiveAccount()),
    [evidenceStore],
  );
  const refresh = useCallback(async () => {
    void flushComputerEvidenceAttachments(currentDiveAccount());
    const [nextImports, nextProfiles, nextDives, nextStages] =
      await Promise.all([
        listRecords<ComputerImportRecord>('computer-import'),
        listRecords<ComputerProfileRecord>('computer-profile'),
        listDives(),
        listComputerImportStages(),
      ]);
    setImports(
      nextImports.sort((left, right) =>
        right.importedAt.localeCompare(left.importedAt),
      ),
    );
    setProfiles(nextProfiles);
    setDives(nextDives);
    setStages(nextStages);
    const requested =
      typeof window === 'undefined'
        ? ''
        : (new URLSearchParams(window.location.search).get('profileId') ?? '');
    setSelectedProfile((current) =>
      requested && nextProfiles.some((row) => row.entityId === requested)
        ? requested
        : current && nextProfiles.some((row) => row.entityId === current)
          ? current
          : (nextProfiles[0]?.entityId ?? ''),
    );
  }, []);
  useRecordRefresh(refresh);

  const profile =
    profiles.find((row) => row.entityId === selectedProfile) ?? null;
  const target = profile?.targetDiveId
    ? dives.find((dive) => dive.entityId === profile.targetDiveId)
    : undefined;

  async function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage('Parsing locally…');
    try {
      const stage = await stageOceanicImport(file);
      setReviewing(stage);
      setMessage(
        `Parsed ${stage.segments.length} source profile segment(s) locally. Nothing canonical has been changed.`,
      );
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Import parse failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className="focus-eyebrow">DIVE DATA</span>
          <h1>Dive Computer Imports</h1>
          <p>
            Preserve original computer exports and link imported profiles to
            your canonical dive log.
          </p>
        </div>
        <div className={styles.heroQuote}>
          Your data.
          <br />
          All devices. One log.
          <i />
        </div>
      </header>
      {message && <output className="focus-notice">{message}</output>}
      <section className={styles.importBox}>
        <label className={styles.drop}>
          <Upload />
          <b>Drag &amp; drop a dive computer file here</b>
          <span>or</span>
          <strong>{busy ? 'Parsing…' : 'Select file'}</strong>
          <input
            type="file"
            accept=".uddf,.udf,application/xml,text/xml"
            disabled={busy}
            onChange={(event) => {
              void pick(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
        <div>
          <span className="focus-eyebrow">SUPPORTED FIRST ADAPTER</span>
          <div className={styles.formats}>
            <b>.uddf</b>
            <small>Oceanic+ UDDF 3.2.1</small>
          </div>
        </div>
        <aside>
          <ShieldCheck />
          <b>Original source evidence is preserved</b>
          <p>
            Parse and review happen locally. Canonical Dives change only after
            explicit assignment, field decisions and a final atomic commit.
          </p>
        </aside>
      </section>
      <section className={styles.workspace}>
        <aside className={styles.sources}>
          <header>
            <span className="focus-eyebrow">IMPORTS / STAGING</span>
          </header>
          {stages.map((stage) => (
            <button key={stage.sessionId} onClick={() => setReviewing(stage)}>
              <FileUp />
              <span>
                <b>{stage.fileName}</b>
                <small>{stage.segments.length} segments · staged locally</small>
              </span>
            </button>
          ))}
          {imports.map((item) => (
            <button
              key={item.entityId}
              onClick={() =>
                setSelectedProfile(
                  profiles.find(
                    (profileRow) => profileRow.importId === item.entityId,
                  )?.entityId ?? '',
                )
              }
            >
              <HardDriveDownload />
              <span>
                <b>{item.sourceFileName}</b>
                <small>
                  {new Date(item.importedAt).toLocaleString()} · committed
                </small>
              </span>
            </button>
          ))}
          {!stages.length && !imports.length && <p>No computer imports yet.</p>}
        </aside>
        <section className={styles.profile}>
          <header>
            <div>
              <span className="focus-eyebrow">IMPORTED DIVE PROFILE</span>
              <h2>
                {target?.site ||
                  profile?.sourceDiveId ||
                  'Select an imported profile'}
              </h2>
            </div>
            {target && (
              <a
                className="focus-secondary"
                href={`/?section=Logbook&diveId=${encodeURIComponent(target.entityId)}`}
              >
                View in logbook
              </a>
            )}
          </header>
          {profile ? (
            <>
              <div className={styles.profileTop}>
                <ProfileChart points={profile.preview} />
                <dl>
                  <div>
                    <dt>Max depth</dt>
                    <dd>
                      {profile.summary.greatestDepthM == null
                        ? '—'
                        : `${profile.summary.greatestDepthM} m`}
                    </dd>
                  </div>
                  <div>
                    <dt>Source duration</dt>
                    <dd>
                      {profile.summary.sourceDurationSec == null
                        ? '—'
                        : `${Math.round(profile.summary.sourceDurationSec / 60)} min`}
                    </dd>
                  </div>
                  <div>
                    <dt>Profile elapsed</dt>
                    <dd>
                      {profile.summary.finalSampleElapsedSec == null
                        ? '—'
                        : `${Math.round(profile.summary.finalSampleElapsedSec / 60)} min`}
                    </dd>
                  </div>
                  <div>
                    <dt>Lowest temp</dt>
                    <dd>
                      {profile.summary.minimumTemperatureC == null
                        ? '—'
                        : `${profile.summary.minimumTemperatureC.toFixed(1)} °C`}
                    </dd>
                  </div>
                </dl>
              </div>
              <Comparison profile={profile} dive={target} />
            </>
          ) : (
            <p className={styles.empty}>
              Committed profile evidence will appear here. Use a staged import
              to review a new UDDF file first.
            </p>
          )}
        </section>
      </section>
      <section className={styles.recent}>
        <header>
          <span className="focus-eyebrow">RECENT IMPORTED PROFILES</span>
        </header>
        {profiles.slice(0, 8).map((row) => (
          <button
            key={row.entityId}
            onClick={() => setSelectedProfile(row.entityId)}
          >
            <span>
              {row.summary.normalisedTimestamp
                ?.slice(0, 16)
                .replace('T', ' ') || 'No timestamp'}
            </span>
            <b>{row.sourceDiveId}</b>
            <span>{row.disposition}</span>
            <em>{row.targetDiveId ? 'Linked' : 'No target'}</em>
          </button>
        ))}
        {!profiles.length && <p>No committed profiles.</p>}
      </section>
      {reviewing && (
        <ImportWizard
          stage={reviewing}
          dives={dives}
          evidenceStore={durableEvidenceStore}
          close={() => setReviewing(null)}
          update={setReviewing}
          committed={async (result) => {
            setReviewing(null);
            setMessage(`Import ${result.importId} committed atomically.`);
            await refresh();
          }}
        />
      )}
    </main>
  );
}

function ProfileChart({
  points,
}: {
  points: ComputerProfileRecord['preview'];
}) {
  const valid = points.filter(
    (point) => point.elapsedSec != null && point.depthM != null,
  );
  if (valid.length < 2)
    return <div className={styles.chartEmpty}>Profile samples unavailable</div>;
  const maxT = Math.max(...valid.map((point) => point.elapsedSec!)) || 1;
  const maxD = Math.max(...valid.map((point) => point.depthM!)) || 1;
  const path = valid
    .map(
      (point, index) =>
        `${index ? 'L' : 'M'} ${(point.elapsedSec! / maxT) * 1000} ${(point.depthM! / maxD) * 250}`,
    )
    .join(' ');
  return (
    <div className={styles.chartWrap}>
      <span className="sr-only">
        Depth profile with {valid.length} preview samples; maximum depth{' '}
        {maxD.toFixed(1)} metres.
      </span>
      <svg className={styles.chart} viewBox="0 0 1000 270" aria-hidden="true">
        <defs>
          <linearGradient id="profile-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#08baf2" stopOpacity=".35" />
            <stop offset="1" stopColor="#08baf2" stopOpacity=".03" />
          </linearGradient>
        </defs>
        <path d={`${path} L 1000 260 L 0 260 Z`} fill="url(#profile-fill)" />
        <path d={path} fill="none" stroke="#08baf2" strokeWidth="4" />
      </svg>
      <details className={styles.profileTable}>
        <summary>Profile values as a table</summary>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>Elapsed</th>
                <th>Depth</th>
                <th>Temperature</th>
              </tr>
            </thead>
            <tbody>
              {valid.map((point, index) => (
                <tr key={`${point.elapsedSec}-${index}`}>
                  <td>{point.elapsedSec} s</td>
                  <td>{point.depthM} m</td>
                  <td>
                    {point.temperatureC == null
                      ? '—'
                      : `${point.temperatureC} °C`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Comparison({
  profile,
  dive,
}: {
  profile: Stored<ComputerProfileRecord>;
  dive: (DiveRecord & { entityId: string }) | undefined;
}) {
  const rows = [
    ['Max depth', dive?.maxDepthM, profile.summary.greatestDepthM, 'm'],
    [
      'Minimum temperature',
      dive?.minimumTemperatureC,
      profile.summary.minimumTemperatureC,
      '°C',
    ],
    ['Ballast', dive?.ballastKg, profile.summary.ballastKg, 'kg'],
  ];
  return (
    <section className={styles.compare}>
      <h3>RECORDED vs IMPORTED</h3>
      <div className={styles.tableScroll}>
        <table
          className={styles.profileTable}
          aria-label="Recorded and imported values"
        >
          <thead>
            <tr>
              <th>Field</th>
              <th>Recorded</th>
              <th>Imported</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, recorded, imported, unit]) => (
              <tr key={String(name)}>
                <th scope="row">{name}</th>
                <td>{recorded == null ? '—' : `${recorded} ${unit}`}</td>
                <td>{imported == null ? '—' : `${imported} ${unit}`}</td>
                <td>
                  {recorded != null && imported != null
                    ? `${(Number(imported) - Number(recorded)).toFixed(1)} ${unit}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function inputValue(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number')
    return String(value);
  return JSON.stringify(value);
}

function stagedAsSegments(stage: ComputerImportStage, selectedIds: string[]) {
  return stage.segments
    .filter((segment) => selectedIds.includes(segment.sourceDiveId))
    .map(
      (segment) => ({ ...segment, waypoints: [] }) as unknown as OceanicSegment,
    );
}

function ImportWizard({
  stage,
  dives,
  evidenceStore,
  close,
  update,
  committed,
}: {
  stage: ComputerImportStage;
  dives: Array<DiveRecord & { entityId: string }>;
  evidenceStore: ComputerEvidenceStore;
  close: () => void;
  update: (stage: ComputerImportStage) => void;
  committed: (result: Awaited<ReturnType<typeof commitComputerImport>>) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    stage.segments
      .filter(
        (segment) =>
          segment.dedupState === 'new' ||
          segment.dedupState === 'updated-source-version',
      )
      .slice(0, 1)
      .map((segment) => segment.sourceDiveId),
  );
  const [action, setAction] =
    useState<StagedAssignment['action']>('target-existing');
  const [targetDiveId, setTargetDiveId] = useState('');
  const [targetOverride, setTargetOverride] = useState<
    (DiveRecord & { entityId: string }) | undefined
  >();
  const [decisions, setDecisions] = useState<ImportFieldDecision[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedSegments = stage.segments.filter((segment) =>
    selectedIds.includes(segment.sourceDiveId),
  );
  const selectedDive =
    targetOverride?.entityId === targetDiveId
      ? targetOverride
      : dives.find((dive) => dive.entityId === targetDiveId);
  const fullSegments = stagedAsSegments(stage, selectedIds);
  const first = selectedSegments[0];
  const createBase: DiveRecord | undefined =
    action === 'create-new' && first
      ? {
          site: 'Imported Oceanic+ dive — review Site',
          siteId: '',
          date: first.normalisedTimestamp?.slice(0, 10) || '',
          timeIn: first.normalisedTimestamp?.match(/T(\d{2}:\d{2})/)?.[1] || '',
          maxDepthM: null,
          bottomTimeMin: null,
          gas: '',
          notes: '',
          source: 'oceanic-plus',
          createdAt: '',
          modifiedAt: '',
        }
      : undefined;
  const resolutionDive =
    action === 'target-existing' ? selectedDive : createBase;
  const candidateRows = resolutionDive
    ? fieldCandidatesForDive(
        resolutionDive,
        fullSegments,
        new Map(stage.sites.map((site) => [site.id, site])),
        new Map(stage.gases.map((gas) => [gas.id, gas])),
      )
    : [];
  const assignedIds = new Set(
    stage.assignments.flatMap((assignment) => assignment.sourceDiveIds),
  );
  const unassigned = stage.segments.filter(
    (segment) => !assignedIds.has(segment.sourceDiveId),
  );
  const durable =
    evidenceStore.capabilities.localBackup &&
    evidenceStore.capabilities.cloudSync;

  function choose(
    fieldPath: string,
    selectedAction: ImportResolutionAction,
    candidate: ImportFieldCandidate,
  ) {
    setDecisions((current) => [
      ...current.filter((row) => row.fieldPath !== fieldPath),
      {
        ...candidate,
        action: selectedAction,
        committedValue:
          selectedAction === 'manual' ? candidate.importedValue : undefined,
      },
    ]);
  }
  function changeManual(fieldPath: string, value: string) {
    setDecisions((current) =>
      current.map((decision) => {
        if (decision.fieldPath !== fieldPath) return decision;
        let committedValue: unknown = value;
        if (typeof decision.importedValue === 'number')
          committedValue = value === '' ? null : Number(value);
        return { ...decision, committedValue };
      }),
    );
  }
  async function saveAssignment() {
    if (!selectedIds.length) {
      setMessage('Select at least one source segment.');
      return;
    }
    if (action === 'target-existing' && !targetDiveId) {
      setMessage('Choose an existing Dive target.');
      return;
    }
    if (action !== 'exclude' && !decisionsComplete(candidateRows, decisions)) {
      setMessage('Choose an owner decision for every imported field.');
      return;
    }
    const next = await assignStageSegments(stage, {
      sourceDiveIds: selectedIds,
      action,
      targetDiveId: action === 'target-existing' ? targetDiveId : null,
      decisions,
    });
    update(next);
    setMessage('Assignment saved in local staging.');
    setStep(3);
  }
  async function excludeAlreadyImported() {
    const ids = unassigned
      .filter((segment) => segment.dedupState === 'already-imported')
      .map((segment) => segment.sourceDiveId);
    if (!ids.length) return;
    const next = await assignStageSegments(stage, {
      sourceDiveIds: ids,
      action: 'exclude',
      targetDiveId: null,
      decisions: [],
    });
    update(next);
    setMessage(
      `${ids.length} already-imported segment(s) marked excluded from this commit.`,
    );
  }
  async function commit() {
    if (!durable) {
      setMessage(
        'Raw and profile evidence must support local backup and cloud sync before Save import.',
      );
      return;
    }
    setBusy(true);
    try {
      committed(await commitComputerImport(stage, evidenceStore));
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('IMPORT_TARGET_CHANGED:')
      ) {
        const changedId = error.message.slice('IMPORT_TARGET_CHANGED:'.length);
        const latest = (await listDives()).find(
          (dive) => dive.entityId === changedId,
        );
        if (latest && changedId === targetDiveId) {
          const refreshed = fieldCandidatesForDive(
            latest,
            fullSegments,
            new Map(stage.sites.map((site) => [site.id, site])),
            new Map(stage.gases.map((gas) => [gas.id, gas])),
          );
          setTargetOverride(latest);
          setDecisions((current) => rebaseImportDecisions(current, refreshed));
          setStep(2);
          setMessage(
            'The target Dive changed during review. Unchanged decisions were retained; choose again for each changed comparison, then save the assignment.',
          );
          return;
        }
      }
      setMessage(
        error instanceof Error
          ? error.message
          : 'Import commit failed. No partial canonical commit remains.',
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
        onEscape={() => closeButtonRef.current?.click()}
        label="Review computer import"
        close={close}
        className={`focus-modal ${styles.wizard}`}
      >
        <header>
          <div>
            <span className="focus-eyebrow">LOCAL IMPORT REVIEW</span>
            <h2>{stage.fileName}</h2>
            <p>
              {stage.segments.length} segments · SHA-256{' '}
              {stage.fileHash.slice(0, 16)}…
            </p>
          </div>
          <button
            ref={closeButtonRef}
            className="focus-icon"
            data-dialog-close
            aria-label="Close import review"
            onClick={close}
          >
            <X />
          </button>
        </header>
        {message && <output className="focus-notice">{message}</output>}
        {stage.warnings.map((warning) => (
          <p key={warning} className={styles.warning}>
            {warning}
          </p>
        ))}
        <nav className={styles.steps} aria-label="Import review steps">
          {[
            'Select',
            'Assign & resolve',
            'Profile review',
            'Commit preview',
          ].map((label, index) => (
            <button
              key={label}
              type="button"
              aria-current={step === index + 1 ? 'step' : undefined}
              onClick={() => setStep(index + 1)}
            >
              <span>{index + 1}</span>
              {label}
            </button>
          ))}
        </nav>

        {step === 1 && (
          <section className={styles.segmentList}>
            <h3>1. Select source segment(s)</h3>
            {stage.groupSuggestions.map((group) => (
              <button
                type="button"
                className="focus-secondary"
                key={group.key}
                onClick={() => setSelectedIds(group.segmentIds)}
              >
                {group.segmentIds.length} adjacent segments · select suggested
                group
              </button>
            ))}
            {stage.segments.map((segment) => (
              <label key={segment.sourceDiveId} data-state={segment.dedupState}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(segment.sourceDiveId)}
                  onChange={(event) =>
                    setSelectedIds((current) =>
                      event.target.checked
                        ? [...new Set([...current, segment.sourceDiveId])]
                        : current.filter((id) => id !== segment.sourceDiveId),
                    )
                  }
                />
                <span>
                  <b>{segment.sourceDiveId}</b>
                  <small>
                    {segment.normalisedTimestamp || 'No timestamp'} ·{' '}
                    {segment.greatestDepthM ?? '—'} m · {segment.waypointCount}{' '}
                    samples
                  </small>
                </span>
                <em>{segment.dedupState.replaceAll('-', ' ')}</em>
              </label>
            ))}
            <div className={styles.stepActions}>
              {unassigned.some(
                (segment) => segment.dedupState === 'already-imported',
              ) && (
                <button
                  className="focus-secondary"
                  type="button"
                  onClick={() => void excludeAlreadyImported()}
                >
                  Exclude already imported from this commit
                </button>
              )}
              <button
                className="focus-primary"
                type="button"
                disabled={!selectedIds.length}
                onClick={() => setStep(2)}
              >
                Continue to assignment
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <>
            <section className={styles.assignment}>
              <h3>2. Explicit assignment</h3>
              <label>
                Action
                <select
                  value={action}
                  onChange={(event) => {
                    setAction(event.target.value as StagedAssignment['action']);
                    setTargetOverride(undefined);
                    setDecisions([]);
                  }}
                >
                  <option value="target-existing">Link to existing Dive</option>
                  <option value="create-new">Create new Dive</option>
                  <option value="exclude">
                    Exclude or defer source segment
                  </option>
                </select>
              </label>
              {action === 'target-existing' && (
                <label>
                  Target Dive
                  <select
                    value={targetDiveId}
                    onChange={(event) => {
                      setTargetDiveId(event.target.value);
                      setTargetOverride(undefined);
                      setDecisions([]);
                    }}
                  >
                    <option value="">Choose Dive</option>
                    {dives.map((dive) => (
                      <option key={dive.entityId} value={dive.entityId}>
                        {dive.date} · {dive.site} · {dive.maxDepthM ?? '—'} m
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {action === 'target-existing' &&
              selectedSegments[0]?.matchCandidates?.length ? (
                <details>
                  <summary>Explainable match suggestions</summary>
                  {selectedSegments[0].matchCandidates.map((row) => (
                    <button
                      type="button"
                      key={row.diveId}
                      className="focus-link"
                      onClick={() => {
                        setTargetDiveId(row.diveId);
                        setDecisions([]);
                      }}
                    >
                      {row.confidence} · {row.score} points ·{' '}
                      {dives.find((dive) => dive.entityId === row.diveId)
                        ?.site || row.diveId}
                      <small>
                        {row.reasons.map((reason) => reason.detail).join('; ')}
                      </small>
                    </button>
                  ))}
                </details>
              ) : null}
            </section>
            {candidateRows.length > 0 && (
              <section className={styles.resolution}>
                <h3>Field resolution</h3>
                {candidateRows.map((candidate) => {
                  const selected = decisions.find(
                    (row) => row.fieldPath === candidate.fieldPath,
                  );
                  return (
                    <article key={candidate.fieldPath}>
                      <div>
                        <b>{candidate.fieldPath}</b>
                        <small>
                          ZeusTek: {JSON.stringify(candidate.zeustekValue)}
                        </small>
                        <small>
                          Oceanic+: {JSON.stringify(candidate.importedValue)}
                        </small>
                        <small>
                          {candidate.provenance} ·{' '}
                          {candidate.sourceSegmentIds.length} source segment(s)
                        </small>
                      </div>
                      <div>
                        <select
                          aria-label={`Decision for ${candidate.fieldPath}`}
                          value={selected?.action ?? ''}
                          onChange={(event) =>
                            choose(
                              candidate.fieldPath,
                              event.target.value as ImportResolutionAction,
                              candidate,
                            )
                          }
                        >
                          <option value="">Choose decision</option>
                          <option value="keep-zeustek">Keep ZeusTek</option>
                          <option value="use-imported">Use Oceanic+</option>
                          {candidate.resolutionClass !== 'scalar' && (
                            <option value="append">Merge / add</option>
                          )}
                          <option value="ignore">Ignore imported field</option>
                          <option value="manual">Manual combined value</option>
                        </select>
                        {selected?.action === 'manual' && (
                          <input
                            aria-label={`Manual value for ${candidate.fieldPath}`}
                            type={
                              typeof candidate.importedValue === 'number'
                                ? 'number'
                                : 'text'
                            }
                            value={inputValue(selected.committedValue)}
                            onChange={(event) =>
                              changeManual(
                                candidate.fieldPath,
                                event.target.value,
                              )
                            }
                          />
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
            <div className={styles.stepActions}>
              <button
                className="focus-secondary"
                type="button"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                className="focus-primary"
                type="button"
                onClick={() => void saveAssignment()}
              >
                Save assignment
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <section className={styles.profileReview}>
            <h3>3. Profile review</h3>
            {selectedSegments.length ? (
              selectedSegments.map((segment) => (
                <article key={segment.sourceDiveId}>
                  <h4>{segment.sourceDiveId}</h4>
                  <ProfileChart points={segment.preview} />
                  <dl className="detail-grid">
                    <div>
                      <small>Raw timestamp</small>
                      <span>{segment.rawTimestamp ?? '—'}</span>
                    </div>
                    <div>
                      <small>Normalised timestamp</small>
                      <span>{segment.normalisedTimestamp ?? '—'}</span>
                    </div>
                    <div>
                      <small>Summary max depth</small>
                      <span>{segment.greatestDepthM ?? '—'} m</span>
                    </div>
                    <div>
                      <small>Source duration</small>
                      <span>{segment.sourceDurationSec ?? '—'} s</span>
                    </div>
                    <div>
                      <small>Final sample elapsed</small>
                      <span>{segment.finalSampleElapsedSec ?? '—'} s</span>
                    </div>
                    <div>
                      <small>Waypoints</small>
                      <span>{segment.waypointCount}</span>
                    </div>
                  </dl>
                </article>
              ))
            ) : (
              <p>No segment selected.</p>
            )}
            <div className={styles.stepActions}>
              <button
                className="focus-secondary"
                type="button"
                onClick={() => setStep(2)}
              >
                Back to resolution
              </button>
              <button
                className="focus-primary"
                type="button"
                onClick={() => setStep(4)}
              >
                Review final commit
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className={styles.commitPreview}>
            <h3>4. Commit preview</h3>
            <p>
              <b>{stage.assignments.length}</b> assignment group(s) saved ·{' '}
              <b>{assignedIds.size}</b> of <b>{stage.segments.length}</b> source
              segments reviewed.
            </p>
            {stage.assignments.map((assignment, index) => (
              <article key={`${assignment.action}-${index}`}>
                <CheckCircle2 />
                <span>
                  <b>
                    {assignment.sourceDiveIds.length} segment(s) ·{' '}
                    {assignment.action.replaceAll('-', ' ')}
                  </b>
                  <small>
                    {assignment.targetDiveId
                      ? `Canonical Dive ${assignment.targetDiveId}`
                      : 'No existing Dive target'}{' '}
                    · {assignment.decisions.length} field decision(s)
                  </small>
                </span>
              </article>
            ))}
            {unassigned.length > 0 && (
              <p role="alert" className={styles.warning}>
                {unassigned.length} source segment(s) still need an explicit
                assignment.
              </p>
            )}
            <p>
              Save import writes the source, profiles, owner decisions and
              accepted Dive changes as one local atomic batch. Full evidence
              stays out of the canonical Dive.
            </p>
            <div className={styles.stepActions}>
              <button
                className="focus-secondary"
                type="button"
                onClick={() => setStep(1)}
              >
                Review another segment
              </button>
              <button
                className="focus-primary"
                type="button"
                disabled={busy || unassigned.length > 0 || !durable}
                onClick={() => void commit()}
              >
                {busy ? 'Committing…' : 'Save import atomically'}
              </button>
            </div>
            {!durable && (
              <p className={styles.blocker}>
                Save import is disabled until raw and profile evidence is
                protected by local backup and private cloud sync.
              </p>
            )}
          </section>
        )}
      </AccessibleDialog>
    </div>
  );
}
