'use client';
import {
  CheckCircle2,
  Cloud,
  Database,
  Download,
  ImagePlus,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  checkDiveCloud,
  createDiveBackup,
  restoreDiveBackup,
} from '@/lib/offline/cloud-platform';
import { zeustekDb } from '@/lib/offline/db';
import {
  deleteCatalogOption,
  DEFAULT_GEAR_CATEGORIES,
  DEFAULT_TRAINING_AGENCIES,
  agencyLogoSource,
  equipmentIconSource,
  listCatalogOptions,
  saveCatalogOption,
  type CatalogOptionRecord,
  type Stored,
} from '@/lib/offline/dive-planning';

export function PlatformHeaderStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return (
    <section className="header-status" aria-label="Dive data status">
      <span className={online ? 'good' : 'warn'}>
        {online ? <Wifi size={14} /> : <WifiOff size={14} />}
        <b>{online ? 'Online' : 'Offline'}</b>
      </span>
      <span title="Dive data is stored in your private hosted account">
        <Cloud size={14} />
        <b>Cloud account</b>
      </span>
      <span title="Available anywhere you sign in">
        <Database size={14} />
        <b>All devices</b>
      </span>
    </section>
  );
}

export function SyncCentre() {
  const [checking, setChecking] = useState(false);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');
  async function check() {
    setChecking(true);
    setError('');
    try {
      setCounts(await checkDiveCloud());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cloud check failed');
    } finally {
      setChecking(false);
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">YOUR ACCOUNT · ALL DEVICES</span>
          <h1>Sync</h1>
          <p>
            Your ZEUSTEK records save automatically. PADI can be pulled in
            separately below.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => void check()}
          disabled={checking}
        >
          <RefreshCw size={15} />
          {checking ? 'Checking…' : 'Check ZEUSTEK cloud'}
        </button>
      </div>
      <section className="panel platform-panel">
        <div className="panel-row">
          <div>
            <strong>Private cloud account</strong>
            <span>
              {error || counts
                ? 'Connected to the account you used to open this site.'
                : 'Press Check ZEUSTEK cloud to confirm the connection.'}
            </span>
          </div>
          <span className={`status-pill ${counts ? 'success' : ''}`}>
            {error ? 'UNAVAILABLE' : counts ? 'CONNECTED' : 'READY'}
          </span>
        </div>
        <div className="panel-row">
          <div>
            <strong>Cloud records</strong>
            <span>
              {counts
                ? `${counts.dive} dives · ${counts.equipment} equipment items · ${counts.site} sites · ${counts.trip} trips`
                : 'Counts appear after a cloud check.'}
            </span>
          </div>
          <span className="status-pill success">AUTO-SAVED</span>
        </div>
        <div className="panel-row">
          <div>
            <strong>Across devices</strong>
            <span>
              Sign in on PC, iPhone or iPad and the same records load from the
              hosted database.
            </span>
          </div>
          <span className="status-pill success">ENABLED</span>
        </div>
      </section>
      <PadiSyncPanel onSynced={() => void check()} />
    </>
  );
}

function PadiSyncPanel({ onSynced }: { onSynced: () => void }) {
  const [advanced, setAdvanced] = useState(false);
  const [affiliateId, setAffiliateId] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function sync() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/padi-sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ affiliateId, accessToken: token }),
      });
      const result = (await response.json()) as {
        total?: number;
        added?: number;
        updated?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || 'PADI sync failed');
      setMessage(
        `${result.total ?? 0} dives synced · ${result.added ?? 0} new · ${result.updated ?? 0} updated`,
      );
      setToken('');
      onSynced();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PADI sync failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel padi-sync">
      <div>
        <span className="eyebrow">PADI WEB LOGBOOK</span>
        <h2>Bring in your PADI dives</h2>
        <p>
          Use captured JSON now, a password-free browser companion when
          available, or the advanced temporary-token method.
        </p>
      </div>
      <div className="panel-row">
        <div>
          <strong>Recommended: JSON import</strong>
          <span>
            Use Imports to add the PADI logbook JSON from your own session.
            Re-importing updates without duplicates.
          </span>
        </div>
        <span className="status-pill success">AVAILABLE</span>
      </div>
      <div className="panel-row">
        <div>
          <strong>Password-free companion</strong>
          <span>
            Captures only logbook responses from a PADI tab where you are
            already signed in; it never sees your password.
          </span>
        </div>
        <span className="status-pill">PLANNED</span>
      </div>
      <button
        className="secondary"
        onClick={() => setAdvanced((value) => !value)}
      >
        {advanced ? 'Hide' : 'Show'} advanced manual connection
      </button>
      {advanced && (
        <div className="padi-fields">
          <label>
            PADI affiliate ID
            <input
              inputMode="numeric"
              value={affiliateId}
              onChange={(e) =>
                setAffiliateId(e.target.value.replace(/\D/g, ''))
              }
            />
          </label>
          <label>
            Temporary PADI access token
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={busy || !affiliateId || token.length < 20}
            onClick={() => void sync()}
          >
            <RefreshCw size={15} />
            {busy ? 'Syncing…' : 'Sync with temporary token'}
          </button>
        </div>
      )}
      <div className="padi-actions">
        <a
          className="secondary"
          href="https://learning.padi.com/logbook"
          target="_blank"
          rel="noreferrer"
        >
          Open PADI logbook
        </a>
      </div>
      <small className="padi-help">
        ZEUSTEK never stores the temporary access token. Do not enter your PADI
        username or password here.
      </small>
      {message && (
        <output className="platform-notice success">
          <CheckCircle2 size={16} />
          {message}
        </output>
      )}
      {error && <p className="platform-notice error">{error}</p>}
    </section>
  );
}

export function BackupsScreen() {
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState('');
  const [progress, setProgress] = useState<{processed:number;total:number}|null>(null);
  useEffect(() => { const report = (event: Event) => setProgress((event as CustomEvent).detail); window.addEventListener('zeustek-backup-progress',report); return () => window.removeEventListener('zeustek-backup-progress',report); }, []);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  async function download() {
    if (busy) return; setOperation('Exporting backup…'); setMessage(''); setProgress(null);
    setBusy(true);
    setError('');
    try {
      const blob = await createDiveBackup(passphrase);
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(blob);
      anchor.download = `zeustek-dive-${new Date().toISOString().slice(0, 10)}.zdb`;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
      setMessage(
        'Encrypted backup downloaded. ' + (JSON.parse(await blob.text()) as {coverage:string}).coverage,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Backup failed');
    } finally {
      setBusy(false);
    }
  }
  async function restore(file: File | undefined) {
    if (!file || busy) return;
    if (
      !window.confirm(
        'Restore missing records from this backup? Existing differences will be preserved for review.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      setOperation('Restoring backup…'); setMessage(''); setProgress(null);
      const result = await restoreDiveBackup(file, passphrase);
      setMessage(`${result.restored} records restored; ${result.skipped} unchanged; ${result.conflicts} differences retained for review.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Restore failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">LOCAL + CLOUD · ENCRYPTED</span>
          <h1>Backups</h1>
          <p>
            Download a passphrase-encrypted copy of your available dive data and local changes for this
            account.
          </p>
        </div>
      </div>
      <section className="backup-grid">
        <section className="panel backup-action">
          <Download size={25} />
          <div>
            <span className="eyebrow">CREATE BACKUP</span>
            <h3>Download dive data</h3>
            <p>
              Includes local records, history and locally stored images, plus available cloud records for your
              account. Cloud-only gallery media and server connection credentials are excluded. Reconnect the Dive News mailbox after restoration. The download reports its exact coverage.
            </p>
          </div>
          <label>
            <KeyRound size={14} />
            <input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Backup passphrase (8+ characters)"
            />
          </label>
          <button
            className="primary"
            disabled={busy || passphrase.length < 8}
            onClick={() => void download()}
          >
            <Download size={15} />
            {busy ? operation : 'Download backup'}
          </button>
        </section>
        <section className="panel backup-action">
          <Upload size={25} />
          <div>
            <span className="eyebrow">RESTORE</span>
            <h3>Restore missing records</h3>
            <p>
              Decrypts and validates before restoring missing records. Existing differences are kept for review in your
              account.
            </p>
          </div>
          <button
            className="secondary"
            disabled={busy || !passphrase}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={15} />
            Choose .zdb backup
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".zdb,application/json"
            onChange={(event) => void restore(event.target.files?.[0])}
          />
        </section>
      </section>
      <div role="status" aria-live="polite">{busy && <><p>{operation}</p><progress aria-label={operation} max={progress?.total || undefined} value={progress ? progress.processed : undefined}/></>}</div>{message && (
        <p className="platform-notice success">
          <CheckCircle2 size={16} />
          {message}
        </p>
      )}
      {error && <p className="platform-notice error">{error}</p>}
    </>
  );
}

export function PlatformSettings({section='overview'}:{section?:'overview'|'lists'|'icons'|'logos'}) {
  const [message, setMessage] = useState('');
  const [options, setOptions] = useState<Array<Stored<CatalogOptionRecord>>>(
    [],
  );
  const [group, setGroup] = useState<
    Exclude<CatalogOptionRecord['group'], 'equipment-icon' | 'agency-logo'>
  >('agency');
  const [value, setValue] = useState('');
  const [iconBusy, setIconBusy] = useState('');
  const [agencyLogoBusy, setAgencyLogoBusy] = useState('');
  const [agencyLogoUrls, setAgencyLogoUrls] = useState<Record<string, string>>(
    {},
  );
  const refreshOptions = () => {
    void listCatalogOptions().then(setOptions);
  };
  useEffect(refreshOptions, []);
  async function addOption() {
    const clean = value.trim();
    if (!clean) return;
    if (
      options.some(
        (option) =>
          option.group === group &&
          option.value.toLowerCase() === clean.toLowerCase(),
      )
    ) {
      setMessage('That option already exists.');
      return;
    }
    await saveCatalogOption({ group, value: clean });
    setValue('');
    setMessage(`${clean} added to the ${group} list.`);
    refreshOptions();
  }
  async function removeOption(option: Stored<CatalogOptionRecord>) {
    if (option.group === 'category' || option.group === 'agency') {
      const mappingGroup =
        option.group === 'category' ? 'equipment-icon' : 'agency-logo';
      const mapping = options.find(
        (candidate) =>
          candidate.group === mappingGroup &&
          candidate.value.toLowerCase() === option.value.toLowerCase(),
      );
      if (mapping) {
        if (mapping.iconMediaId)
          await fetch(`/api/media?id=${encodeURIComponent(mapping.iconMediaId)}`, {
            method: 'DELETE',
          });
        await deleteCatalogOption(mapping.entityId);
      }
    }
    await deleteCatalogOption(option.entityId);
    setMessage(`${option.value} removed from your custom list.`);
    refreshOptions();
  }
  const equipmentCategories = [
    ...new Set([
      ...DEFAULT_GEAR_CATEGORIES,
      ...options
        .filter((option) => option.group === 'category')
        .map((option) => option.value),
    ]),
  ].sort();
  const trainingAgencies = [
    ...new Set([
      ...DEFAULT_TRAINING_AGENCIES,
      ...options
        .filter((option) => option.group === 'agency')
        .map((option) => option.value),
    ]),
  ].sort();
  async function setEquipmentIcon(category: string, file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Choose an image file for the equipment icon.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setMessage('Equipment icon images must be under 12 MB.');
      return;
    }
    setIconBusy(category);
    setMessage(`Uploading the ${category} icon…`);
    try {
      const existing = options.find(
        (option) =>
          option.group === 'equipment-icon' &&
          option.value.toLowerCase() === category.toLowerCase(),
      );
      const form = new FormData();
      form.append('file', file);
      form.append('ownerKind', 'equipment-icon');
      form.append('ownerId', category);
      form.append('caption', `${category} equipment icon`);
      const response = await fetch('/api/media', { method: 'POST', body: form });
      if (!response.ok) throw new Error('Upload failed');
      const uploaded = (await response.json()) as { id: string };
      await saveCatalogOption({
        ...(existing ? { entityId: existing.entityId } : {}),
        group: 'equipment-icon',
        value: category,
        iconMediaId: uploaded.id,
      });
      if (existing?.iconMediaId)
        await fetch(`/api/media?id=${encodeURIComponent(existing.iconMediaId)}`, {
          method: 'DELETE',
        });
      setMessage(`${category} now uses your custom icon.`);
      refreshOptions();
    } catch {
      setMessage('The icon could not be saved. Please try another image.');
    } finally {
      setIconBusy('');
    }
  }
  async function resetEquipmentIcon(category: string) {
    const existing = options.find(
      (option) =>
        option.group === 'equipment-icon' &&
        option.value.toLowerCase() === category.toLowerCase(),
    );
    if (!existing) return;
    await deleteCatalogOption(existing.entityId);
    if (existing.iconMediaId)
      await fetch(`/api/media?id=${encodeURIComponent(existing.iconMediaId)}`, {
        method: 'DELETE',
      });
    setMessage(`${category} restored to its built-in icon.`);
    refreshOptions();
  }
  function agencyLogoMapping(agency: string) {
    return options.find(
      (option) =>
        option.group === 'agency-logo' &&
        option.value.toLowerCase() === agency.toLowerCase(),
    );
  }
  async function uploadAgencyLogo(agency: string, file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 12 * 1024 * 1024) {
      setMessage('Choose an image under 12 MB for the agency logo.');
      return;
    }
    setAgencyLogoBusy(agency);
    setMessage(`Uploading the ${agency} logo…`);
    try {
      const existing = agencyLogoMapping(agency);
      const form = new FormData();
      form.append('file', file);
      form.append('ownerKind', 'agency-logo');
      form.append('ownerId', agency);
      form.append('caption', `${agency} training agency logo`);
      const response = await fetch('/api/media', { method: 'POST', body: form });
      if (!response.ok) throw new Error('Upload failed');
      const uploaded = (await response.json()) as { id: string };
      await saveCatalogOption({
        ...(existing ? { entityId: existing.entityId } : {}),
        group: 'agency-logo',
        value: agency,
        iconMediaId: uploaded.id,
      });
      if (existing?.iconMediaId)
        await fetch(`/api/media?id=${encodeURIComponent(existing.iconMediaId)}`, {
          method: 'DELETE',
        });
      setMessage(`${agency} now uses the uploaded logo.`);
      refreshOptions();
    } catch {
      setMessage('The agency logo could not be saved. Please try again.');
    } finally {
      setAgencyLogoBusy('');
    }
  }
  async function saveAgencyLogoUrl(agency: string) {
    const url = (agencyLogoUrls[agency] ?? agencyLogoMapping(agency)?.iconUrl ?? '')
      .trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      setMessage('Enter a full http:// or https:// image URL.');
      return;
    }
    setAgencyLogoBusy(agency);
    const existing = agencyLogoMapping(agency);
    try {
      await saveCatalogOption({
        ...(existing ? { entityId: existing.entityId } : {}),
        group: 'agency-logo',
        value: agency,
        iconUrl: url,
      });
      if (existing?.iconMediaId)
        await fetch(`/api/media?id=${encodeURIComponent(existing.iconMediaId)}`, {
          method: 'DELETE',
        });
      setAgencyLogoUrls((current) => ({ ...current, [agency]: url }));
      setMessage(`${agency} now uses the linked logo.`);
      refreshOptions();
    } catch {
      setMessage('The agency logo URL could not be saved.');
    } finally {
      setAgencyLogoBusy('');
    }
  }
  async function resetAgencyLogo(agency: string) {
    const existing = agencyLogoMapping(agency);
    if (!existing) return;
    await deleteCatalogOption(existing.entityId);
    if (existing.iconMediaId)
      await fetch(`/api/media?id=${encodeURIComponent(existing.iconMediaId)}`, {
        method: 'DELETE',
      });
    setAgencyLogoUrls((current) => ({ ...current, [agency]: '' }));
    setMessage(`${agency} restored to its initials.`);
    refreshOptions();
  }
  async function clear() {
    if (
      !window.confirm(
        'Clear old temporary dive data from this device? Hosted records will not be deleted.',
      )
    )
      return;
    await zeustekDb.delete();
    await zeustekDb.open();
    setMessage('Temporary device data cleared. Hosted dive data is unchanged.');
  }
  return (
    <>
      {section==='overview' && <div className="page-head">
        <div>
          <span className="eyebrow">PLAIN-LANGUAGE CONTROLS</span>
          <h1>Site Configuration</h1>
          <p>See where your data lives and what this device stores.</p>
        </div>
      </div>}
      {section==='overview' && <section id="settings-overview-details" className="panel platform-panel">
        <div className="panel-row">
          <div>
            <strong>Where dive data is saved</strong>
            <span>The main copy is in your private hosted account.</span>
          </div>
          <span className="status-pill success">CLOUD</span>
        </div>
        <div className="panel-row">
          <div>
            <strong>Who can see it</strong>
            <span>
              Only the owner account currently allowed into this private site.
            </span>
          </div>
          <span className="status-pill success">ONLY YOU</span>
        </div>
        <div className="panel-row">
          <div>
            <strong>Using another device</strong>
            <span>
              Open this site and sign in; the same dives, kit, sites and trips
              load automatically.
            </span>
          </div>
          <span className="status-pill success">READY</span>
        </div>
        <div className="panel-row">
          <div>
            <strong>Clear this device</strong>
            <span>
              Removes old temporary browser data. Hosted records remain
              untouched.
            </span>
          </div>
          <button className="secondary" onClick={() => void clear()}>
            <Trash2 size={15} />
            Clear cache
          </button>
        </div>
      </section>}
      {section==='lists' && <section id="equipment-training-lists-details" className="panel option-settings">
        <div>
          <span className="eyebrow">CONTROLLED LISTS</span>
          <h2>Equipment & training choices</h2>
          <p>
            Add new agencies, qualifications, equipment categories and
            manufacturers once. They then appear consistently in every dropdown.
          </p>
        </div>
        <div className="option-add">
          <label>
            List
            <select
              value={group}
              onChange={(event) =>
                setGroup(
                  event.target.value as Exclude<
                    CatalogOptionRecord['group'],
                    'equipment-icon' | 'agency-logo'
                  >,
                )
              }
            >
              <option value="agency">Training agencies</option>
              <option value="qualification">Dive qualifications</option>
              <option value="category">Equipment categories</option>
              <option value="manufacturer">Equipment manufacturers</option>
            </select>
          </label>
          <label>
            New option
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={
                group === 'agency'
                  ? 'e.g. PSAI'
                  : group === 'qualification'
                    ? 'e.g. Advanced Nitrox Diver'
                  : group === 'category'
                    ? 'e.g. DPV / scooter'
                    : 'e.g. Santi'
              }
            />
          </label>
          <button className="primary" onClick={() => void addOption()}>
            Add to list
          </button>
        </div>
        <div className="option-groups">
          {(['agency', 'qualification', 'category', 'manufacturer'] as const).map(
            (optionGroup) => (
              <div key={optionGroup}>
                <strong>
                  {optionGroup === 'agency'
                    ? 'Training agencies'
                    : optionGroup === 'qualification'
                      ? 'Dive qualifications'
                    : optionGroup === 'category'
                      ? 'Equipment categories'
                      : 'Manufacturers'}
                </strong>
                {options.filter((option) => option.group === optionGroup)
                  .length ? (
                  options
                    .filter((option) => option.group === optionGroup)
                    .map((option) => (
                      <span key={option.entityId}>
                        {option.value}
                        <button
                          onClick={() => void removeOption(option)}
                          aria-label={`Remove ${option.value}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    ))
                ) : (
                  <small>No custom additions yet.</small>
                )}
              </div>
            ),
          )}
        </div>
        <small className="padi-help">
          The standard scuba lists remain available; your additions are stored
          in your private cloud account and appear on every device.
        </small>
      </section>}
      {section==='icons' && <section id="equipment-category-icons-details" className="panel equipment-icon-settings">
        <div>
          <span className="eyebrow">EQUIPMENT APPEARANCE</span>
          <h2>Equipment category icons</h2>
          <p>
            Each category has a built-in visual icon. Upload your own image at
            any time; equipment cards using that category update automatically.
          </p>
        </div>
        <div className="equipment-icon-settings-grid">
          {equipmentCategories.map((category) => {
            const custom = options.find(
              (option) =>
                option.group === 'equipment-icon' &&
                option.value.toLowerCase() === category.toLowerCase(),
            );
            return (
              <article key={category}>
                <img src={equipmentIconSource(category, options)} alt="" />
                <div>
                  <strong>{category}</strong>
                  <small>{custom ? 'Custom image' : 'Built-in image'}</small>
                </div>
                <label className="equipment-icon-upload">
                  <ImagePlus size={15} />
                  {iconBusy === category ? 'Uploading…' : 'Change'}
                  <input
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={Boolean(iconBusy)}
                    onChange={(event) => {
                      void setEquipmentIcon(category, event.target.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {custom && (
                  <button
                    className="equipment-icon-reset"
                    onClick={() => void resetEquipmentIcon(category)}
                    aria-label={`Restore the built-in ${category} icon`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </article>
            );
          })}
        </div>
        <small className="padi-help">
          Add a new equipment category above and it will appear here with a
          neutral icon ready for your own image.
        </small>
      </section>}
      {section==='logos' && <section id="training-agency-logos-details" className="panel agency-logo-settings">
        <div>
          <span className="eyebrow">TRAINING APPEARANCE</span>
          <h2>Training agency logos</h2>
          <p>
            Upload a logo or link to a public image URL. Training cards use the
            agency initials whenever no image is set or a linked image fails.
          </p>
        </div>
        <div className="agency-logo-settings-grid">
          {trainingAgencies.map((agency) => {
            const mapping = agencyLogoMapping(agency);
            const source = agencyLogoSource(agency, options);
            const initials = agency
              .split(/[^a-zA-Z0-9]+/)
              .filter(Boolean)
              .map((part) => part[0])
              .join('')
              .slice(0, 4)
              .toUpperCase();
            return (
              <article key={agency}>
                <span className="agency-logo-preview">
                  <b>{initials || '—'}</b>
                  {source && (
                    <img
                      src={source}
                      alt={`${agency} logo`}
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </span>
                <div className="agency-logo-name">
                  <strong>{agency}</strong>
                  <small>
                    {mapping?.iconMediaId
                      ? 'Uploaded logo'
                      : mapping?.iconUrl
                        ? 'Linked logo'
                        : 'Initials fallback'}
                  </small>
                </div>
                <div className="agency-logo-url">
                  <input
                    type="url"
                    value={agencyLogoUrls[agency] ?? mapping?.iconUrl ?? ''}
                    onChange={(event) =>
                      setAgencyLogoUrls((current) => ({
                        ...current,
                        [agency]: event.target.value,
                      }))
                    }
                    placeholder="https://example.com/logo.png"
                    aria-label={`${agency} logo image URL`}
                  />
                  <button
                    className="focus-secondary"
                    disabled={Boolean(agencyLogoBusy)}
                    onClick={() => void saveAgencyLogoUrl(agency)}
                  >
                    Save URL
                  </button>
                </div>
                <div className="agency-logo-actions">
                  <label className="equipment-icon-upload">
                    <ImagePlus size={15} />
                    {agencyLogoBusy === agency ? 'Uploading…' : 'Upload image'}
                    <input
                      hidden
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      disabled={Boolean(agencyLogoBusy)}
                      onChange={(event) => {
                        void uploadAgencyLogo(agency, event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {mapping && (
                    <button
                      className="equipment-icon-reset"
                      onClick={() => void resetAgencyLogo(agency)}
                      aria-label={`Remove the ${agency} logo`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <small className="padi-help">
          Custom agencies added above appear here automatically.
        </small>
      </section>}
      {message && (
        <p className="platform-notice success">
          <ShieldCheck size={16} />
          {message}
        </p>
      )}
    </>
  );
}

