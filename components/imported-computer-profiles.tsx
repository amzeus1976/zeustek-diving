'use client';

import { useMemo, useRef, useState } from 'react';
import { Link2, Search, Trash2, Unlink, X } from 'lucide-react';
import { AccessibleDialog } from './accessible-dialog';
import { RecordEditorWorkspace } from './shared/record-editor-workspace';
import type { DiveRecord } from '../lib/offline/dives';
import type { DiveSiteRecord, Stored } from '../lib/offline/dive-planning';
import type {
  ComputerEvidenceStore,
  ComputerImportRecord,
  ComputerProfileRecord,
} from '../lib/offline/computer-import';
import { suggestExistingDives } from '../lib/offline/computer-import-matcher';
import {
  filterComputerProfiles,
  type ComputerProfileFilters,
} from '../lib/offline/computer-profile-filters';
import {
  decisionsComplete,
  fieldCandidatesForDive,
  type ImportFieldCandidate,
  type ImportFieldDecision,
  type ImportResolutionAction,
} from '../lib/offline/import-resolution';
import {
  importRemovalSummary,
  linkComputerProfile,
  removeComputerImport,
  removeComputerProfile,
  setComputerProfileReviewState,
  unlinkComputerProfile,
  type ImportRemovalSummary,
} from '../lib/offline/computer-profile-management';
import type {
  OceanicGasDefinition,
  OceanicSegment,
  OceanicSourceSite,
} from '../lib/offline/oceanic-uddf';
import styles from './dive-computer-data.module.css';

type Profile = Stored<ComputerProfileRecord>;
type Import = Stored<ComputerImportRecord>;
type Dive = DiveRecord & { entityId: string };

type Props = {
  profiles: Profile[];
  imports: Import[];
  dives: Dive[];
  sites: Array<Stored<DiveSiteRecord>>;
  selectedProfileId: string;
  evidenceStore: ComputerEvidenceStore;
  selectProfile: (profileId: string) => void;
  refresh: () => Promise<void>;
  announce: (message: string) => void;
};

function asSegment(profile: Profile): OceanicSegment {
  return {
    sourceDiveId: profile.sourceDiveId,
    sourceSiteId: profile.sourceSiteId,
    rawTimestamp: profile.summary.rawTimestamp,
    normalisedTimestamp: profile.summary.normalisedTimestamp,
    timestampTransforms: [],
    greatestDepthM: profile.summary.greatestDepthM,
    sourceDurationSec: profile.summary.sourceDurationSec,
    finalSampleElapsedSec: profile.summary.finalSampleElapsedSec,
    minimumTemperatureC: profile.summary.minimumTemperatureC,
    ballastKg: profile.summary.ballastKg,
    gasId: profile.summary.gasId,
    diveMode: null,
    tankPressureBeginBar: profile.summary.tankPressureBeginBar,
    tankPressureEndBar: profile.summary.tankPressureEndBar,
    waypoints: [],
  };
}

function sourceSite(profile: Profile): OceanicSourceSite | undefined {
  if (!profile.sourceSite) return undefined;
  return {
    id: profile.sourceSiteId ?? `profile-site-${profile.entityId}`,
    ...profile.sourceSite,
  };
}

function sourceGas(profile: Profile): OceanicGasDefinition | undefined {
  if (!profile.sourceGas) return undefined;
  return {
    id: profile.summary.gasId ?? `profile-gas-${profile.entityId}`,
    ...profile.sourceGas,
  };
}

function matchesFor(
  profile: Profile,
  dives: Dive[],
  sites: Array<Stored<DiveSiteRecord>>,
) {
  return suggestExistingDives(
    asSegment(profile),
    dives,
    sourceSite(profile),
    sites,
    Math.max(dives.length, 5),
  );
}

function formatDate(value: string | null) {
  return value?.slice(0, 16).replace('T', ' ') || 'No timestamp';
}

export function ImportedComputerProfiles({
  profiles,
  imports,
  dives,
  sites,
  selectedProfileId,
  evidenceStore,
  selectProfile,
  refresh,
  announce,
}: Props) {
  const [search, setSearch] = useState('');
  const [status, setStatus] =
    useState<ComputerProfileFilters['status']>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sourceId, setSourceId] = useState('all');
  const [possibleDiveId, setPossibleDiveId] = useState('all');
  const [linking, setLinking] = useState<Profile | null>(null);
  const [removingProfile, setRemovingProfile] = useState<Profile | null>(null);
  const [removingImport, setRemovingImport] = useState<{
    record: Import;
    summary: ImportRemovalSummary | null;
  } | null>(null);

  const matches = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [
          profile.entityId,
          matchesFor(profile, dives, sites),
        ]),
      ),
    [dives, profiles, sites],
  );
  const filtered = useMemo(() => {
    const possibleDiveIds = new Map(
      [...matches].map(([profileId, candidates]) => [
        profileId,
        new Set(candidates.map((candidate) => candidate.diveId)),
      ]),
    );
    return filterComputerProfiles(
      profiles,
      {
        search,
        status,
        dateFrom,
        dateTo,
        sourceId,
        possibleDiveId,
      },
      possibleDiveIds,
    );
  }, [
    dateFrom,
    dateTo,
    matches,
    possibleDiveId,
    profiles,
    search,
    sourceId,
    status,
  ]);

  async function unlink(profile: Profile) {
    try {
      await unlinkComputerProfile(profile.entityId);
      announce(
        'Imported profile unlinked. The Dive log was retained unchanged.',
      );
      await refresh();
    } catch (error) {
      announce(
        error instanceof Error
          ? error.message
          : 'Profile could not be unlinked.',
      );
    }
  }

  async function reviewState(profile: Profile) {
    const next = profile.disposition === 'excluded' ? 'unlinked' : 'excluded';
    try {
      await setComputerProfileReviewState(profile, next);
      announce(
        next === 'excluded'
          ? 'Profile deferred from linking.'
          : 'Profile returned to the unlinked review queue.',
      );
      await refresh();
    } catch (error) {
      announce(
        error instanceof Error
          ? error.message
          : 'Profile review state could not be changed.',
      );
    }
  }

  async function openImportRemoval(record: Import) {
    setRemovingImport({ record, summary: null });
    try {
      const summary = await importRemovalSummary(record.entityId);
      setRemovingImport((current) =>
        current?.record.entityId === record.entityId
          ? { record, summary }
          : current,
      );
    } catch (error) {
      setRemovingImport(null);
      announce(
        error instanceof Error
          ? error.message
          : 'Import dependencies could not be checked.',
      );
    }
  }

  if (linking) return (
    <ProfileLinkDialog
      key={linking.entityId}
      profile={linking}
      dives={dives}
      sites={sites}
      close={() => setLinking(null)}
      saved={async (message) => {
        setLinking(null);
        announce(message);
        await refresh();
      }}
    />
  );

  return (
    <section
      className={styles.importedProfiles}
      aria-labelledby="imported-profiles-heading"
    >
      <header>
        <div>
          <span className="focus-eyebrow">POST-IMPORT REVIEW</span>
          <h2 id="imported-profiles-heading">Imported Profiles</h2>
          <p>
            {filtered.length} of {profiles.length} profiles shown
          </p>
        </div>
      </header>
      <div className={styles.profileFilters}>
        <label>
          <span>
            <Search size={16} /> Search
          </span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Profile, Site, gas or source"
          />
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value as ComputerProfileFilters['status'],
              )
            }
          >
            <option value="all">All profiles</option>
            <option value="unlinked">Unlinked profiles</option>
            <option value="linked">Linked profiles</option>
            <option value="excluded">Excluded / deferred</option>
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </label>
        <label>
          Import source
          <select
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
          >
            <option value="all">All import files</option>
            {imports.map((item) => (
              <option key={item.entityId} value={item.entityId}>
                {item.sourceFileName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Possible matching Dive
          <select
            value={possibleDiveId}
            onChange={(event) => setPossibleDiveId(event.target.value)}
          >
            <option value="all">All possible matches</option>
            {dives.map((dive) => (
              <option key={dive.entityId} value={dive.entityId}>
                {dive.date} · {dive.site}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.profileRows}>
        {filtered.map((profile) => {
          const target = profile.targetDiveId
            ? dives.find((dive) => dive.entityId === profile.targetDiveId)
            : undefined;
          return (
            <article
              key={profile.entityId}
              data-selected={profile.entityId === selectedProfileId}
            >
              <button
                type="button"
                className={styles.profileRowMain}
                onClick={() => selectProfile(profile.entityId)}
                aria-label={`View imported profile ${profile.sourceDiveId}`}
                aria-pressed={profile.entityId === selectedProfileId}
              >
                <span>{formatDate(profile.summary.normalisedTimestamp)}</span>
                <b>{profile.sourceSite?.name || profile.sourceDiveId}</b>
                <span>
                  {profile.summary.greatestDepthM == null
                    ? '—'
                    : `${profile.summary.greatestDepthM} m`}{' '}
                  ·{' '}
                  {profile.summary.sourceDurationSec == null
                    ? '—'
                    : `${Math.round(profile.summary.sourceDurationSec / 60)} min`}
                </span>
                <span>
                  {profile.sourceGas?.name || 'Gas unavailable'} ·{' '}
                  {profile.sourceFileName || 'Earlier import'}
                </span>
                <em>
                  {target
                    ? `Linked · ${target.date} · ${target.site}`
                    : profile.disposition === 'excluded'
                      ? 'Excluded / deferred'
                      : 'Unlinked'}
                </em>
              </button>
              <div className={styles.rowActions}>
                <button
                  type="button"
                  className="focus-secondary"
                  onClick={() => setLinking(profile)}
                >
                  <Link2 size={16} /> {target ? 'Change Dive' : 'Link to Dive'}
                </button>
                {target ? (
                  <button
                    type="button"
                    className="focus-secondary"
                    onClick={() => void unlink(profile)}
                  >
                    <Unlink size={16} /> Unlink
                  </button>
                ) : (
                  <button
                    type="button"
                    className="focus-secondary"
                    onClick={() => void reviewState(profile)}
                  >
                    {profile.disposition === 'excluded'
                      ? 'Return to review'
                      : 'Exclude / defer'}
                  </button>
                )}
                <button
                  type="button"
                  className="focus-secondary"
                  disabled={Boolean(target)}
                  onClick={() => setRemovingProfile(profile)}
                >
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            </article>
          );
        })}
        {!filtered.length && (
          <p className={styles.empty}>
            No imported profiles match these filters.
          </p>
        )}
      </div>
      {imports.length > 0 && (
        <details className={styles.importManagement}>
          <summary>Manage import files</summary>
          {imports.map((item) => (
            <div key={item.entityId}>
              <span>
                <b>{item.sourceFileName}</b>
                <small>
                  {item.profileIds?.length ?? item.segmentHashes.length} profile
                  reference(s)
                </small>
              </span>
              <button
                type="button"
                className="focus-secondary"
                onClick={() => void openImportRemoval(item)}
              >
                <Trash2 size={16} /> Remove import
              </button>
            </div>
          ))}
        </details>
      )}
      {removingProfile && (
        <RemovalDialog
          title={`Remove profile ${removingProfile.sourceDiveId}?`}
          description="This removes the unlinked imported profile and its private source evidence. It never deletes a Dive. Linked profiles must be unlinked first."
          removable={!removingProfile.targetDiveId}
          close={() => setRemovingProfile(null)}
          remove={async () => {
            await removeComputerProfile(
              removingProfile.entityId,
              evidenceStore,
              true,
            );
            setRemovingProfile(null);
            announce('Unlinked imported profile removed. No Dive was deleted.');
            await refresh();
          }}
        />
      )}
      {removingImport && (
        <RemovalDialog
          title={`Remove import ${removingImport.record.sourceFileName}?`}
          description={
            removingImport.summary
              ? `${removingImport.summary.reason} ${removingImport.summary.unlinkedProfiles} unlinked profile(s), ${removingImport.summary.linkedProfiles} linked profile(s), ${removingImport.summary.resolutionRecords} decision record(s).`
              : 'Checking dependencies…'
          }
          removable={Boolean(removingImport.summary?.removable)}
          close={() => setRemovingImport(null)}
          remove={async () => {
            await removeComputerImport(
              removingImport.record.entityId,
              evidenceStore,
              true,
            );
            setRemovingImport(null);
            announce(
              'Import and its unlinked profiles removed. No Dive was deleted.',
            );
            await refresh();
          }}
        />
      )}
    </section>
  );
}

function ProfileLinkDialog({
  profile,
  dives,
  sites,
  close,
  saved,
}: {
  profile: Profile;
  dives: Dive[];
  sites: Array<Stored<DiveSiteRecord>>;
  close: () => void;
  saved: (message: string) => Promise<void>;
}) {
  const candidates = useMemo(
    () => matchesFor(profile, dives, sites),
    [dives, profile, sites],
  );
  const [targetDiveId, setTargetDiveId] = useState(
    profile.targetDiveId ?? candidates[0]?.diveId ?? '',
  );
  const [applyFields, setApplyFields] = useState(false);
  const [decisions, setDecisions] = useState<ImportFieldDecision[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const target = dives.find((dive) => dive.entityId === targetDiveId);
  const candidateIds = new Set(
    candidates.map((candidate) => candidate.diveId),
  );
  const otherDives = dives.filter((dive) => !candidateIds.has(dive.entityId));
  const segment = asSegment(profile);
  const site = sourceSite(profile);
  const gas = sourceGas(profile);
  const differences = target
    ? fieldCandidatesForDive(
        target,
        [segment],
        new Map(site ? [[site.id, site]] : []),
        new Map(gas ? [[gas.id, gas]] : []),
      )
    : [];

  function choose(
    candidate: ImportFieldCandidate,
    action: ImportResolutionAction,
  ) {
    setDecisions((current) => [
      ...current.filter((item) => item.fieldPath !== candidate.fieldPath),
      { ...candidate, action },
    ]);
  }

  async function link() {
    if (!targetDiveId) {
      setMessage('Choose a candidate Dive.');
      return;
    }
    if (applyFields && !decisionsComplete(differences, decisions)) {
      setMessage('Choose a decision for every displayed difference.');
      return;
    }
    setBusy(true);
    try {
      const result = await linkComputerProfile(
        profile.entityId,
        targetDiveId,
        applyFields ? decisions : [],
      );
      await saved(
        result.decisions
          ? `Profile linked and ${result.decisions} owner field decision(s) recorded.`
          : 'Profile linked. Existing Dive fields were left unchanged.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Profile could not be linked.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <RecordEditorWorkspace
      label={`Link profile ${profile.sourceDiveId}`}
      close={close}
      save={link}
      busy={busy}
      saveLabel={applyFields ? 'Link and apply decisions' : 'Link only'}
      saveDisabled={!targetDiveId}
      value={{targetDiveId,applyFields,decisions}}
      trackInteractions={false}
      contentClassName={styles.linkDialog}
    >
        <div>
          <div>
            <span className="focus-eyebrow">LINK AFTER IMPORT</span>
            <h2>Choose a Dive log</h2>
          </div>
        </div>
        <p>
          Same-date and nearest-time Dives are listed first, followed by Site,
          duration and depth similarity. Linking alone never overwrites a Dive
          field.
        </p>
        {message && <output className="focus-notice">{message}</output>}
        <label className={styles.candidateSelect}>
          Candidate Dive
          <select
            value={targetDiveId}
            onChange={(event) => {
              setTargetDiveId(event.target.value);
              setDecisions([]);
            }}
          >
            <option value="">Choose a Dive</option>
            <optgroup label="Suggested by date, time, Site and profile">
              {candidates.map((candidate) => {
                const dive = dives.find(
                  (item) => item.entityId === candidate.diveId,
                )!;
                return (
                  <option key={candidate.diveId} value={candidate.diveId}>
                    {dive.date} {dive.timeIn} · {dive.site} ·{' '}
                    {candidate.reasons
                      .map((reason) => reason.label)
                      .join(', ')}
                  </option>
                );
              })}
            </optgroup>
            {otherDives.length > 0 && (
              <optgroup label="Other Dive logs">
                {otherDives.map((dive) => (
                  <option key={dive.entityId} value={dive.entityId}>
                    {dive.date} {dive.timeIn} · {dive.site}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        {targetDiveId && (
          <section className={styles.matchReasons}>
            <h3>Why this Dive is suggested</h3>
            {(
              candidates.find((candidate) => candidate.diveId === targetDiveId)
                ?.reasons ?? []
            ).map((reason) => (
              <p key={reason.key}>
                <b>{reason.label}</b> · {reason.detail}
              </p>
            ))}
          </section>
        )}
        <label className={styles.applyFields}>
          <input
            type="checkbox"
            checked={applyFields}
            onChange={(event) => {
              setApplyFields(event.target.checked);
              setDecisions([]);
            }}
          />
          Review imported differences and optionally apply owner-approved values
        </label>
        {applyFields &&
          differences.map((candidate) => {
            const decision = decisions.find(
              (item) => item.fieldPath === candidate.fieldPath,
            );
            return (
              <article
                key={candidate.fieldPath}
                className={styles.linkDifference}
              >
                <div>
                  <b>{candidate.fieldPath}</b>
                  <small>
                    ZeusTek: {JSON.stringify(candidate.zeustekValue)}
                  </small>
                  <small>
                    Imported: {JSON.stringify(candidate.importedValue)}
                  </small>
                </div>
                <select
                  aria-label={`Decision for ${candidate.fieldPath}`}
                  value={decision?.action ?? ''}
                  onChange={(event) =>
                    choose(
                      candidate,
                      event.target.value as ImportResolutionAction,
                    )
                  }
                >
                  <option value="">Choose decision</option>
                  <option value="keep-zeustek">Keep ZeusTek value</option>
                  <option value="use-imported">Use imported value</option>
                  {candidate.resolutionClass !== 'scalar' && (
                    <option value="append">Merge / add</option>
                  )}
                  <option value="ignore">Ignore imported value</option>
                </select>
              </article>
            );
          })}
    </RecordEditorWorkspace>
  );
}

function RemovalDialog({
  title,
  description,
  removable,
  close,
  remove,
}: {
  title: string;
  description: string;
  removable: boolean;
  close: () => void;
  remove: () => Promise<void>;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await remove();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Removal failed safely.',
      );
      setBusy(false);
    }
  }
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        editable
        containDismiss
        onEscape={() => closeRef.current?.click()}
        label={title}
        close={close}
        className="focus-modal"
      >
        <header>
          <h2>{title}</h2>
          <button
            ref={closeRef}
            type="button"
            className="focus-icon"
            data-dialog-close
            aria-label="Close removal review"
            onClick={close}
          >
            <X />
          </button>
        </header>
        <p>{description}</p>
        {!removable && (
          <p role="alert" className={styles.warning}>
            Removal is blocked until the dependencies above are resolved.
          </p>
        )}
        {message && <output className="focus-notice">{message}</output>}
        <label className={styles.confirmRemove}>
          Type REMOVE to confirm
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
        </label>
        <div className={styles.stepActions}>
          <button type="button" className="focus-secondary" onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            className="focus-primary"
            disabled={!removable || confirmation !== 'REMOVE' || busy}
            onClick={() => void confirm()}
          >
            {busy ? 'Removing…' : 'Remove safely'}
          </button>
        </div>
      </AccessibleDialog>
    </div>
  );
}
