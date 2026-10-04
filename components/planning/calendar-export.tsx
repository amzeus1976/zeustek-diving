'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildCalendarPreview, CALENDAR_CATEGORIES, DEFAULT_CALENDAR_OPTIONS, type CalendarCategory, type CalendarEvent, type CalendarExportOptions, type CalendarPreview, type CalendarSourceSnapshot } from '../../lib/calendar/calendar-model';
import { prepareCalendarDownload, type CalendarRevisionManifest } from '../../lib/calendar/calendar-revisions';
import { calendarDeliverySourceMatches, deliverCurrentCalendar } from '../../lib/calendar/calendar-download-boundary';
import { currentDiveAccount } from '../../lib/offline/dive-store';
import styles from './calendar-export.module.css';

type Go = ((destination: string) => void) | undefined;
export interface CalendarExportProps {
  snapshot: CalendarSourceSnapshot;
  revisionManifest?: CalendarRevisionManifest | undefined;
  onDownloadManifest: (manifest: CalendarRevisionManifest) => Promise<void>;
  go?: Go;
}

function SourceLink({ destination, go }: { destination: string; go?: Go }) {
  return <a className="focus-link" href={`/${destination}`} onClick={go ? event => { event.preventDefault(); go(destination); } : undefined}>Review source</a>;
}

export function CalendarPreviewList({ events, selectedEventKeys, onToggle, go }: {
  events: readonly CalendarEvent[]; selectedEventKeys: readonly string[] | null; onToggle: (uid: string) => void; go?: Go;
}) {
  const selected = selectedEventKeys === null ? null : new Set(selectedEventKeys);
  return <ul className={styles.eventList}>{events.map(event => <li key={event.uid} className={styles.event}>
    <label className={styles.eventChoice}><input type="checkbox" checked={selected === null || selected.has(event.uid)} onChange={() => onToggle(event.uid)} aria-label={`Select calendar event ${event.summary}, ${event.dateLabel}`} /><span><strong>{event.summary}</strong><span>{event.dateLabel}</span><small>{CALENDAR_CATEGORIES.find(([key]) => key === event.category)?.[1]} · {event.status.toLowerCase()}</small></span></label>
    {event.location && <p>Location: {event.location}</p>}
    <p className={styles.provenance}>{event.description}</p>
    {event.url && <p className={styles.provenance}>Exported source link: {event.url}</p>}
    <SourceLink destination={event.reviewDestination} go={go} />
  </li>)}</ul>;
}

function PageControls({ page, total, change, label }: { page: number; total: number; change: (next: number) => void; label: string }) {
  const pages = Math.max(1, Math.ceil(total / 25));
  return <div className={styles.pager} aria-label={`${label} pages`}>
    <button className="focus-secondary" disabled={page === 0} onClick={() => change(page - 1)} aria-label={`Previous ${label} page`}>Previous</button>
    <output>{total ? page * 25 + 1 : 0}–{Math.min((page + 1) * 25, total)} of {total}</output>
    <button className="focus-secondary" disabled={page + 1 >= pages} onClick={() => change(page + 1)} aria-label={`Next ${label} page`}>Next</button>
  </div>;
}

interface Prepared {
  snapshot: CalendarSourceSnapshot; options: CalendarExportOptions; selection: readonly string[] | null;
  priorManifest: CalendarRevisionManifest | undefined; candidates: CalendarEvent[]; preview: CalendarPreview;
  content: string; manifest: CalendarRevisionManifest;
}

/** Data inspection and preview are pure; only the explicit download persists delivery metadata. */
export function CalendarExport({ snapshot, revisionManifest, onDownloadManifest, go }: CalendarExportProps) {
  const [options, setOptions] = useState<CalendarExportOptions>(() => ({ ...DEFAULT_CALENDAR_OPTIONS, categories: [...DEFAULT_CALENDAR_OPTIONS.categories], fields: { ...DEFAULT_CALENDAR_OPTIONS.fields } }));
  const [selection, setSelection] = useState<readonly string[] | null>(null);
  const [localManifest, setLocalManifest] = useState<{ accountId: string; manifest: CalendarRevisionManifest } | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [preparationError, setPreparationError] = useState<Pick<Prepared, 'snapshot' | 'options' | 'selection' | 'priorManifest'> | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [eventPage, setEventPage] = useState(0), [omissionPage, setOmissionPage] = useState(0);
  const [query, setQuery] = useState('');
  const priorManifest = revisionManifest ?? (localManifest?.accountId === snapshot.accountId ? localManifest.manifest : undefined);
  const deliveryState = useRef({ mounted: true, version: 0 });
  const [invalidatedSource, setInvalidatedSource] = useState<CalendarSourceSnapshot | null>(null);
  const latestInputs = useRef({ snapshot, options, selection, priorManifest });
  useLayoutEffect(() => { latestInputs.current = { snapshot, options, selection, priorManifest }; }, [snapshot, options, selection, priorManifest]);

  useEffect(() => {
    const state = deliveryState.current;
    state.mounted = true;
    const invalidate = () => {
      state.version++;
      setInvalidatedSource(latestInputs.current.snapshot);
      setBusy(false);
      setMessage('Records changed. Refresh the calendar preview before downloading.');
    };
    window.addEventListener('zeustek-records-updated', invalidate);
    return () => { state.mounted = false; state.version++; window.removeEventListener('zeustek-records-updated', invalidate); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sourceOrigin = options.fields?.sourceLink ? window.location.origin : undefined;
    const projectionOptions = { ...options, ...(sourceOrigin ? { sourceOrigin } : {}) };
    void (async () => {
      const result = await buildCalendarPreview(snapshot, projectionOptions);
      const selected = selection === null ? result.events : result.events.filter(event => selection.includes(event.uid));
      const preview = { ...result, events: selected };
      const download = await prepareCalendarDownload(preview, priorManifest, new Date().toISOString());
      if (!cancelled) { setPreparationError(null); setPrepared({ snapshot, options, selection, priorManifest, candidates: result.events, preview, ...download }); }
    })().catch(() => {
      if (!cancelled) { setPrepared(null); setPreparationError({ snapshot, options, selection, priorManifest }); }
    });
    return () => { cancelled = true; };
  }, [snapshot, options, selection, priorManifest]);

  const currentError = preparationError?.snapshot === snapshot && preparationError.options === options && preparationError.selection === selection && preparationError.priorManifest === priorManifest;
  const ready = invalidatedSource !== snapshot && prepared?.snapshot === snapshot && prepared.options === options && prepared.selection === selection && prepared.priorManifest === priorManifest;
  const filteredCandidates = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('en-GB');
    return (prepared?.candidates ?? []).filter(event => !term || `${event.summary} ${event.location ?? ''} ${event.dateLabel}`.toLocaleLowerCase('en-GB').includes(term));
  }, [prepared, query]);
  const page = Math.min(eventPage, Math.max(0, Math.ceil(filteredCandidates.length / 25) - 1));
  const omittedPage = Math.min(omissionPage, Math.max(0, Math.ceil((prepared?.preview.omissions.length ?? 0) / 25) - 1));
  function updateOptions(patch: Partial<CalendarExportOptions>) { setMessage(''); setEventPage(0); setOmissionPage(0); setOptions(current => ({ ...current, ...patch })); }
  function toggleCategory(category: CalendarCategory) {
    setSelection(null);
    updateOptions({ categories: options.categories.includes(category) ? options.categories.filter(value => value !== category) : [...options.categories, category] });
  }
  function toggleEvent(uid: string) {
    if (!ready || !prepared) return;
    const selected = new Set(selection ?? prepared.candidates.map(event => event.uid));
    if (selected.has(uid)) selected.delete(uid); else selected.add(uid);
    setMessage(''); setSelection([...selected]);
  }
  async function download() {
    if (!ready || !prepared || !prepared.preview.events.length || busy) return;
    const attempt = prepared, token = deliveryState.current.version;
    const sameView = () => {
      const current = latestInputs.current;
      return deliveryState.current.mounted && deliveryState.current.version === token &&
        invalidatedSource !== attempt.snapshot && calendarDeliverySourceMatches(attempt, current);
    };
    setBusy(true); setMessage('');
    try {
      // Metadata persistence must succeed before a file is delivered with that revision.
      const delivered = await deliverCurrentCalendar({
        accountId: attempt.snapshot.accountId, currentAccount: currentDiveAccount, isCurrent: sameView,
        persist: () => onDownloadManifest(attempt.manifest),
        deliver: () => {
          const url = URL.createObjectURL(new Blob([attempt.content], { type: 'text/calendar;charset=utf-8' }));
          try {
            const anchor = document.createElement('a'); anchor.href = url;
            anchor.download = `zeustek-selected-calendar-${new Date().toISOString().slice(0, 10)}.ics`;
            anchor.click();
          } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
        },
      });
      if (delivered && sameView()) {
        setLocalManifest({ accountId: attempt.snapshot.accountId, manifest: attempt.manifest });
        setMessage('Calendar file download started. Re-import and cancellation behaviour depends on your calendar application.');
      } else if (!delivered && deliveryState.current.mounted && deliveryState.current.version === token && currentDiveAccount() === attempt.snapshot.accountId) {
        setMessage('Calendar download cancelled because its account, source or selection changed. Inspect the current preview before trying again.');
      }
    } catch { if (deliveryState.current.mounted && deliveryState.current.version === token && currentDiveAccount() === attempt.snapshot.accountId) setMessage('Calendar download could not be completed. Review the preview and export history before trying again.'); }
    finally { if (deliveryState.current.mounted && deliveryState.current.version === token) setBusy(false); }
  }

  return <section className={styles.page} aria-label="Selected calendar export">
    <header><span className="focus-eyebrow">SELECTED OWNER RECORDS</span><h2>Calendar download</h2><p>Choose recorded dates and labels, inspect the exact preview, then download an iCalendar file.</p></header>
    <p className={styles.scope}><strong>Inspection time:</strong> {snapshot.snapshotAt} · Owner records available on this device. Incomplete categories remain Unknown.</p>
    <fieldset className={styles.panel}><legend>Event categories</legend><div className={styles.actions}>
      <button className="focus-secondary" onClick={() => { setSelection(null); updateOptions({ categories: CALENDAR_CATEGORIES.map(([key]) => key) }); }}>Select all categories</button>
      <button className="focus-secondary" onClick={() => { setSelection(null); updateOptions({ categories: [] }); }}>Select no categories</button>
    </div><div className={styles.choices}>{CALENDAR_CATEGORIES.map(([key, label]) => <label key={key}><input type="checkbox" checked={options.categories.includes(key)} onChange={() => toggleCategory(key)} /><span>{label}</span></label>)}</div></fieldset>
    <fieldset className={styles.panel}><legend>Fields and date choices</legend><div className={styles.choices}>
      {([['title', 'Include source titles'], ['location', 'Include locations'], ['sourceLink', 'Include private source links']] as const).map(([field, label]) => <label key={field}><input type="checkbox" aria-label={label} checked={options.fields?.[field] === true} onChange={event => updateOptions({ fields: { ...options.fields, [field]: event.target.checked } })} /><span>{label}</span></label>)}
      <label><input type="checkbox" checked={options.includeCancelled === true} onChange={event => updateOptions({ includeCancelled: event.target.checked })} /><span>Include cancelled events</span></label>
      <label><input type="checkbox" checked={options.includeHistory === true} onChange={event => updateOptions({ includeHistory: event.target.checked })} /><span>Include completed / archived history</span></label>
      <label><input type="checkbox" checked={options.includePaid === true} onChange={event => updateOptions({ includePaid: event.target.checked })} /><span>Include paid booking deadlines</span></label>
    </div><label className={styles.timezone}>Export timezone<input aria-label="Export timezone" value={options.timezone ?? 'Europe/London'} onChange={event => updateOptions({ timezone: event.target.value.trim() })} placeholder="Europe/London" autoComplete="off" /><small>Saved local times use this IANA timezone. Repeated daylight-saving times require a choice below.</small></label></fieldset>
    <p className={styles.scope}>Titles, locations and source links can reveal private information. Generic reminder labels are used until you opt in. Month reminders appear once on the first day of the month; the exact due day remains unknown. These reminders carry no inspection-compliance or diver-readiness assurance.</p>
    {currentError ? <p role="alert" className="focus-notice error">Calendar preview is unavailable. Your source records remain available; review the export selections or reopen this tool.</p> : !ready ? <output aria-live="polite">Preparing calendar preview…</output> : prepared && <>
      <output className={styles.summary}><span><b>{prepared.preview.events.length}</b> selected events</span><span><b>{prepared.preview.omissions.length}</b> omitted / needs review</span><span>{prepared.preview.coverageUnknown ? 'Coverage: Unknown / incomplete' : 'Selected categories inspected'}</span></output>
      <section className={styles.panel} aria-label="Calendar event selection"><h3>Dates and labels</h3><div className={styles.actions}>
        <button className="focus-secondary" onClick={() => { setMessage(''); setSelection(null); }}>Select all events</button>
        <button className="focus-secondary" onClick={() => { setMessage(''); setSelection([]); }}>Select no events</button>
        <input type="search" aria-label="Filter calendar preview events" value={query} onChange={event => { setQuery(event.target.value); setEventPage(0); }} placeholder="Filter preview labels or dates" />
      </div>{filteredCandidates.length ? <><CalendarPreviewList events={filteredCandidates.slice(page * 25, (page + 1) * 25)} selectedEventKeys={selection} onToggle={toggleEvent} go={go} /><PageControls page={page} total={filteredCandidates.length} change={setEventPage} label="calendar events" /></> : <p>No dated events match the selected categories and preview filter.</p>}</section>
      {prepared.preview.omissions.length > 0 && <section className={styles.panel} aria-label="Omitted dates needing review"><h3>Omitted / needs review</h3><ul className={styles.omissions}>{prepared.preview.omissions.slice(omittedPage * 25, (omittedPage + 1) * 25).map((omission, index) => <li key={`${omission.category}-${omission.code}-${index}`}><strong>{CALENDAR_CATEGORIES.find(([key]) => key === omission.category)?.[1]}</strong><p>{omission.explanation}</p>{omission.reviewDestination && <SourceLink destination={omission.reviewDestination} go={go} />}{omission.resolutionKey && <div className={styles.actions}>{(['earlier', 'later'] as const).map(choice => <button key={choice} className="focus-secondary" onClick={() => updateOptions({ foldChoices: { ...options.foldChoices, [omission.resolutionKey!]: choice } })}>{choice === 'earlier' ? 'Earlier' : 'Later'} occurrence</button>)}</div>}</li>)}</ul><PageControls page={omittedPage} total={prepared.preview.omissions.length} change={setOmissionPage} label="omitted dates" /></section>}
      <details className={styles.panel}><summary>Exact .ics file preview</summary><pre className={styles.filePreview} aria-label="Exact calendar file contents">{prepared.content}</pre></details>
    </>}
    <div className={styles.actions}><button className="focus-primary" disabled={!ready || !prepared?.preview.events.length || busy} onClick={() => void download()}>{busy ? 'Preparing download…' : 'Download .ics'}</button>{busy && <button className="focus-secondary" onClick={() => { deliveryState.current.version++; setBusy(false); setMessage('Calendar download cancelled. No file was delivered.'); }}>Cancel download</button>}</div>
    <p className={styles.scope}>File import does not keep calendars in sync. A calendar application may duplicate a re-import or require manual handling of cancellations. Downloading saves only opaque local export revision metadata; source records are unchanged.</p>
    {message && <output aria-live="polite" className="focus-notice">{message}</output>}
  </section>;
}
