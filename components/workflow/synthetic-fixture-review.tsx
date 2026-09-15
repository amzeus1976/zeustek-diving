'use client';

import { useCallback, useState } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { deleteLocalRecord, listLocalDiveRecords } from '../../lib/offline/dive-store';
import { candidateFromRecord, FIXTURE_SCAN_KINDS, type FixtureCandidate } from '../../lib/workflow/synthetic-fixtures';
import { useRecordRefresh } from '../record-status';

export function SyntheticFixtureReview() {
  const [items, setItems] = useState<FixtureCandidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = useCallback(() => {
    void Promise.all(FIXTURE_SCAN_KINDS.map(async (kind) => (await listLocalDiveRecords<Record<string, unknown>>(kind)).map((record) => candidateFromRecord(kind, record)).filter((item): item is FixtureCandidate => Boolean(item))))
      .then((groups) => setItems(groups.flat().sort((a, b) => a.title.localeCompare(b.title))));
  }, []);
  useRecordRefresh(refresh);

  async function remove(targets: FixtureCandidate[]) {
    if (!confirmed || !targets.length) return;
    if (!window.confirm(`Permanently delete ${targets.length} clearly labelled acceptance/test fixture${targets.length === 1 ? '' : 's'}? Existing history and sync records will retain the deletion event.`)) return;
    for (const item of targets) await deleteLocalRecord(item.entityId);
    setMessage(`${targets.length} labelled fixture${targets.length === 1 ? '' : 's'} deleted through the normal history and sync path.`);
    setSelected([]); setConfirmed(false); refresh();
  }

  return <div className="fixture-review">
    <p className="focus-copy"><AlertTriangle size={16}/> Only records with explicit acceptance/test wording are shown. ZeusTek never deletes them automatically.</p>
    {items.length ? <div className="fixture-list">{items.map((item) => <label key={`${item.kind}:${item.entityId}`}><input type="checkbox" checked={selected.includes(item.entityId)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.entityId] : current.filter((id) => id !== item.entityId))}/><span><b>{item.title}</b><small>{item.kind} · {item.reason}{item.modifiedAt ? ` · ${new Date(item.modifiedAt).toLocaleString('en-GB')}` : ''}</small></span><button type="button" className="focus-secondary danger" disabled={!confirmed} onClick={(event) => { event.preventDefault(); void remove([item]); }} aria-label={`Delete labelled fixture ${item.title}`}><Trash2 size={15}/>Delete</button></label>)}</div> : <p className="focus-copy">No clearly labelled acceptance or test fixtures were found.</p>}
    <label className="fixture-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}/> I confirm I am reviewing labelled test fixtures, not ordinary owner records.</label>
    <div className="record-actions"><button type="button" className="focus-secondary" onClick={refresh}><RefreshCw size={15}/>Scan again</button><button type="button" className="focus-secondary danger" disabled={!confirmed || !selected.length} onClick={() => void remove(items.filter((item) => selected.includes(item.entityId)))}><Trash2 size={15}/>Delete selected ({selected.length})</button></div>
    {message && <output className="focus-notice">{message}</output>}
  </div>;
}
