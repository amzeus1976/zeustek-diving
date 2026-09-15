'use client';
import { useCallback, useState } from 'react';
import { Link2 } from 'lucide-react';
import { listRecords, type Stored } from '../lib/offline/dive-planning';
import type { ComputerProfileRecord } from '../lib/offline/computer-import';
import { useRecordRefresh } from './record-status';

export function ComputerProfileEvidence({ diveId }: { diveId: string }) {
  const [profiles, setProfiles] = useState<
    Array<Stored<ComputerProfileRecord>>
  >([]);
  const refresh = useCallback(
    async () =>
      setProfiles(
        (await listRecords<ComputerProfileRecord>('computer-profile')).filter(
          (row) => row.targetDiveId === diveId,
        ),
      ),
    [diveId],
  );
  useRecordRefresh(refresh);
  if (!profiles.length) return null;
  return (
    <section className="focus-card computer-profile-evidence">
      <div className="focus-card-head">
        <div>
          <span className="focus-eyebrow">DIVE COMPUTER EVIDENCE</span>
          <h3>Imported profiles</h3>
        </div>
        <Link2 />
      </div>
      {profiles
        .sort((a, b) =>
          String(a.summary.normalisedTimestamp ?? '').localeCompare(
            String(b.summary.normalisedTimestamp ?? ''),
          ),
        )
        .map((profile) => (
          <details key={profile.entityId}>
            <summary>
              {profile.sourceDiveId} · {profile.summary.greatestDepthM ?? '—'} m
              ·{' '}
              {profile.summary.sourceDurationSec == null
                ? '—'
                : Math.round(profile.summary.sourceDurationSec / 60) + ' min'}
            </summary>
            <dl className="detail-grid">
              <div>
                <small>Source timestamp</small>
                <span>{profile.summary.rawTimestamp ?? '—'}</span>
              </div>
              <div>
                <small>Normalised</small>
                <span>{profile.summary.normalisedTimestamp ?? '—'}</span>
              </div>
              <div>
                <small>Source duration</small>
                <span>{profile.summary.sourceDurationSec ?? '—'} s</span>
              </div>
              <div>
                <small>Profile elapsed</small>
                <span>{profile.summary.finalSampleElapsedSec ?? '—'} s</span>
              </div>
              <div>
                <small>Waypoints</small>
                <span>{profile.summary.waypointCount}</span>
              </div>
              <div>
                <small>Segment hash</small>
                <span>{profile.segmentHash.slice(0, 16)}…</span>
              </div>
            </dl>
            <p>
              Full profile samples remain source evidence and are not flattened
              into the canonical Dive.
            </p>
            <a
              className="focus-link"
              href={`/?section=Dive%20Computer%20Imports&profileId=${encodeURIComponent(profile.entityId)}`}
            >
              Review this profile in Dive Computer Imports
            </a>
          </details>
        ))}
    </section>
  );
}
