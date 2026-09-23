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
import { ZeusTekIcon } from './zeustek-icon';
import { ImportedComputerProfiles } from './imported-computer-profiles';
import { useRecordRefresh } from './record-status';
import { listDives, type DiveRecord } from '../lib/offline/dives';
import {
  listRecords,
  type DiveSiteRecord,
  type Stored,
} from '../lib/offline/dive-planning';
import {
  commitComputerImport,
  listComputerImportStages,
  stageOceanicImport,
  type ComputerEvidenceStore,
  type ComputerImportRecord,
  type ComputerImportStage,
  type ComputerProfileRecord,
} from '../lib/offline/computer-import';
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
  const [sites, setSites] = useState<Array<Stored<DiveSiteRecord>>>([]);
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
    const [nextImports, nextProfiles, nextDives, nextSites, nextStages] =
      await Promise.all([
        listRecords<ComputerImportRecord>('computer-import'),
        listRecords<ComputerProfileRecord>('computer-profile'),
        listDives(),
        listRecords<DiveSiteRecord>('site'),
        listComputerImportStages(),
      ]);
    setImports(
      nextImports.sort((left, right) =>
        right.importedAt.localeCompare(left.importedAt),
      ),
    );
    setProfiles(nextProfiles);
    setDives(nextDives);
    setSites(nextSites);
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
        <div className={styles.iconHeading}>
          <ZeusTekIcon id="dive-computer" size="hero" />
          <div>
          <span className="focus-eyebrow">DIVE DATA</span>
          <h1>Dive Computer Imports</h1>
          <p>
            Import every new computer profile first, then review and link it to
            a Dive log when you are ready.
          </p>
          </div>
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
            Parse, deduplication and preview happen locally. Importing preserves
            evidence without assigning or overwriting a canonical Dive.
          </p>
        </aside>
      </section>
      <details className={styles.importSources}><summary>Import files and local staging</summary>
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
      </details>
      <section className={styles.importReviewGrid} aria-label="Imported Dive master and detail">
      <ImportedComputerProfiles
        profiles={profiles}
        imports={imports}
        dives={dives}
        sites={sites}
        selectedProfileId={selectedProfile}
        evidenceStore={durableEvidenceStore}
        selectProfile={setSelectedProfile}
        refresh={refresh}
        announce={setMessage}
      />
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
      {reviewing && (
        <ImportWizard
          stage={reviewing}
          evidenceStore={durableEvidenceStore}
          close={() => setReviewing(null)}
          committed={async (result) => {
            setReviewing(null);
            setMessage(
              result.reusedImport && result.profiles === 0
                ? `Import already complete. ${result.alreadyImported} profile(s) were not duplicated.`
                : `Import finished: ${result.newProfiles} new and ${result.updatedProfiles} reviewed updated profile(s). Link them from Imported Profiles when ready.`,
            );
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

function ImportWizard({
  stage,
  evidenceStore,
  close,
  committed,
}: {
  stage: ComputerImportStage;
  evidenceStore: ComputerEvidenceStore;
  close: () => void;
  committed: (result: Awaited<ReturnType<typeof commitComputerImport>>) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState(1);
  const [reviewedUpdatedIds, setReviewedUpdatedIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const newSegments = stage.segments.filter(
    (segment) => segment.dedupState === 'new',
  );
  const updatedSegments = stage.segments.filter(
    (segment) => segment.dedupState === 'updated-source-version',
  );
  const alreadyImported = stage.segments.filter(
    (segment) => segment.dedupState === 'already-imported',
  );
  const previouslyExcluded = stage.segments.filter(
    (segment) => segment.dedupState === 'previously-excluded',
  );
  const durable =
    evidenceStore.capabilities.localBackup &&
    evidenceStore.capabilities.cloudSync;

  async function commit() {
    if (!durable) {
      setMessage(
        'Raw and profile evidence must support local backup and cloud sync before Save import.',
      );
      return;
    }
    setBusy(true);
    try {
      committed(
        await commitComputerImport(stage, evidenceStore, {
          reviewedUpdatedSourceIds: reviewedUpdatedIds,
        }),
      );
    } catch (error) {
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
          {['Preview', 'Finish import'].map((label, index) => (
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
            <h3>1. Import preview</h3>
            <p>
              All <b>{newSegments.length}</b> new valid profiles are selected
              automatically. No Dive assignment or field decision is required.
            </p>
            {stage.segments.map((segment) => (
              <article
                key={segment.sourceDiveId}
                data-state={segment.dedupState}
              >
                <span>
                  <b>{segment.sourceDiveId}</b>
                  <small>
                    {segment.normalisedTimestamp || 'No timestamp'} ·{' '}
                    {segment.greatestDepthM ?? '—'} m · {segment.waypointCount}{' '}
                    samples
                  </small>
                </span>
                <em>{segment.dedupState.replaceAll('-', ' ')}</em>
                {segment.dedupState === 'updated-source-version' && (
                  <label>
                    <input
                      type="checkbox"
                      checked={reviewedUpdatedIds.includes(
                        segment.sourceDiveId,
                      )}
                      onChange={(event) =>
                        setReviewedUpdatedIds((current) =>
                          event.target.checked
                            ? [...new Set([...current, segment.sourceDiveId])]
                            : current.filter(
                                (id) => id !== segment.sourceDiveId,
                              ),
                        )
                      }
                    />
                    I reviewed this updated source version; preserve the profile
                    identity and add the new evidence version
                    <small>
                      Previous{' '}
                      {segment.priorSegmentHash?.slice(0, 12) ?? 'unknown'}… →
                      new {segment.segmentHash.slice(0, 12)}…
                    </small>
                  </label>
                )}
              </article>
            ))}
            <div className={styles.stepActions}>
              <button
                className="focus-primary"
                type="button"
                onClick={() => setStep(2)}
              >
                Review import summary
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className={styles.commitPreview}>
            <h3>2. Finish import</h3>
            <p>
              <b>{newSegments.length}</b> new profile(s) will be imported ·{' '}
              <b>{reviewedUpdatedIds.length}</b> reviewed update(s) will add a
              new evidence version.
            </p>
            <article>
              <CheckCircle2 />
              <span>
                <b>Import all new profiles</b>
                <small>
                  Profiles remain unlinked. Existing Dive fields and prior owner
                  decisions are unchanged.
                </small>
              </span>
            </article>
            <p>
              {alreadyImported.length} already imported ·{' '}
              {updatedSegments.length - reviewedUpdatedIds.length} updated
              source version(s) left unchanged · {previouslyExcluded.length}{' '}
              previously excluded/deferred.
            </p>
            <p>
              The source and profiles are saved atomically through the existing
              local-first history and sync path. Link or resolve fields later
              from Imported Profiles.
            </p>
            <div className={styles.stepActions}>
              <button
                className="focus-secondary"
                type="button"
                onClick={() => setStep(1)}
              >
                Back to preview
              </button>
              <button
                className="focus-primary"
                type="button"
                disabled={busy || !durable}
                onClick={() => void commit()}
              >
                {busy ? 'Importing…' : 'Import all new profiles'}
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

