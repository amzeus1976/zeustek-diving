'use client';

import { useCallback, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { Archive, ExternalLink, Eye, Link2Off, Pencil, RefreshCw, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { AccessibleDialog } from '../accessible-dialog';
import { deleteLocalRecord, hasCloudSnapshot, listLocalDiveRecords, refreshDiveRecords, saveLocalRecord } from '../../lib/offline/dive-store';
import {
  archiveRecord,
  buildFixtureDeletionPlan,
  buildReferenceIndex,
  canEditRecordMetadata,
  discoverFixtureCandidates,
  editableRecordFields,
  FIXTURE_SCAN_KINDS,
  fixtureTitle,
  recordDestination,
  recommendedRecordAction,
  unlinkTargetFromRecord,
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
  action: Exclude<RecordAction, 'manual-review'>;
  row: ManagedRow;
};

function actionLabel(action: RecordAction) {
  if (action === 'delete') return 'Delete';
  if (action === 'archive') return 'Archive / suppress';
  if (action === 'unlink') return 'Unlink only';
  return 'Manual dependency review';
}

function isManageableAction(action: RecordAction): action is Exclude<RecordAction, 'manual-review'> {
  return action !== 'manual-review';
}

function actionIcon(action: Exclude<RecordAction, 'manual-review'>) {
  if (action === 'delete') return <Trash2 size={15}/>;
  if (action === 'archive') return <Archive size={15}/>;
  return <Link2Off size={15}/>;
}

function confirmationPhrase(action: Exclude<RecordAction, 'manual-review'>, title: string) {
  return `${action === 'delete' ? 'DELETE' : action === 'archive' ? 'ARCHIVE' : 'UNLINK'} ${title}`;
}

function ownerFieldText(value: unknown) {
  return typeof value === 'string' ? value : '';
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
    <b>{reference.sourceTitle}</b><span>{reference.sourceKind} · {reference.path}</span>
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

function ActionDialog({ pending, snapshots, close, complete }: { pending: PendingAction; snapshots: CanonicalRecordSnapshot[]; close: () => void; complete: () => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const phrase = confirmationPhrase(pending.action, pending.row.title);
  async function apply() {
    if (typed !== phrase) return;
    setBusy(true); setError('');
    try {
      const { snapshot, references } = pending.row;
      if (pending.action === 'delete') await deleteLocalRecord(snapshot.record.entityId);
      if (pending.action === 'archive') await saveLocalRecord(snapshot.kind, archiveRecord(snapshot.record));
      if (pending.action === 'unlink') {
        for (const reference of references) {
          const source = snapshots.find((item) => item.kind === reference.sourceKind && item.record.entityId === reference.sourceId);
          if (!source) throw new Error('A referencing record is not loaded. Refresh before unlinking.');
          const next = unlinkTargetFromRecord(source.record, snapshot.record.entityId);
          if (!next.changed) throw new Error(`The ${reference.sourceKind} relationship could not be unlinked safely.`);
          await saveLocalRecord(source.kind, { ...next.record, entityId: source.record.entityId });
        }
      }
      complete(); close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The requested record action failed.');
    } finally { setBusy(false); }
  }
  return <AccessibleDialog editable containDismiss label={`${actionLabel(pending.action)} ${pending.row.title}`} className={`focus-modal ${styles.dialog}`} close={() => { if (!busy) close(); }}>
    <header><div><span className="focus-eyebrow">EXPLICIT OWNER CONFIRMATION</span><h2>{actionLabel(pending.action)}</h2><p>{pending.action === 'delete' ? 'The record will be removed through the normal history and sync path.' : pending.action === 'archive' ? 'The record is retained with an archived/suppressed marker for historical review.' : 'Only supported relationship arrays are changed; the target record remains.'}</p></div><button className="focus-icon" data-dialog-close aria-label="Close confirmation" disabled={busy} onClick={close}><X/></button></header>
    <RecordMeta row={pending.row}/><ReferenceList references={pending.row.references}/>
    <label className={styles.confirm}>Type <b>{phrase}</b><input autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)}/></label>
    {error && <p role="alert">{error}</p>}<footer><button className="focus-secondary" data-dialog-close disabled={busy} onClick={close}>Cancel</button><button className={`focus-secondary ${pending.action === 'delete' ? 'danger' : ''}`} disabled={busy || typed !== phrase} onClick={() => void apply()}>{actionIcon(pending.action)}{busy ? 'Working…' : actionLabel(pending.action)}</button></footer>
  </AccessibleDialog>;
}

function RecordDetail({ row, go, close, edit, manage }: { row: ManagedRow; go: (route: string) => void; close: () => void; edit: () => void; manage: (action: Exclude<RecordAction, 'manual-review'>) => void }) {
  const record = row.snapshot.record;
  return <AccessibleDialog label={`${row.title} record details`} className={`focus-modal ${styles.dialog}`} close={close}>
    <header><div><span className="focus-eyebrow">USER DATA</span><h2>{row.title}</h2><p>{row.destinationLabel}</p></div><button className="focus-icon" data-dialog-close aria-label="Close record details" onClick={close}><X/></button></header>
    <RecordMeta row={row}/><section><h3>Dependencies</h3><ReferenceList references={row.references}/></section>
    {Boolean(record.archived || record.suppressedFromUse) && <p className="focus-notice">This record is marked archived/suppressed and retained for history.</p>}
    <footer className={styles.detailActions}><button className="focus-secondary" onClick={() => { close(); go(row.destination); }}><ExternalLink size={15}/>Open {row.destinationLabel}</button>{canEditRecordMetadata(row.snapshot.kind, record) && <button className="focus-secondary" onClick={edit}><Pencil size={15}/>Edit</button>}{isManageableAction(row.action) ? <button className={`focus-secondary ${row.action === 'delete' ? 'danger' : ''}`} onClick={() => manage(row.action as Exclude<RecordAction, 'manual-review'>)}>{actionIcon(row.action)}{actionLabel(row.action)}</button> : <span className={styles.blocked}><ShieldAlert size={15}/>Manual review required</span>}</footer>
  </AccessibleDialog>;
}

export function SyntheticFixtureReview({ go }: { go: (route: string) => void }) {
  const [records, setRecords] = useState<CanonicalRecordSnapshot[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [includeChildren, setIncludeChildren] = useState(true);
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('Loading all canonical record kinds…');
  const [mode, setMode] = useState<'fixtures' | 'all'>('fixtures');
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
      const groups = await Promise.all(FIXTURE_SCAN_KINDS.map(async (recordKind) => {
      try {
        const items = await listLocalDiveRecords<Record<string, unknown>>(recordKind);
        return items.map((record) => ({ kind: recordKind, record } satisfies CanonicalRecordSnapshot));
      } catch { return [] as CanonicalRecordSnapshot[]; }
      }));
      const snapshots = await Promise.all(FIXTURE_SCAN_KINDS.map((recordKind) => hasCloudSnapshot(recordKind).catch(() => false)));
      const next = groups.flat();
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
  const rows = useMemo<ManagedRow[]>(() => records.map((snapshot) => {
    const references = referenceIndex.get(snapshot.record.entityId) ?? [];
    const destination = recordDestination(snapshot.kind);
    return { snapshot, title: fixtureTitle(snapshot.record), destination: destination.destination, destinationLabel: destination.label, references, action: recommendedRecordAction(snapshot.kind, references) };
  }).sort((left, right) => left.title.localeCompare(right.title, 'en-GB')), [records, referenceIndex]);
  const visibleRows = useMemo(() => rows.filter((row) => (!kind || row.snapshot.kind === kind) && (!query.trim() || `${row.title} ${row.snapshot.kind} ${row.destinationLabel}`.toLocaleLowerCase('en-GB').includes(query.trim().toLocaleLowerCase('en-GB')))), [rows, kind, query]);
  const deletionPlan = useMemo(() => buildFixtureDeletionPlan(selected, records, includeChildren), [selected, records, includeChildren]);
  const deletePhrase = `DELETE ${deletionPlan.deleteIds.length} FIXTURES`;
  const selectedFixtures = fixtures.filter((item) => selected.includes(item.entityId));

  async function removeFixtures() {
    if (!deletionPlan.safe || confirmation !== deletePhrase) return;
    setBusy(true);
    try {
      for (const id of deletionPlan.deleteIds) await deleteLocalRecord(id);
      setMessage(`${deletionPlan.deleteIds.length} fixture record${deletionPlan.deleteIds.length === 1 ? '' : 's'} deleted through canonical history and sync.`);
      setSelected([]); setConfirmation(''); refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Fixture deletion failed; remaining records were retained.');
    } finally { setBusy(false); }
  }

  async function archiveSelected() {
    const phrase = `ARCHIVE ${selectedFixtures.length} FIXTURES`;
    if (!selectedFixtures.length || confirmation !== phrase) return;
    setBusy(true);
    try {
      for (const fixture of selectedFixtures) {
        const snapshot = records.find((item) => item.kind === fixture.kind && item.record.entityId === fixture.entityId);
        if (snapshot) await saveLocalRecord(snapshot.kind, archiveRecord(snapshot.record));
      }
      setMessage(`${selectedFixtures.length} fixture record${selectedFixtures.length === 1 ? '' : 's'} archived/suppressed for review.`);
      setSelected([]); setConfirmation(''); refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Fixture archive failed; records were retained.');
    } finally { setBusy(false); }
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
    <div className={styles.tabs} role="tablist" aria-label="Data tools view"><button role="tab" aria-selected={mode === 'fixtures'} onClick={() => setMode('fixtures')}>Acceptance fixtures <span>{fixtures.length}</span></button><button role="tab" aria-selected={mode === 'all'} onClick={() => setMode('all')}>All user data <span>{records.length}</span></button></div>
    <p className="focus-copy"><ShieldAlert size={17}/> This screen reviews every loaded canonical record kind. Nothing is selected or deleted automatically.</p>
    <output className="focus-notice">{message}</output>

    {mode === 'fixtures' ? <>
      {fixtures.length ? <div className={styles.fixtureList}>{fixtures.map((item) => <article key={`${item.kind}:${item.entityId}`}>
        <div className={styles.select}><input type="checkbox" aria-label={`Select fixture ${item.title}`} checked={selected.includes(item.entityId)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.entityId] : current.filter((id) => id !== item.entityId))}/><span><b>{item.title}</b><small>{item.kind} · {item.destinationLabel}</small></span></div>
         <dl><div><dt>Matched field/value</dt><dd>{item.matches.map((match) => `${match.field}: “${match.value}”`).join(' · ')}</dd></div><div><dt>Created / modified</dt><dd>{item.createdAt ? new Date(item.createdAt).toLocaleString('en-GB') : 'Created not recorded'} · {item.modifiedAt ? new Date(item.modifiedAt).toLocaleString('en-GB') : 'Modified not recorded'}</dd></div><div><dt>Dependency</dt><dd>{item.dependencyStatus}</dd></div><div><dt>Recommended</dt><dd>{actionLabel(item.recommendedAction)}</dd></div></dl>
        <div className="record-actions"><button className="focus-secondary" onClick={() => { const row = rowForFixture(item); if (row) setDetail(row); }}><Eye size={15}/>View details</button><button className="focus-secondary" onClick={() => go(item.destination)}><ExternalLink size={15}/>Open {item.destinationLabel}</button></div>
      </article>)}</div> : <p>No obvious synthetic, test or acceptance labels were found across the loaded record kinds.</p>}
      <section className={styles.selectionSummary} aria-labelledby="fixture-action-summary"><h3 id="fixture-action-summary">Selected action summary</h3><p>{selectedFixtures.length} selected fixture{selectedFixtures.length === 1 ? '' : 's'}; {deletionPlan.childIds.length} unreferenced labelled child{deletionPlan.childIds.length === 1 ? '' : 'ren'} included.</p>
        <label className={styles.inlineCheck}><input type="checkbox" checked={includeChildren} onChange={(event) => setIncludeChildren(event.target.checked)}/>Include unreferenced labelled fixture children</label>
        {deletionPlan.blockers.length > 0 && <p role="alert"><ShieldAlert size={15}/>Deletion blocked by {deletionPlan.blockers.length} reference{deletionPlan.blockers.length === 1 ? '' : 's'}. Use View details to review or unlink safely.</p>}
        {deletionPlan.protectedIds.length > 0 && <p role="alert"><ShieldAlert size={15}/>Historical/immutable records cannot be deleted here; archive them instead.</p>}
        <label className={styles.confirm}>To delete, type <b>{deletePhrase}</b>. To preserve and suppress the selected records, type <b>ARCHIVE {selectedFixtures.length} FIXTURES</b>.<input autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={!selectedFixtures.length}/></label>
         <div className="record-actions"><button className="focus-secondary danger" disabled={busy || !scanComplete || !deletionPlan.safe || confirmation !== deletePhrase} onClick={() => void removeFixtures()}><Trash2 size={15}/>Delete fixture{includeChildren ? ' and safe children' : ''} ({deletionPlan.deleteIds.length})</button><button className="focus-secondary" disabled={busy || !scanComplete || !selectedFixtures.length || confirmation !== `ARCHIVE ${selectedFixtures.length} FIXTURES`} onClick={() => void archiveSelected()}><Archive size={15}/>Archive / suppress selected</button></div>
      </section>
    </> : <>
      <div className={styles.filters}><label><Search size={15}/>Search records<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, kind or app area"/></label><label>Record kind<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="">All kinds</option>{[...new Set(rows.map((row) => row.snapshot.kind))].sort().map((value) => <option key={value}>{value}</option>)}</select></label></div>
       <div className={styles.recordList}>{visibleRows.slice(0, showAll ? visibleRows.length : 25).map((row) => <article key={`${row.snapshot.kind}:${row.snapshot.record.entityId}`}><div><b>{row.title}</b><span>{row.snapshot.kind} · {row.destinationLabel}</span><small>{row.references.length ? `${row.references.length} reference${row.references.length === 1 ? '' : 's'}` : 'No references'} · {actionLabel(row.action)}</small></div><div className="record-actions"><button className="focus-secondary" onClick={() => setDetail(row)}><Eye size={15}/>View details</button>{canEditRecordMetadata(row.snapshot.kind, row.snapshot.record) && <button className="focus-secondary" onClick={() => setEditing(row)}><Pencil size={15}/>Edit</button>}{isManageableAction(row.action) && <button disabled={!scanComplete} className={`focus-secondary ${row.action === 'delete' ? 'danger' : ''}`} onClick={() => setPending({ action: row.action as Exclude<RecordAction, 'manual-review'>, row })}>{actionIcon(row.action)}{actionLabel(row.action)}</button>}</div></article>)}</div>
      {visibleRows.length > 25 && <button className="focus-secondary" aria-expanded={showAll} onClick={() => setShowAll((current) => !current)}>{showAll ? 'Show less' : `Show ${visibleRows.length - 25} more`}</button>}
    </>}
    <div className="record-actions"><button className="focus-secondary" onClick={rescan}><RefreshCw size={15}/>Scan all records again</button></div>
    {detail && (
      <RecordDetail
        row={detail}
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
      <ActionDialog pending={pending} snapshots={records} close={() => setPending(null)} complete={refresh}/>
    )}
  </div>;
}
