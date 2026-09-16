'use client';

import { useCallback, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { Archive, ExternalLink, Link2Off, Pencil, RefreshCw, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { AccessibleDialog } from '../accessible-dialog';
import { deleteLocalRecord, hasCloudSnapshot, listLocalDiveRecords, refreshDiveRecords, saveLocalRecord } from '../../lib/offline/dive-store';
import {
  archiveRecord,
  buildSyntheticCleanupPlan,
  buildReferenceIndex,
  canEditRecordMetadata,
  cleanupReport,
  discoverFixtureCandidates,
  editableRecordFields,
  FIXTURE_SCAN_KINDS,
  fixtureTitle,
  recordActionReason,
  recordDestination,
  recommendedRecordAction,
  referenceCanUnlink,
  unlinkTargetFromRecord,
  type CleanupReport,
  type CanonicalRecordSnapshot,
  type FixtureCandidate,
  type RecordAction,
  type RecordReference,
} from '../../lib/workflow/synthetic-fixtures';
import { useRecordRefresh } from '../record-status';
import styles from './synthetic-fixture-review.module.css';

type ManagedRow = {
  snapshot: CanonicalRecordSnapshot;
  title: string;
  destination: string;
  destinationLabel: string;
  references: RecordReference[];
  action: RecordAction;
};

type PendingAction = {
  action: Exclude<RecordAction, 'manual-review'> | 'unlink-delete';
  row: ManagedRow;
};

function actionLabel(action: RecordAction | 'unlink-delete') {
  if (action === 'delete') return 'Delete';
  if (action === 'archive') return 'Archive / suppress';
  if (action === 'unlink') return 'Unlink only';
  if (action === 'unlink-delete') return 'Unlink then delete';
  return 'Manual dependency review';
}

function isManageableAction(action: RecordAction): action is Exclude<RecordAction, 'manual-review'> {
  return action !== 'manual-review';
}

function actionIcon(action: Exclude<RecordAction, 'manual-review'> | 'unlink-delete') {
  if (action === 'delete') return <Trash2 size={15}/>;
  if (action === 'archive') return <Archive size={15}/>;
  return <Link2Off size={15}/>;
}

function confirmationPhrase(action: Exclude<RecordAction, 'manual-review'> | 'unlink-delete', title: string) {
  return `${action === 'delete' ? 'DELETE' : action === 'archive' ? 'ARCHIVE' : action === 'unlink-delete' ? 'UNLINK AND DELETE' : 'UNLINK'} ${title}`;
}

function ownerFieldText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

async function scanCurrentRecords(): Promise<CanonicalRecordSnapshot[]> {
  const groups = await Promise.all(FIXTURE_SCAN_KINDS.map(async (kind) => {
    const records = await listLocalDiveRecords<Record<string, unknown>>(kind, { includeSuppressed: true });
    return records.map((record) => ({ kind, record } satisfies CanonicalRecordSnapshot));
  }));
  return groups.flat();
}

function RecordMeta({ row }: { row: ManagedRow }) {
  const record = row.snapshot.record;
  return <dl className={styles.meta}>
    <div><dt>Record kind</dt><dd>{row.snapshot.kind}</dd></div>
    <div><dt>Entity ID</dt><dd>{record.entityId}</dd></div>
    <div><dt>Belongs in</dt><dd>{row.destinationLabel}</dd></div>
    <div><dt>Created</dt><dd>{typeof record.createdAt === 'string' ? new Date(record.createdAt).toLocaleString('en-GB') : 'Not recorded'}</dd></div>
    <div><dt>Modified</dt><dd>{typeof record.modifiedAt === 'string' ? new Date(record.modifiedAt).toLocaleString('en-GB') : 'Not recorded'}</dd></div>
    <div><dt>Dependency status</dt><dd>{row.references.length ? `${row.references.length} canonical reference${row.references.length === 1 ? '' : 's'}` : 'No canonical references found'}</dd></div>
  </dl>;
}

function ReferenceList({ references }: { references: RecordReference[] }) {
  if (!references.length) return <p>No other loaded canonical record references this item.</p>;
  return <ul className={styles.references}>{references.map((reference) => <li key={`${reference.sourceKind}:${reference.sourceId}:${reference.path}`}>
    <b>{reference.sourceTitle}</b><span>{reference.sourceKind} · {reference.path} · {reference.synthetic ? 'synthetic reference' : 'owner/unknown reference'}</span>
  </li>)}</ul>;
}

function MetadataEditor({ row, close, saved }: { row: ManagedRow; close: () => void; saved: () => void }) {
  const fields = editableRecordFields(row.snapshot.record);
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field, ownerFieldText(row.snapshot.record[field])])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = fields.some((field) => draft[field] !== row.snapshot.record[field]);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await saveLocalRecord(row.snapshot.kind, { ...row.snapshot.record, ...draft, entityId: row.snapshot.record.entityId });
      saved(); close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This record could not be updated.');
    } finally { setBusy(false); }
  }
  return <AccessibleDialog editable dirty={dirty} containDismiss label={`Edit ${row.title}`} className={`focus-modal ${styles.dialog}`} close={() => { if (!busy) close(); }}>
    <form onSubmit={(event) => void submit(event)}><header><div><span className="focus-eyebrow">CANONICAL RECORD</span><h2>Edit {row.title}</h2><p>Only common owner-entered labels and notes are changed here. Record identity and relationships are preserved.</p></div><button type="button" className="focus-icon" data-dialog-close aria-label="Close record editor" disabled={busy} onClick={close}><X/></button></header>
      <div className={styles.fields}>{fields.map((field) => <label key={field}>{field.replace(/([A-Z])/g, ' $1')}{['notes', 'description'].includes(field) ? <textarea value={draft[field] ?? ''} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}/> : <input value={draft[field] ?? ''} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}/>}</label>)}</div>
      {error && <p role="alert">{error}</p>}<footer><button type="button" className="focus-secondary" data-dialog-close disabled={busy} onClick={close}>Cancel</button><button className="focus-primary" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button></footer>
    </form>
  </AccessibleDialog>;
}

function ActionDialog({ pending, close, complete }: { pending: PendingAction; close: () => void; complete: (report: CleanupReport) => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const phrase = confirmationPhrase(pending.action, pending.row.title);
  async function apply() {
    if (typed !== phrase) return;
    setBusy(true); setError('');
    let unlinked = 0;
    let ownerRecordsChanged = 0;
    const actions: Array<{ kind: string; action: 'deleted' | 'archived' }> = [];
    try {
      const { snapshot } = pending.row;
      const fresh = await scanCurrentRecords();
      const latest = fresh.find((item) => item.kind === snapshot.kind && item.record.entityId === snapshot.record.entityId);
      if (!latest) throw new Error('This record changed or was removed. Refresh the scan before acting.');
      const references = buildReferenceIndex(fresh).get(snapshot.record.entityId) ?? [];
      const referenceKeys = (items: RecordReference[]) => items.map((ref) => `${ref.sourceKind}:${ref.sourceId}:${ref.path}`).sort((a, b) => a.localeCompare(b));
      if (JSON.stringify(referenceKeys(references)) !== JSON.stringify(referenceKeys(pending.row.references)))
        throw new Error('Dependencies changed. Refresh the scan before acting.');
      if (pending.action === 'delete' && recommendedRecordAction(snapshot.kind, references) !== 'delete')
        throw new Error('This record now has protected history or dependencies. Refresh the scan.');
      if (pending.action === 'archive' && recommendedRecordAction(snapshot.kind, references) === 'manual-review')
        throw new Error('This record now has owner dependencies. Refresh the scan before suppressing it.');
      if (pending.action === 'unlink-delete' &&
        (!discoverFixtureCandidates(fresh).some((item) => item.entityId === snapshot.record.entityId) ||
          references.length === 0 || !references.every(referenceCanUnlink)))
        throw new Error('Unlink and delete is no longer safe. Refresh the scan.');
      if (pending.action === 'delete') { await deleteLocalRecord(snapshot.record.entityId); actions.push({ kind: snapshot.kind, action: 'deleted' }); }
      if (pending.action === 'archive') { await saveLocalRecord(snapshot.kind, archiveRecord(latest.record)); actions.push({ kind: snapshot.kind, action: 'archived' }); }
      if (pending.action === 'unlink' || pending.action === 'unlink-delete') {
        for (const reference of references) {
          if (!referenceCanUnlink(reference)) throw new Error('A historical relationship cannot be unlinked automatically.');
          const source = fresh.find((item) => item.kind === reference.sourceKind && item.record.entityId === reference.sourceId);
          if (!source) throw new Error('A referencing record is not loaded. Refresh before unlinking.');
          const next = unlinkTargetFromRecord(source.record, snapshot.record.entityId);
          if (!next.changed) throw new Error(`The ${reference.sourceKind} relationship could not be unlinked safely.`);
          await saveLocalRecord(source.kind, { ...next.record, entityId: source.record.entityId });
          unlinked++;
          if (!reference.synthetic) ownerRecordsChanged++;
        }
        if (pending.action === 'unlink-delete') { await deleteLocalRecord(snapshot.record.entityId); actions.push({ kind: snapshot.kind, action: 'deleted' }); }
      }
      const after = await scanCurrentRecords();
      complete(cleanupReport(actions, unlinked, [], ownerRecordsChanged, after));
      close();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'The requested record action failed.';
      setError(`${message}${unlinked || actions.length ? ` Partial change: ${unlinked} reference(s) unlinked, ${actions.length} record action(s) completed. Review the report and scan again.` : ''}`);
      if (unlinked || actions.length) {
        const after = await scanCurrentRecords().catch(() => [] as CanonicalRecordSnapshot[]);
        complete(cleanupReport(actions, unlinked, [{ id: pending.row.snapshot.record.entityId, reason: message }], ownerRecordsChanged, after));
      }
    } finally { setBusy(false); }
  }
  return <AccessibleDialog editable containDismiss label={`${actionLabel(pending.action)} ${pending.row.title}`} className={`focus-modal ${styles.dialog}`} close={() => { if (!busy) close(); }}>
    <header><div><span className="focus-eyebrow">EXPLICIT OWNER CONFIRMATION</span><h2>{actionLabel(pending.action)}</h2><p>{pending.action === 'delete' ? 'The record will be removed through the normal history and sync path.' : pending.action === 'archive' ? 'The record is retained with an archived/suppressed marker for historical review.' : pending.action === 'unlink-delete' ? 'Each supported reference (including owner records shown below) is changed first, then the synthetic target is deleted. This cannot be rolled back as one transaction.' : 'Only supported relationships are changed; the target record remains.'}</p></div><button className="focus-icon" data-dialog-close aria-label="Close confirmation" disabled={busy} onClick={close}><X/></button></header>
    <RecordMeta row={pending.row}/><ReferenceList references={pending.row.references}/>
    <label className={styles.confirm}>Type <b>{phrase}</b><input autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)}/></label>
    {error && <p role="alert">{error}</p>}<footer><button className="focus-secondary" data-dialog-close disabled={busy} onClick={close}>Cancel</button><button className={`focus-secondary ${pending.action === 'delete' || pending.action === 'unlink-delete' ? 'danger' : ''}`} disabled={busy || typed !== phrase} onClick={() => void apply()}>{actionIcon(pending.action)}{busy ? 'Working…' : actionLabel(pending.action)}</button></footer>
  </AccessibleDialog>;
}

function RecordDetail({ row, candidate, go, close, edit, manage }: { row: ManagedRow; candidate: FixtureCandidate | undefined; go: (route: string) => void; close: () => void; edit: () => void; manage: (action: PendingAction['action']) => void }) {
  const record = row.snapshot.record;
  return <AccessibleDialog label={`${row.title} record details`} className={`focus-modal ${styles.dialog}`} close={close}>
    <header><div><span className="focus-eyebrow">USER DATA</span><h2>{row.title}</h2><p>{row.destinationLabel}</p></div><button className="focus-icon" data-dialog-close aria-label="Close record details" onClick={close}><X/></button></header>
    <RecordMeta row={row}/>
    {candidate && <section><h3>{candidate.confidence === 'high' ? 'High-confidence synthetic' : 'Possible synthetic · owner review needed'}</h3><p>Matched evidence:</p><ul>{candidate.matches.map((match) => <li key={`${match.field}:${match.term}`}><b>{match.field}</b>: {match.value} ({match.term}, {match.confidence})</li>)}</ul></section>}
    <section><h3>Inbound dependencies</h3><ReferenceList references={row.references}/></section>
    {candidate && <section><h3>Outbound references</h3>{candidate.outboundReferences.length ? <ul className={styles.references}>{candidate.outboundReferences.map((ref) => <li key={`${ref.targetKind}:${ref.targetId}:${ref.path}`}><b>{ref.targetKind} · {ref.targetId}</b><span>{ref.path} · target remains unchanged if this record is removed</span></li>)}</ul> : <p>No linked canonical targets.</p>}</section>}
    <section className={styles.actionReason}><h3>Available safe action</h3><b>{actionLabel(row.action)}</b><p>{recordActionReason(row.snapshot.kind, row.references)}</p></section>
    {Boolean(record.archived || record.suppressedFromUse) && <p className="focus-notice">This record is marked archived/suppressed and retained for history.</p>}
    <footer className={styles.detailActions}><button className="focus-secondary" onClick={() => { close(); go(row.destination); }}><ExternalLink size={15}/>Open {row.destinationLabel}</button>{canEditRecordMetadata(row.snapshot.kind, record) && <button className="focus-secondary" onClick={edit}><Pencil size={15}/>Edit</button>}{isManageableAction(row.action) ? <button className={`focus-secondary ${row.action === 'delete' ? 'danger' : ''}`} onClick={() => manage(row.action as Exclude<RecordAction, 'manual-review'>)}>{actionIcon(row.action)}{actionLabel(row.action)}</button> : <span className={styles.blocked}><ShieldAlert size={15}/>Manual review required</span>}{candidate?.confidence === 'high' && row.action === 'unlink' && <button className="focus-secondary danger" onClick={() => manage('unlink-delete')}><Link2Off size={15}/>Unlink then delete</button>}</footer>
  </AccessibleDialog>;
}

export function SyntheticFixtureReview({ go }: { go: (route: string) => void }) {
  const [records, setRecords] = useState<CanonicalRecordSnapshot[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('Loading all canonical record kinds…');
  const [mode, setMode] = useState<'fixtures' | 'suspicious' | 'all'>('fixtures');
  const [report, setReport] = useState<CleanupReport | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [detail, setDetail] = useState<ManagedRow | null>(null);
  const [editing, setEditing] = useState<ManagedRow | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const initialScan = useRef(false);

  const refresh = useCallback(() => {
    const load = async () => {
      if (!initialScan.current) {
        initialScan.current = true;
        setMessage('Refreshing and scanning every canonical record kind…');
        await Promise.all(FIXTURE_SCAN_KINDS.map((recordKind) => refreshDiveRecords(recordKind, true)));
      }
      let next: CanonicalRecordSnapshot[];
      try { next = await scanCurrentRecords(); }
      catch (error) { setScanComplete(false); setMessage(error instanceof Error ? `Scan failed: ${error.message}` : 'Scan failed. No destructive actions are available.'); return; }
      const snapshots = await Promise.all(FIXTURE_SCAN_KINDS.map((recordKind) => hasCloudSnapshot(recordKind).catch(() => false)));
      setRecords(next);
      const complete = snapshots.every(Boolean);
      setScanComplete(complete);
      setMessage(complete ? `${next.length} records checked across all ${FIXTURE_SCAN_KINDS.length} canonical kinds.` : `${next.length} local records checked. Cloud completeness is not confirmed, so destructive actions remain disabled.`);
    };
    void load();
  }, []);
  useRecordRefresh(refresh);

  const referenceIndex = useMemo(() => buildReferenceIndex(records), [records]);
  const fixtures = useMemo(() => discoverFixtureCandidates(records), [records]);
  const allCandidates = useMemo(() => discoverFixtureCandidates(records, 'suspicious'), [records]);
  const possible = useMemo(() => allCandidates.filter((item) => item.confidence === 'possible'), [allCandidates]);
  const rows = useMemo<ManagedRow[]>(() => records.map((snapshot) => {
    const references = referenceIndex.get(snapshot.record.entityId) ?? [];
    const destination = recordDestination(snapshot.kind);
    return { snapshot, title: fixtureTitle(snapshot.record), destination: destination.destination, destinationLabel: destination.label, references, action: recommendedRecordAction(snapshot.kind, references) };
  }).sort((left, right) => left.title.localeCompare(right.title, 'en-GB')), [records, referenceIndex]);
  const visibleRows = useMemo(() => rows.filter((row) => (!kind || row.snapshot.kind === kind) && (!query.trim() || `${row.title} ${row.snapshot.kind} ${row.destinationLabel}`.toLocaleLowerCase('en-GB').includes(query.trim().toLocaleLowerCase('en-GB')))), [rows, kind, query]);
  const deletionPlan = useMemo(() => buildSyntheticCleanupPlan(selected, records), [selected, records]);
  const deletePhrase = `DELETE ${deletionPlan.deleteIds.length} SAFE RECORDS`;
  const archivePhrase = `ARCHIVE ${deletionPlan.archiveIds.length} PROTECTED RECORDS`;
  const selectedFixtures = fixtures.filter((item) => selected.includes(item.entityId));

  async function removeFixtures() {
    if (!scanComplete || !deletionPlan.deleteIds.length || confirmation !== deletePhrase) return;
    setBusy(true);
    const completed: Array<{ kind: string; action: 'deleted' }> = [];
    try {
      const fresh = await scanCurrentRecords();
      const checked = buildSyntheticCleanupPlan(selected, fresh);
      if (JSON.stringify(checked.deleteIds.slice().sort()) !== JSON.stringify(deletionPlan.deleteIds.slice().sort()))
        throw new Error('The safe-delete selection changed. Scan again before deleting.');
      for (const id of checked.deleteIds) {
        const snapshot = fresh.find((row) => row.record.entityId === id);
        if (!snapshot) throw new Error('A selected record was not found.');
        await deleteLocalRecord(id);
        completed.push({ kind: snapshot.kind, action: 'deleted' });
      }
      setMessage(`${completed.length} high-confidence safe record${completed.length === 1 ? '' : 's'} deleted through canonical history and sync.`);
      setSelected([]); setConfirmation(''); refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Fixture deletion failed; remaining records were retained.');
    } finally {
      const after = await scanCurrentRecords().catch(() => records);
      setReport(cleanupReport(completed, 0, deletionPlan.blocked, 0, after));
      setBusy(false);
    }
  }

  async function archiveSelected() {
    if (!scanComplete || !deletionPlan.archiveIds.length || confirmation !== archivePhrase) return;
    setBusy(true);
    const completed: Array<{ kind: string; action: 'archived' }> = [];
    try {
      const fresh = await scanCurrentRecords();
      const checked = buildSyntheticCleanupPlan(selected, fresh);
      if (JSON.stringify(checked.archiveIds.slice().sort()) !== JSON.stringify(deletionPlan.archiveIds.slice().sort()))
        throw new Error('The protected selection changed. Scan again before archiving.');
      for (const id of checked.archiveIds) {
        const snapshot = fresh.find((item) => item.record.entityId === id);
        if (!snapshot) throw new Error('A selected record was not found.');
        await saveLocalRecord(snapshot.kind, archiveRecord(snapshot.record));
        completed.push({ kind: snapshot.kind, action: 'archived' });
      }
      setMessage(`${completed.length} protected synthetic record${completed.length === 1 ? '' : 's'} archived/suppressed for review.`);
      setSelected([]); setConfirmation(''); refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Fixture archive failed; records were retained.');
    } finally {
      const after = await scanCurrentRecords().catch(() => records);
      setReport(cleanupReport(completed, 0, deletionPlan.blocked, 0, after));
      setBusy(false);
    }
  }

  function rowForFixture(item: FixtureCandidate) {
    return rows.find((row) => row.snapshot.kind === item.kind && row.snapshot.record.entityId === item.entityId);
  }

  function rescan() {
    initialScan.current = false;
    setScanComplete(false);
    refresh();
  }

  return <div className={styles.review}>
    <div className={styles.tabs} role="tablist" aria-label="Data tools view"><button role="tab" aria-selected={mode === 'fixtures'} onClick={() => setMode('fixtures')}>High-confidence synthetic cleanup <span>{fixtures.length}</span></button><button role="tab" aria-selected={mode === 'suspicious'} onClick={() => setMode('suspicious')}>Possible synthetic · review needed <span>{possible.length}</span></button><button role="tab" aria-selected={mode === 'all'} onClick={() => setMode('all')}>All user data <span>{records.length}</span></button></div>
    <p className="focus-copy"><ShieldAlert size={17}/> This screen reviews every loaded canonical record kind. Nothing is selected or deleted automatically.</p>
    <output className="focus-notice">{message}</output>

    {mode === 'fixtures' ? <>
      {fixtures.length ? <div className={styles.fixtureList}>{fixtures.slice(0, showAll ? fixtures.length : 25).map((item) => <article key={`${item.kind}:${item.entityId}`}>
        <div className={styles.select}><input type="checkbox" aria-label={`Select fixture ${item.title}`} checked={selected.includes(item.entityId)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.entityId] : current.filter((id) => id !== item.entityId))}/><button type="button" className={styles.titleButton} aria-label={`Review ${item.title}`} onClick={() => { const row = rowForFixture(item); if (row) setDetail(row); }}><span><b>{item.title}</b><small>{item.kind} · {item.destinationLabel}</small></span></button></div>
         <dl><div><dt>Matched field/value</dt><dd>{item.matches.map((match) => `${match.field}: “${match.value}” (${match.confidence})`).join(' · ')}</dd></div><div><dt>Appears in</dt><dd>{item.destinationLabel}</dd></div><div><dt>Created / modified</dt><dd>{item.createdAt ? new Date(item.createdAt).toLocaleString('en-GB') : 'Created not recorded'} · {item.modifiedAt ? new Date(item.modifiedAt).toLocaleString('en-GB') : 'Modified not recorded'}</dd></div><div><dt>References</dt><dd>{item.references.length} inbound; {item.outboundReferences.length} outbound. {item.dependencyStatus}</dd></div><div><dt>Action plan</dt><dd>{actionLabel(item.recommendedAction)} · {item.actionReason}</dd></div></dl>
      </article>)}</div> : <p>No obvious synthetic, test or acceptance labels were found across the loaded record kinds.</p>}
      {fixtures.length > 25 && <button className="focus-secondary" aria-expanded={showAll} onClick={() => setShowAll((current) => !current)}>{showAll ? 'Show less' : `Show ${fixtures.length - 25} more`}</button>}
      <section className={styles.selectionSummary} aria-labelledby="fixture-action-summary"><h3 id="fixture-action-summary">Selected action summary</h3><p>{selectedFixtures.length} selected · {deletionPlan.deleteIds.length} safe to delete together (no outside references) · {deletionPlan.archiveIds.length} protected to archive · {deletionPlan.unlinkThenDeleteIds.length} require individual unlink review · {deletionPlan.blocked.length} blocked.</p>
        {deletionPlan.unlinkThenDeleteIds.length > 0 && <output>Open each linked fixture to review the exact owner/synthetic references before unlinking and deleting. No owner record is changed by bulk cleanup.</output>}
        {deletionPlan.blocked.map(({ id, reason }) => <p key={id} role="alert"><ShieldAlert size={15}/>{id}: {reason}</p>)}
        <label className={styles.confirm}>To delete only the {deletionPlan.deleteIds.length} safe records, type <b>{deletePhrase}</b>. To archive only the {deletionPlan.archiveIds.length} protected records, type <b>{archivePhrase}</b>.<input autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={!selectedFixtures.length}/></label>
         <div className="record-actions"><button className="focus-secondary danger" disabled={busy || !scanComplete || !deletionPlan.deleteIds.length || confirmation !== deletePhrase} onClick={() => void removeFixtures()}><Trash2 size={15}/>Delete selected safe records ({deletionPlan.deleteIds.length})</button><button className="focus-secondary" disabled={busy || !scanComplete || !deletionPlan.archiveIds.length || confirmation !== archivePhrase} onClick={() => void archiveSelected()}><Archive size={15}/>Archive selected protected records ({deletionPlan.archiveIds.length})</button></div>
      </section>
    </> : mode === 'suspicious' ? <>
      <p className="focus-copy">Possible task or test-data markers need individual review. Ordinary service tests and physical fixtures are ignored. Nothing here is selected for bulk deletion.</p>
      <div className={styles.fixtureList}>{possible.slice(0, showAll ? possible.length : 25).map((item) => <article key={`${item.kind}:${item.entityId}`}><button type="button" className={styles.titleButton} onClick={() => { const row = rowForFixture(item); if (row) setDetail(row); }}><b>{item.title}</b> · {item.kind} · {item.confidence} · {item.matches.map((match) => `${match.field}: “${match.value}”`).join(' · ')}</button></article>)}</div>
      {possible.length > 25 && <button className="focus-secondary" aria-expanded={showAll} onClick={() => setShowAll((current) => !current)}>{showAll ? 'Show less' : `Show ${possible.length - 25} more`}</button>}
    </> : <>
      <div className={styles.filters}><label><Search size={15}/>Search records<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, kind or app area"/></label><label>Record kind<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="">All kinds</option>{[...new Set(rows.map((row) => row.snapshot.kind))].sort().map((value) => <option key={value}>{value}</option>)}</select></label></div>
       <div className={styles.recordList}>{visibleRows.slice(0, showAll ? visibleRows.length : 25).map((row) => <article key={`${row.snapshot.kind}:${row.snapshot.record.entityId}`}><button type="button" className={styles.titleButton} data-opens-detail="true" aria-label={`Open ${row.title} record details`} onClick={() => setDetail(row)}><span><b>{row.title}</b><small>{row.snapshot.kind} · {row.destinationLabel}</small><small>{row.references.length ? `${row.references.length} reference${row.references.length === 1 ? '' : 's'}` : 'No references'} · {actionLabel(row.action)}</small></span></button></article>)}</div>
      {visibleRows.length > 25 && <button className="focus-secondary" aria-expanded={showAll} onClick={() => setShowAll((current) => !current)}>{showAll ? 'Show less' : `Show ${visibleRows.length - 25} more`}</button>}
    </>}
    {report && <output className={styles.selectionSummary} aria-label="Post-cleanup report"><h3>Post-cleanup report</h3><p>Deleted by kind: {JSON.stringify(report.deletedByKind)} · Archived/suppressed by kind: {JSON.stringify(report.archivedByKind)}</p><p>Unlinked references: {report.unlinkedReferences} · Owner records changed: {report.ownerRecordsChanged} · Remaining suspicious records (including archived): {report.remainingSuspicious}</p>{report.blocked.map(({ id, reason }) => <p key={id}>Blocked {id}: {reason}</p>)}</output>}
    <div className="record-actions"><button className="focus-secondary" onClick={rescan}><RefreshCw size={15}/>Scan all records again</button></div>
    {detail && (
      <RecordDetail
        row={detail}
        candidate={allCandidates.find((item) => item.kind === detail.snapshot.kind && item.entityId === detail.snapshot.record.entityId)}
        go={go}
        close={() => setDetail(null)}
        edit={() => { setEditing(detail); setDetail(null); }}
        manage={(action) => { if (scanComplete) { setPending({ action, row: detail }); setDetail(null); } }}
      />
    )}
    {editing && (
      <MetadataEditor row={editing} close={() => setEditing(null)} saved={refresh}/>
    )}
    {pending && (
      <ActionDialog pending={pending} close={() => setPending(null)} complete={(nextReport) => { setReport(nextReport); refresh(); }}/>
    )}
  </div>;
}
