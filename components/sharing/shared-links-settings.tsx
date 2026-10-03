'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PUBLIC_INSIGHTS, opaqueId } from '@/lib/sharing/public-profile';
import {
  validateSharedSnapshot,
  type ShareInput,
  type SharedSnapshot,
  type ShareAttachment,
} from '@/lib/sharing/share-links';
import { prepareSharingRaster } from '@/lib/sharing/prepare-raster';
import { SharedSnapshotView } from './shared-snapshot-view';
import { AccessibleDialog } from '../accessible-dialog';

type Option = { id: string; title: string; agency: string };
type Catalog = {
  plans: Option[];
  certifications: Option[];
  training: Option[];
  attachments: ShareAttachment[];
  attachmentLimitReached?: boolean;
};
type Managed = {
  id: string;
  kind: ShareInput['kind'];
  label: string;
  enabled: boolean;
  expired: boolean;
  expiresAt: string | null;
  revision: number;
  updatedAt: string;
  snapshot: SharedSnapshot;
  input: ShareInput;
};
type Preview = { snapshot: SharedSnapshot; previewHash: string };
const empty = (
  kind: ShareInput['kind'] = 'profile',
  recordId = '',
): ShareInput => ({
  version: 1,
  kind,
  label: kind === 'profile' ? 'Selected diver profile' : 'Selected Gas Plan',
  expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  attachmentIds: [],
  ...(kind === 'profile'
    ? { profile: { insights: [], certificationIds: [], trainingIds: [] } }
    : { gasPlan: { recordId, inputs: true, supplies: true, outputs: true } }),
});
const dateInput = (stamp: string | null) =>
  stamp
    ? new Date(Date.parse(stamp) - new Date(stamp).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : '';
async function jsonRequest<T>(
  url: string,
  body?: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
      cache: 'no-store',
      ...(signal ? { signal } : {}),
      ...(body
        ? {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
    }),
    value = (await response.json()) as { error?: unknown };
  if (!response.ok)
    throw new Error(
      typeof value?.error === 'string'
        ? value.error
        : 'Sharing controls unavailable.',
    );
  return value as T;
}
export function SharedLinksSettings() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [links, setLinks] = useState<Managed[]>([]),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [input, setInput] = useState<ShareInput>(() => empty()),
    [editing, setEditing] = useState<Managed | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [savedPreview, setSavedPreview] = useState<SharedSnapshot | null>(null),
    [approved, setApproved] = useState(false),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('Loading owner-only Shared Links…'),
    [copyLink, setCopyLink] = useState(''),
    [confirmation, setConfirmation] = useState<{
      kind: 'revoke' | 'regenerate';
      link: Managed;
    } | null>(null),
    [assetLabel, setAssetLabel] = useState('Selected attachment');
  const previewRef = useRef<HTMLDivElement>(null),
    settingsRef = useRef<HTMLDivElement>(null);
  const onReady = useCallback((value: boolean) => setReady(value), []);
  const load = useCallback(async (page = 0, signal?: AbortSignal) => {
    const [listing, options] = await Promise.all([
      jsonRequest<{ items: Managed[]; more: boolean }>(
        `/api/share/manage?offset=${page}`,
        undefined,
        signal,
      ),
      jsonRequest<Catalog>('/api/share/manage?catalog=1', undefined, signal),
    ]);
    if (signal?.aborted) return options;
    setLinks(listing.items);
    setMore(listing.more);
    setOffset(page);
    setCatalog(options);
    return options;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve()
      .then(() =>
        controller.signal.aborted ? null : load(0, controller.signal),
      )
      .then((options) => {
        if (controller.signal.aborted || !options) return;
        const id = new URLSearchParams(window.location.search).get('gasPlanId');
        if (id && options.plans.some((plan) => plan.id === id))
          setInput(empty('gas-plan', id));
        setMessage(
          'No new link is published. Select the visitor content and review its exact preview.',
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            'Shared Links could not be loaded. Reopen this section to retry.',
          );
      });
    return () => controller.abort();
  }, [load]);
  function change(next: ShareInput) {
    setInput(next);
    setPreview(null);
    setSavedPreview(null);
    setApproved(false);
    setReady(false);
  }
  function changeProfile(patch: Partial<NonNullable<ShareInput['profile']>>) {
    change({ ...input, profile: { ...input.profile!, ...patch } });
  }
  function newLink() {
    setEditing(null);
    setCopyLink('');
    change(empty());
    setMessage('New private selection. Preview before publishing.');
    settingsRef.current?.focus();
  }
  async function action(
    kind: 'preview' | 'create' | 'replace' | 'revoke' | 'regenerate',
    link?: Managed,
  ) {
    setBusy(true);
    setCopyLink('');
    try {
      const selected = link ?? editing,
        body =
          kind === 'revoke' || kind === 'regenerate'
            ? { action: kind, id: selected!.id, revision: selected!.revision }
            : {
                action: kind,
                input,
                ...(kind !== 'preview' && preview
                  ? {
                      asOf: preview.snapshot.asOf,
                      previewHash: preview.previewHash,
                    }
                  : {}),
                ...(kind === 'replace'
                  ? { id: editing!.id, revision: editing!.revision }
                  : {}),
              };
      const result = await jsonRequest<{
        snapshot?: unknown;
        previewHash?: string;
        token?: string;
      }>('/api/share/manage', body);
      if (kind === 'preview') {
        if (typeof result.previewHash !== 'string')
          throw new Error('Preview unavailable.');
        setPreview({
          snapshot: validateSharedSnapshot(result.snapshot),
          previewHash: result.previewHash,
        });
        setApproved(false);
        setReady(false);
        setMessage(
          'Exact visitor preview ready. Review every selected field and attachment.',
        );
        requestAnimationFrame(() => previewRef.current?.focus());
      } else {
        await load(offset);
        setPreview(null);
        setApproved(false);
        setReady(false);
        setSavedPreview(null);
        setEditing(null);
        if (
          typeof result.token === 'string' &&
          /^[A-Za-z0-9_-]{43}$/.test(result.token)
        )
          setCopyLink(`${window.location.origin}/share/#${result.token}`);
        setMessage(
          kind === 'revoke'
            ? 'Link revoked. Future data and attachment requests are unavailable. Saved copies cannot be erased.'
            : kind === 'regenerate'
              ? 'A new link is ready to copy. The old link is invalid.'
              : 'Approved snapshot published. Later private edits are not included.',
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Sharing change could not be completed. Reopen its recorded status before retrying.',
      );
      setApproved(false);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File, photo = false) {
    setBusy(true);
    setMessage('Preparing a private derivative; nothing is being published…');
    try {
      if (photo || file.type !== 'application/pdf') {
        const blob = await prepareSharingRaster(file),
          response = await fetch('/api/share/asset', {
            method: 'POST',
            headers: {
              'content-type': 'image/png',
              'x-share-asset-label': encodeURIComponent(
                photo ? 'Selected profile photograph' : assetLabel,
              ),
            },
            body: blob,
          }),
          result = (await response.json()) as {
            error?: string;
            photoId?: string;
            id?: string;
          };
        if (!response.ok)
          throw new Error(result.error ?? 'Image could not be prepared.');
        if (photo) {
          if (!opaqueId(result.id))
            throw new Error('Photo preparation unavailable.');
          changeProfile({ photoId: result.id });
        } else {
          if (!opaqueId(result.id))
            throw new Error('Attachment preparation unavailable.');
          await load(offset);
          change({
            ...input,
            attachmentIds:
              input.attachmentIds.length < 5
                ? [...new Set([...input.attachmentIds, result.id])]
                : input.attachmentIds,
          });
        }
      } else {
        if (file.size > 2 * 1024 * 1024)
          throw new Error('Choose a static PDF up to 2 MB and 20 pages.');
        const response = await fetch('/api/share/asset', {
            method: 'POST',
            headers: {
              'content-type': 'application/pdf',
              'x-share-asset-label': encodeURIComponent(assetLabel),
            },
            body: file,
          }),
          result = (await response.json()) as {
            error?: string;
            photoId?: string;
            id?: string;
          };
        if (!response.ok)
          throw new Error(result.error ?? 'PDF could not be prepared.');
        if (!opaqueId(result.id))
          throw new Error('Attachment preparation unavailable.');
        await load(offset);
        change({
          ...input,
          attachmentIds:
            input.attachmentIds.length < 5
              ? [...new Set([...input.attachmentIds, result.id])]
              : input.attachmentIds,
        });
      }
      setMessage(
        'Private derivative prepared. Select it and inspect the exact preview before publication. Originals remain private.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Attachment could not be prepared.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(copyLink);
      setMessage(
        'Link copied. Anyone with this link can read the selected snapshot.',
      );
    } catch {
      setMessage('Copy the link from the selected field below.');
    }
  }
  function edit(link: Managed) {
    setCopyLink('');
    setEditing(link.enabled ? link : null);
    change(link.input);
    setMessage(
      link.enabled
        ? 'Editing this saved selection. Changes stay private until exact preview and replacement.'
        : 'This link is revoked. Its selection can be published as a new, separate link.',
    );
    settingsRef.current?.focus();
  }
  return (
    <section
      className="sharing-settings"
      aria-label="Owner Shared Links controls"
    >
      {confirmation && (
        <AccessibleDialog
          label={
            confirmation.kind === 'revoke'
              ? 'Revoke selected shared link'
              : 'Regenerate selected shared link'
          }
          className="focus-modal"
          containDismiss
          close={() => {
            if (!busy) setConfirmation(null);
          }}
        >
          <h2>
            {confirmation.kind === 'revoke'
              ? 'Revoke this shared link?'
              : 'Generate a replacement link?'}
          </h2>
          <p>{confirmation.link.label}</p>
          <p>
            {confirmation.kind === 'revoke'
              ? 'Future data and attachment requests will be blocked. Already downloaded copies cannot be erased.'
              : 'The old link will stop working. Copy the new link immediately; it is shown once.'}
          </p>
          <footer>
            <button
              type="button"
              className="focus-secondary"
              disabled={busy}
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="focus-primary"
              disabled={busy}
              onClick={() =>
                void action(confirmation.kind, confirmation.link).then(() =>
                  setConfirmation(null),
                )
              }
            >
              {confirmation.kind === 'revoke'
                ? 'Revoke selected link'
                : 'Regenerate selected link'}
            </button>
          </footer>
        </AccessibleDialog>
      )}
      <p>
        Share a selected Diver Profile or saved Gas Plan as a snapshot. Anyone
        with the link can read exactly the reviewed content. Private records
        stay private; publication is off until you explicitly approve a preview.
      </p>
      <output aria-live="polite">{message}</output>
      {catalog && (
        <>
          <div ref={settingsRef} tabIndex={-1}>
            <h3>
              {editing
                ? 'Replace selected snapshot'
                : 'Prepare a new shared link'}
            </h3>
          </div>
          <fieldset disabled={busy}>
            <legend>Visitor content</legend>
            <label>
              Snapshot type
              <select
                value={input.kind}
                onChange={(event) => {
                  const kind = event.target.value as ShareInput['kind'];
                  setEditing(null);
                  change(empty(kind));
                }}
              >
                <option value="profile">Diver Profile</option>
                <option value="gas-plan">Gas Plan</option>
              </select>
            </label>
            <label>
              Visitor-facing title
              <input
                maxLength={120}
                value={input.label}
                onChange={(event) =>
                  change({ ...input, label: event.target.value })
                }
              />
            </label>
            {input.profile && (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={input.profile.displayName !== undefined}
                    onChange={(event) => {
                      const profile = { ...input.profile! };
                      if (event.target.checked) profile.displayName = '';
                      else delete profile.displayName;
                      change({ ...input, profile });
                    }}
                  />{' '}
                  Include a display name
                </label>
                {input.profile.displayName !== undefined && (
                  <label>
                    Selected display name
                    <input
                      maxLength={80}
                      value={input.profile.displayName}
                      onChange={(event) =>
                        changeProfile({ displayName: event.target.value })
                      }
                    />
                  </label>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={input.profile.biography !== undefined}
                    onChange={(event) => {
                      const profile = { ...input.profile! };
                      if (event.target.checked) profile.biography = '';
                      else delete profile.biography;
                      change({ ...input, profile });
                    }}
                  />{' '}
                  Include owner-written text
                </label>
                {input.profile.biography !== undefined && (
                  <label>
                    Selected profile text
                    <textarea
                      rows={5}
                      maxLength={4000}
                      value={input.profile.biography}
                      onChange={(event) =>
                        changeProfile({ biography: event.target.value })
                      }
                    />
                  </label>
                )}
                <label>
                  Choose a separate profile photograph
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(file, true);
                      event.target.value = '';
                    }}
                  />
                </label>
                {input.profile.photoId && (
                  <button
                    type="button"
                    className="focus-secondary"
                    onClick={() => {
                      const profile = { ...input.profile! };
                      delete profile.photoId;
                      change({ ...input, profile });
                    }}
                  >
                    Remove selected photograph
                  </button>
                )}
                <fieldset>
                  <legend>Selected Insights</legend>
                  {PUBLIC_INSIGHTS.map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={input.profile!.insights.includes(key)}
                        onChange={(event) =>
                          changeProfile({
                            insights: event.target.checked
                              ? [...input.profile!.insights, key]
                              : input.profile!.insights.filter(
                                  (item) => item !== key,
                                ),
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                {(['certifications', 'training'] as const).map((group) => (
                  <fieldset className="shared-choice-list" key={group}>
                    <legend>
                      {group === 'certifications'
                        ? 'Selected owner awards'
                        : 'Selected owner training'}{' '}
                      ({catalog[group].length})
                    </legend>
                    {catalog[group].length === 0 && (
                      <p>No available owner evidence.</p>
                    )}
                    {catalog[group].map((option) => {
                      const key =
                          group === 'certifications'
                            ? 'certificationIds'
                            : 'trainingIds',
                        selected = input.profile![key];
                      return (
                        <label key={option.id}>
                          <input
                            type="checkbox"
                            checked={selected.includes(option.id)}
                            onChange={(event) =>
                              changeProfile({
                                [key]: event.target.checked
                                  ? [...selected, option.id]
                                  : selected.filter((id) => id !== option.id),
                              })
                            }
                          />
                          {option.title} {option.agency && `· ${option.agency}`}
                        </label>
                      );
                    })}
                  </fieldset>
                ))}
              </>
            )}
            {input.gasPlan && (
              <>
                <label>
                  Saved Gas Plan
                  <select
                    value={input.gasPlan.recordId}
                    onChange={(event) =>
                      change({
                        ...input,
                        gasPlan: {
                          ...input.gasPlan!,
                          recordId: event.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Choose an exact saved plan</option>
                    {catalog.plans.map((plan) => (
                      <option value={plan.id} key={plan.id}>
                        {plan.title}
                      </option>
                    ))}
                  </select>
                </label>
                {(['inputs', 'supplies', 'outputs'] as const).map((key) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={input.gasPlan![key]}
                      onChange={(event) =>
                        change({
                          ...input,
                          gasPlan: {
                            ...input.gasPlan!,
                            [key]: event.target.checked,
                          },
                        })
                      }
                    />
                    {key === 'inputs'
                      ? 'Selected planning inputs'
                      : key === 'supplies'
                        ? 'Individual supplies and selected contingency results'
                        : 'Saved outputs, reserve phases and model provenance'}
                  </label>
                ))}
                <p>
                  Only saved supported values are included. No calculations are
                  rerun, and missing evidence remains unavailable.
                </p>
              </>
            )}
            <fieldset>
              <legend>Expiry</legend>
              <label>
                <input
                  type="checkbox"
                  checked={input.expiresAt === null}
                  onChange={(event) =>
                    change({
                      ...input,
                      expiresAt: event.target.checked
                        ? null
                        : new Date(Date.now() + 7 * 86400000).toISOString(),
                    })
                  }
                />{' '}
                Explicitly choose no expiry
              </label>
              {input.expiresAt !== null && (
                <label>
                  Expires at (your local time)
                  <input
                    type="datetime-local"
                    value={dateInput(input.expiresAt)}
                    onChange={(event) => {
                      if (
                        event.target.value &&
                        Number.isFinite(new Date(event.target.value).valueOf())
                      )
                        change({
                          ...input,
                          expiresAt: new Date(event.target.value).toISOString(),
                        });
                    }}
                  />
                </label>
              )}
            </fieldset>
            <fieldset>
              <legend>
                Individually selected attachments ({input.attachmentIds.length}
                /5)
              </legend>
              <p>
                Image/PDF contents may include information excluded from text.
                Inspect every selected image and every PDF page before
                approving.
              </p>
              <label>
                Attachment display label
                <input
                  maxLength={100}
                  value={assetLabel}
                  onChange={(event) => setAssetLabel(event.target.value)}
                />
              </label>
              <label>
                Prepare a separate attachment
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  disabled={Boolean(catalog.attachmentLimitReached)}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file);
                    event.target.value = '';
                  }}
                />
              </label>
              <p>
                Images are resized and metadata stripped. Static PDFs: up to 2
                MB / 20 pages; encrypted, interactive, signed, layered,
                rotated/cropped and compressed-object PDFs are rejected. Export
                a plain static PDF when needed.
              </p>
              <div className="shared-choice-list">
                {catalog.attachments.map((asset) => (
                  <label key={asset.id}>
                    <input
                      type="checkbox"
                      checked={input.attachmentIds.includes(asset.id)}
                      disabled={
                        !input.attachmentIds.includes(asset.id) &&
                        input.attachmentIds.length >= 5
                      }
                      onChange={(event) =>
                        change({
                          ...input,
                          attachmentIds: event.target.checked
                            ? [...input.attachmentIds, asset.id]
                            : input.attachmentIds.filter(
                                (id) => id !== asset.id,
                              ),
                        })
                      }
                    />
                    {asset.label} ·{' '}
                    {asset.contentType === 'application/pdf' ? 'PDF' : 'Image'}
                  </label>
                ))}
              </div>
            </fieldset>
          </fieldset>
          <div className="record-actions">
            <button
              type="button"
              className="focus-secondary"
              disabled={busy}
              onClick={() => void action('preview')}
            >
              Preview exact shared snapshot
            </button>
            <button
              type="button"
              className="focus-secondary"
              disabled={busy}
              onClick={newLink}
            >
              New private selection
            </button>
          </div>
          {preview && (
            <div
              ref={previewRef}
              tabIndex={-1}
              className="sharing-visitor-preview"
              aria-label="Exact shared visitor preview"
            >
              <SharedSnapshotView
                snapshot={preview.snapshot}
                ownerPreview
                onAssetsReady={onReady}
              />
              <div className="shared-publication-actions">
                <label>
                  <input
                    type="checkbox"
                    checked={approved}
                    disabled={busy || !ready}
                    onChange={(event) => setApproved(event.target.checked)}
                  />{' '}
                  I reviewed and approve this exact text and all selected
                  attachment content for anyone with the link.
                </label>
                <button
                  type="button"
                  className="focus-primary"
                  disabled={busy || !ready || !approved}
                  onClick={() => void action(editing ? 'replace' : 'create')}
                >
                  {editing
                    ? 'Replace approved snapshot'
                    : 'Publish approved shared snapshot'}
                </button>
              </div>
            </div>
          )}
          {copyLink && (
            <div className="integration-key-once">
              <p>
                Copy this link now. It is shown once and cannot be recovered
                from the stored hash.
              </p>
              <label>
                New shared link
                <input
                  readOnly
                  value={copyLink}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <div className="record-actions">
                <button
                  type="button"
                  className="focus-secondary"
                  onClick={() => void copy()}
                >
                  Copy shared link
                </button>
                <a
                  className="focus-secondary"
                  href={copyLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open visitor preview
                </a>
              </div>
            </div>
          )}
          <section className="sharing-resource">
            <h3>Saved Shared Links</h3>
            <p>
              Snapshot mode · anyone with link. Regeneration invalidates the
              previous link. Revocation also blocks its selected files.
            </p>
            {links.length === 0 && <p>No saved links on this page.</p>}
            {links.map((link) => (
              <article className="sharing-resource" key={link.id}>
                <h4>{link.label}</h4>
                <p>
                  {link.kind === 'profile' ? 'Diver Profile' : 'Gas Plan'} ·{' '}
                  {link.enabled
                    ? link.expired
                      ? 'Expired'
                      : 'Published'
                    : 'Revoked'}{' '}
                  · revision {link.revision} ·{' '}
                  {link.expiresAt
                    ? `expires ${new Date(link.expiresAt).toLocaleString('en-GB')}`
                    : 'no expiry'}
                </p>
                <div className="record-actions">
                  <button
                    type="button"
                    className="focus-secondary"
                    disabled={busy}
                    onClick={() => {
                      setPreview(null);
                      setSavedPreview(link.snapshot);
                    }}
                  >
                    Review stored snapshot: {link.label}
                  </button>
                  <button
                    type="button"
                    className="focus-secondary"
                    disabled={busy}
                    onClick={() => edit(link)}
                  >
                    {link.enabled ? 'Edit selection' : 'Reuse selection'}:{' '}
                    {link.label}
                  </button>
                  {link.enabled && !link.expired && (
                    <button
                      type="button"
                      className="focus-secondary"
                      disabled={busy}
                      onClick={() =>
                        setConfirmation({ kind: 'regenerate', link })
                      }
                    >
                      Regenerate link: {link.label}
                    </button>
                  )}
                  {link.enabled && (
                    <button
                      type="button"
                      className="focus-secondary"
                      disabled={busy}
                      onClick={() => setConfirmation({ kind: 'revoke', link })}
                    >
                      Revoke link: {link.label}
                    </button>
                  )}
                </div>
              </article>
            ))}
            <nav aria-label="Shared Links pages" className="record-actions">
              <button
                type="button"
                className="focus-secondary"
                disabled={busy || offset === 0}
                onClick={() => {
                  setBusy(true);
                  void load(Math.max(0, offset - 25))
                    .catch(() => setMessage('Link page unavailable.'))
                    .finally(() => setBusy(false));
                }}
              >
                Previous links
              </button>
              <span>Page {offset / 25 + 1}</span>
              <button
                type="button"
                className="focus-secondary"
                disabled={busy || !more}
                onClick={() => {
                  setBusy(true);
                  void load(offset + 25)
                    .catch(() => setMessage('Link page unavailable.'))
                    .finally(() => setBusy(false));
                }}
              >
                Next links
              </button>
            </nav>
          </section>
          {savedPreview && (
            <div
              className="sharing-visitor-preview"
              aria-label="Stored snapshot review"
            >
              <button
                type="button"
                className="focus-secondary"
                onClick={() => setSavedPreview(null)}
              >
                Close stored snapshot
              </button>
              <SharedSnapshotView snapshot={savedPreview} ownerPreview />
            </div>
          )}
        </>
      )}
    </section>
  );
}
