'use client';
/* oxlint-disable next/no-img-element -- Revocable, bounded Blob derivatives must not enter an image optimiser or persistent cache. */
import { useEffect, useState } from 'react';
import {
  validateSharedSnapshot,
  type SharedSnapshot,
  type ShareDatum,
} from '@/lib/sharing/share-links';

type Props = {
  snapshot: SharedSnapshot;
  ownerPreview?: boolean;
  token?: string;
  onAssetsReady?: (ready: boolean) => void;
  onUnavailable?: () => void;
};
function SavedValues({ rows }: { rows: ShareDatum[] }) {
  return rows.length ? (
    <dl className="public-insights">
      {rows.map((row) => (
        <div key={row.key}>
          <dt>{row.label}</dt>
          <dd>
            {row.value ?? 'Unavailable'}{' '}
            {typeof row.value === 'number' ? row.unit : ''}
          </dd>
        </div>
      ))}
    </dl>
  ) : (
    <p>Saved values are unavailable or were not selected.</p>
  );
}
async function assetBlob(response: Response) {
  if (!response.ok) throw new Error('Selected attachment unavailable.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Selected attachment unavailable.');
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 4 * 1024 * 1024) {
        await reader.cancel();
        throw new Error('Selected attachment unavailable.');
      }
      parts.push(new Uint8Array(part.value));
    }
  } finally {
    reader.releaseLock();
  }
  return new Blob(parts, {
    type: response.headers.get('content-type') ?? 'application/octet-stream',
  });
}
/** The manager and anonymous page use this identical text/asset presentation. */
export function SharedSnapshotView({
  snapshot: raw,
  ownerPreview = false,
  token,
  onAssetsReady,
  onUnavailable,
}: Props) {
  const snapshot = validateSharedSnapshot(raw),
    [loaded, setLoaded] = useState<{
      snapshot: SharedSnapshot | null;
      urls: Record<string, string>;
      failed: boolean;
    }>({ snapshot: null, urls: {}, failed: false }),
    photoId = snapshot.profile?.photoId;
  const assets = loaded.snapshot === snapshot ? loaded.urls : {},
    assetError = loaded.snapshot === snapshot && loaded.failed;
  useEffect(() => {
    const controller = new AbortController(),
      urls: string[] = [];
    let active = true;
    const ids = [
      ...new Set([
        ...snapshot.attachments.map((asset) => asset.id),
        ...(photoId ? [photoId] : []),
      ]),
    ];
    void Promise.all(
      ids.map(async (id) => {
        const response = await fetch(
            `/api/share/asset?id=${id}${ownerPreview ? '&preview=1' : ''}`,
            {
              cache: 'no-store',
              credentials: ownerPreview ? 'same-origin' : 'omit',
              signal: controller.signal,
              ...(!ownerPreview && token
                ? { headers: { authorization: `Bearer ${token}` } }
                : {}),
            },
          ),
          blob = await assetBlob(response);
        const selected = snapshot.attachments.find((asset) => asset.id === id);
        if (
          (selected && blob.type !== selected.contentType) ||
          (!selected && !['image/png', 'image/jpeg'].includes(blob.type))
        )
          throw new Error('Selected attachment unavailable.');
        if (!active) throw new DOMException('Cancelled', 'AbortError');
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return [id, url] as const;
      }),
    )
      .then((entries) => {
        if (active) {
          setLoaded({
            snapshot,
            urls: Object.fromEntries(entries),
            failed: false,
          });
          onAssetsReady?.(true);
        }
      })
      .catch(() => {
        if (active) {
          setLoaded({ snapshot, urls: {}, failed: true });
          onAssetsReady?.(false);
          onUnavailable?.();
          active = false;
          controller.abort();
          for (const url of urls) URL.revokeObjectURL(url);
        }
      });
    return () => {
      active = false;
      controller.abort();
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [snapshot, photoId, ownerPreview, token, onAssetsReady, onUnavailable]);
  const plan = snapshot.gasPlan,
    profile = snapshot.profile;
  return (
    <article
      className="shared-snapshot-view"
      aria-label="Selected shared snapshot"
    >
      <header>
        <span className="focus-eyebrow">ZEUSTEK DIVING · SNAPSHOT</span>
        <h1>{snapshot.label}</h1>
        <p className="public-profile-source">
          Snapshot {new Date(snapshot.asOf).toLocaleString('en-GB')} ·{' '}
          {snapshot.expiresAt
            ? `Expires ${new Date(snapshot.expiresAt).toLocaleString('en-GB')}`
            : 'No expiry selected'}
          . Later private edits are not included.
        </p>
      </header>
      {profile && (
        <>
          <h2>{profile.displayName || 'Selected diver profile'}</h2>
          {photoId &&
            (assets[photoId] ? (
              <img
                className="public-profile-photo"
                src={assets[photoId]}
                alt="Owner-selected photograph"
                referrerPolicy="no-referrer"
              />
            ) : (
              <p>
                {assetError
                  ? 'Selected photograph unavailable.'
                  : 'Loading selected photograph…'}
              </p>
            ))}
          {profile.biography && (
            <p className="public-biography">{profile.biography}</p>
          )}
          {profile.insights.length > 0 && (
            <dl className="public-insights">
              {profile.insights.map((item) => (
                <div key={item.key}>
                  <dt>{item.label}</dt>
                  <dd>
                    {item.value}{' '}
                    {typeof item.value === 'number' ? item.unit : ''}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {profile.certifications.length > 0 && (
            <section>
              <h2>Selected awards</h2>
              <p>
                Awards describe recorded achievements and do not grant diving
                permissions.
              </p>
              <ul>
                {profile.certifications.map((award, index) => (
                  <li key={index}>
                    {award.title} {award.agency && `· ${award.agency}`}{' '}
                    {award.date && `· ${award.date}`}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {profile.training.length > 0 && (
            <section>
              <h2>Selected training</h2>
              <ul>
                {profile.training.map((training, index) => (
                  <li key={index}>
                    {training.title} {training.agency && `· ${training.agency}`}{' '}
                    · {training.status}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {plan && (
        <>
          <p className="shared-planning-notice">{plan.notice}</p>
          <p>
            Saved model: {plan.modelVersion ?? 'Not recorded'} · allocation:{' '}
            {plan.allocationVersion ?? 'Not recorded'} · saved physiological
            assessment: <strong>{plan.physiologicalStatus}</strong>.{' '}
            {plan.recordedAt &&
              `Recorded ${new Date(plan.recordedAt).toLocaleString('en-GB')}.`}
          </p>
          <section>
            <h2>Selected inputs</h2>
            <SavedValues rows={plan.inputs} />
          </section>
          <section>
            <h2>Saved outputs</h2>
            <SavedValues rows={plan.outputs} />
          </section>
          {plan.supplies.length > 0 && (
            <section>
              <h2>Individual supplies</h2>
              <p>
                Each supply keeps its saved result. Totals cannot cover an
                independent cylinder failure.
              </p>
              <div className="shared-supply-grid">
                {plan.supplies.map((supply) => (
                  <section key={supply.label} className="shared-supply">
                    <h3>
                      {supply.label} · {supply.status}
                    </h3>
                    <p>
                      {supply.role} · {supply.accessibility} · available from{' '}
                      {supply.availableFrom}
                    </p>
                    <dl className="shared-values">
                      {[
                        ['O₂ fraction', supply.oxygenFraction],
                        ['Helium fraction', supply.heliumFraction],
                        ['Water volume (L)', supply.waterVolumeL],
                        ['Current pressure (bar)', supply.currentPressureBar],
                        [
                          'Planned start pressure (bar)',
                          supply.plannedStartPressureBar,
                        ],
                        ['Available gas (L)', supply.availableLitres],
                        ['Normal requirement (L)', supply.requiredLitres],
                        ['Assigned reserve (L)', supply.reserveLitres],
                        [
                          'Contingency requirement (L)',
                          supply.contingencyRequiredLitres,
                        ],
                      ].map(([label, value]) => (
                        <div key={String(label)}>
                          <dt>{label}</dt>
                          <dd>{value ?? 'Unavailable'}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            </section>
          )}
          {plan.scenarios.length > 0 && (
            <section>
              <h2>Selected contingency / bailout scenarios</h2>
              {plan.scenarios.map((scenario) => (
                <section className="shared-supply" key={scenario.label}>
                  <h3>
                    {scenario.label} · {scenario.status}
                  </h3>
                  <p>
                    Starts {scenario.at}. Assumed unavailable:{' '}
                    {scenario.failedSupplies.join(', ') ||
                      'No failed supply recorded'}
                    . Allowance factor: {scenario.factor ?? 'Unavailable'}.
                  </p>
                  <p>{scenario.basis}</p>
                  <ul>
                    {scenario.cylinders.map((supply) => (
                      <li key={supply.label}>
                        <strong>
                          {supply.label} · {supply.status}
                        </strong>{' '}
                        — available {supply.availableLitres ?? 'unavailable'} L;
                        required {supply.requiredLitres ?? 'unavailable'} L;
                        assigned reserve {supply.reserveLitres ?? 'unavailable'}{' '}
                        L.
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </section>
          )}
          {plan.reservePhases.length > 0 && (
            <section>
              <h2>Saved emergency-reserve phases</h2>
              {plan.reservePhases.map((phase) => (
                <p key={phase.label}>
                  {phase.label}: {phase.depthM ?? 'unavailable'} m ·{' '}
                  {phase.minutes ?? 'unavailable'} min · multiplier{' '}
                  {phase.multiplier ?? 'unavailable'} ·{' '}
                  {phase.litres ?? 'unavailable'} L.
                </p>
              ))}
            </section>
          )}
          <section>
            <h2>Warnings and limitations</h2>
            {plan.warnings.length > 0 && (
              <ul>
                {plan.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            {plan.omittedWarnings > 0 && (
              <p>
                {plan.omittedWarnings} additional saved reason(s) contain
                unsupported or private detail. Review the private plan with its
                owner; this snapshot does not replace that review.
              </p>
            )}
            <p>No independent safety verification is provided.</p>
          </section>
        </>
      )}
      {snapshot.attachments.length > 0 && (
        <section>
          <h2>Selected attachments</h2>
          <p>
            Files and image pixels may contain details omitted from the text.
            Review the full content before distributing it.
          </p>
          {snapshot.attachments.map((asset) => (
            <figure className="shared-attachment" key={asset.id}>
              <figcaption>
                {asset.label} ·{' '}
                {asset.contentType === 'application/pdf'
                  ? 'Static PDF'
                  : 'Image'}
              </figcaption>
              {assets[asset.id] ? (
                asset.contentType === 'application/pdf' ? (
                  <a
                    className="focus-secondary"
                    href={assets[asset.id]}
                    target="_blank"
                    rel="noreferrer"
                    download="shared-document.pdf"
                  >
                    Review / download {asset.label}
                  </a>
                ) : (
                  <>
                    <img
                      src={assets[asset.id]}
                      alt={asset.label}
                      referrerPolicy="no-referrer"
                    />
                    <a
                      className="focus-secondary"
                      href={assets[asset.id]}
                      target="_blank"
                      rel="noreferrer"
                      download="shared-image"
                    >
                      Open / download {asset.label}
                    </a>
                  </>
                )
              ) : (
                <p>
                  {assetError
                    ? 'Selected attachment unavailable.'
                    : 'Loading selected attachment…'}
                </p>
              )}
            </figure>
          ))}
        </section>
      )}
      <footer>
        <p>
          This is selected owner evidence. Revocation prevents future server
          access; it cannot erase saved downloads or screenshots.
        </p>
      </footer>
    </article>
  );
}
