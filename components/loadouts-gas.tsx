'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Cylinder,
  FlaskConical,
  Gauge,
  Pencil,
  Plus,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LoadoutDetail } from './gear/loadout-detail';
import { loadoutSlotChoices } from '../lib/gear/loadout-slot-choices';
import { AccessibleDialog } from './accessible-dialog';
import { RecordEditorWorkspace } from './shared/record-editor-workspace';
import { ZeusTekIcon } from './zeustek-icon';
import { ZeusTekAssetIcon } from './brand/zeustek-asset-icon';
import { MediaGallery } from './media-gallery';
import { useRecordRefresh } from './record-status';
import {
  deleteEquipmentSet,
  DEFAULT_GEAR_MANUFACTURERS,
  listDiveTrips,
  listCatalogOptions,
  listEquipment,
  listEquipmentSets,
  listPeople,
  type DiveTripRecord,
  type CatalogOptionRecord,
  type EquipmentRecord,
  type PersonRecord,
  type Stored,
} from '../lib/offline/dive-planning';
import { listDives, type DiveRecord } from '../lib/offline/dives';
import {
  LOADOUT_SLOT_DEFINITIONS,
  applyReusableLoadout,
  cloneReusableLoadout,
  deleteCylinder,
  deriveCylinderInspectionSchedule,
  deriveCylinderCurrentState,
  gasMixLabel,
  isCylinderEquipment,
  listCylinderInventory,
  listCylinderFills,
  listGasAnalyses,
  maximumOperatingDepthM,
  normaliseReusableLoadout,
  recordCylinderGasUsage,
  saveCylinderFill,
  saveCylinderProfile,
  saveGasAnalysis,
  saveReusableLoadout,
  validateReusableLoadout,
  type CylinderEquipmentRecord,
  type CylinderFillRecord,
  type GasAnalysisRecord,
  type LoadoutSlots,
  type LoadoutTargetKind,
  type ReusableLoadoutInput,
  type ReusableLoadoutRecord,
} from '../lib/offline/loadouts-gas';
import styles from './loadouts-gas.module.css';
import { CYLINDER_COLUMNS, CYLINDER_COLUMN_LABELS, DEFAULT_CYLINDER_COLUMNS, normaliseCylinderColumns, type CylinderColumn } from '../lib/cylinders/cylinder-column-preferences';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string | undefined }) {
  return <section className={`focus-card ${className}`}>{children}</section>;
}

function localDateTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function asFraction(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number / 100 : null;
}

function percent(value: number | null | undefined) {
  return value == null ? '—' : `${(value * 100).toFixed(value * 100 % 1 ? 1 : 0)}%`;
}

function itemLabel(item: Stored<EquipmentRecord>) {
  return [item.name, item.manufacturer, item.model].filter(Boolean).join(' · ');
}

function monthOnly(value?: string | null) {
  return value?.match(/^\d{4}-\d{2}/)?.[0] ?? '';
}

function displayMonth(value?: string | null) {
  const month = monthOnly(value);
  if (!month) return '—';
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
}

function slotSelectedIds(value: LoadoutSlots[string] | undefined) {
  return Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [];
}

function withMissingEquipment(options: Array<Stored<EquipmentRecord>>, selectedIds: string[]) {
  const missing = selectedIds.filter(id => !options.some(item => item.entityId === id));
  return [...options, ...missing.map(entityId => ({
    entityId, name: 'Unavailable saved item', category: 'Unknown', manufacturer: '', model: '',
    serialNumber: '', purchasedAt: '', lastServiceAt: '', nextServiceAt: '', notes: '',
    retired: false, createdAt: '', modifiedAt: '',
  }))];
}

function LoadoutsGasWorkspace({ initialTab }: { initialTab: 'loadouts' | 'cylinders' }) {
  const tab = initialTab;
  const [equipment, setEquipment] = useState<Array<Stored<EquipmentRecord>>>([]);
  const [loadouts, setLoadouts] = useState<Array<Stored<ReusableLoadoutRecord>>>([]);
  const [viewingLoadout, setViewingLoadout] = useState<Stored<ReusableLoadoutRecord> | null>(null);
  const openedLoadout = useRef('');
  useEffect(() => {
    if (tab !== 'loadouts') return;
    const id = new URLSearchParams(window.location.search).get('loadoutId');
    if (!id || openedLoadout.current === id) return;
    const match = loadouts.find(item => item.entityId === id);
    if (match) { const frame=requestAnimationFrame(()=>{openedLoadout.current=id;setViewingLoadout(match);});return()=>cancelAnimationFrame(frame); }
  }, [loadouts, tab]);
  const [fills, setFills] = useState<Array<Stored<CylinderFillRecord>>>([]);
  const [analyses, setAnalyses] = useState<Array<Stored<GasAnalysisRecord>>>([]);
  const [people, setPeople] = useState<Array<Stored<PersonRecord>>>([]);
  const [plans, setPlans] = useState<Array<Stored<DiveTripRecord>>>([]);
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>([]);
  const [editing, setEditing] = useState<Stored<ReusableLoadoutRecord> | null | undefined>(undefined);
  const [applying, setApplying] = useState<Stored<ReusableLoadoutRecord> | null>(null);
  const [cylinder, setCylinder] = useState<Stored<CylinderEquipmentRecord> | null>(null);
  const [editingCylinder, setEditingCylinder] = useState<Stored<CylinderEquipmentRecord> | null | undefined>(undefined);
  const [cylinders, setCylinders] = useState<Array<Stored<CylinderEquipmentRecord>>>([]);
  const [query, setQuery] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<CylinderColumn[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_CYLINDER_COLUMNS;
    try { return normaliseCylinderColumns(JSON.parse(localStorage.getItem('zeustek-cylinder-columns') ?? 'null') as string[] | null); }
    catch { return DEFAULT_CYLINDER_COLUMNS; }
  });
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('zeustek-cylinder-columns', JSON.stringify(visibleColumns)); }, [visibleColumns]);

  const refresh = useCallback(async () => {
    const [gear, cylinderRows, sets, fillRows, analysisRows, persons, planRows, diveRows] = await Promise.all([
      listEquipment(), listCylinderInventory(), listEquipmentSets(), listCylinderFills(), listGasAnalyses(), listPeople(), listDiveTrips(), listDives(),
    ]);
    setEquipment(gear);
    setCylinders(cylinderRows);
    setLoadouts(sets.map((set) => normaliseReusableLoadout(set as Stored<ReusableLoadoutRecord>)));
    setFills(fillRows); setAnalyses(analysisRows); setPeople(persons); setPlans(planRows); setDives(diveRows);
  }, []);
  useRecordRefresh(refresh);

  const loadoutEquipment = useMemo<Array<Stored<EquipmentRecord>>>(() => {
    const cylinderIds = new Set(cylinders.map((item) => item.entityId));
    return [...equipment.filter((item) => !isCylinderEquipment(item) && !cylinderIds.has(item.entityId)), ...cylinders];
  }, [cylinders, equipment]);
  const normalQuery = query.trim().toLocaleLowerCase('en-GB');
  const visibleLoadouts = loadouts.filter((item) =>
    !normalQuery || `${item.name} ${item.description ?? ''} ${item.intendedUse ?? ''} ${(item.environmentTags ?? []).join(' ')}`.toLocaleLowerCase('en-GB').includes(normalQuery),
  );
  const visibleCylinders = cylinders.filter((item) =>
    !normalQuery || `${item.name} ${item.manufacturer} ${item.model} ${item.serialNumber}`.toLocaleLowerCase('en-GB').includes(normalQuery),
  );

  async function removeLoadout(item: Stored<ReusableLoadoutRecord>) {
    if (!window.confirm(`Delete reusable loadout “${item.name}”? Equipment items and historical Dive/Plan references are not deleted.`)) return;
    await deleteEquipmentSet(item.entityId);
    await refresh();
  }

  async function removeCylinder(item: Stored<CylinderEquipmentRecord>) {
    const dependencies = fills.filter((row) => row.cylinderEquipmentId === item.entityId).length + analyses.filter((row) => row.cylinderEquipmentId === item.entityId).length;
    if (dependencies) {
      window.alert(`This cylinder has ${dependencies} linked fill/analysis record(s). Remove or retain that history before deleting the cylinder.`);
      return;
    }
    if (!window.confirm(`Delete cylinder “${item.name}”? No Dive records will be deleted.`)) return;
    await deleteCylinder(item.entityId);
    setCylinder(null);
    await refresh();
  }

  // A record editor owns the route while its draft is open. Keeping the cards
  // interactive here would let a second record replace `item` without resetting
  // the editor's draft, so a subsequent save could overwrite the first record.
  if (editing !== undefined) return <LoadoutEditor key={editing?.entityId ?? 'new-loadout'} item={editing} equipment={loadoutEquipment} close={() => setEditing(undefined)} saved={refresh} />;
  if (editingCylinder !== undefined) return <CylinderEditor key={editingCylinder?.entityId ?? 'new-cylinder'} item={editingCylinder} close={() => setEditingCylinder(undefined)} saved={refresh} />;

  return <>
    <header className={styles.heading}>
      <div className={styles.iconHeading}><ZeusTekAssetIcon name={tab === 'loadouts' ? 'core-logbook-icons-equipment' : 'core-logbook-icons-dive-cylinder'} size={48} fallback={<ZeusTekIcon id={tab === 'loadouts' ? 'equipment' : 'dive-cylinder'} size="heading"/>}/><div><span className="focus-eyebrow">GEAR</span><h1>{tab === 'loadouts' ? 'Reusable Loadouts' : 'Cylinders & Gas'}</h1><p>{tab === 'loadouts' ? 'Build reusable configurations from canonical Equipment references. Cylinder fills and analyses live in their own workspace.' : 'Review physical cylinders in one table, then open a row for service, fill, analysis, media and history.'}</p></div></div>
      {tab === 'loadouts' ? <button className="focus-primary" onClick={() => setEditing(null)}><Plus size={17}/>New loadout</button> : <button className="focus-primary" onClick={() => setEditingCylinder(null)}><Plus size={17}/>Add cylinder</button>}
    </header>

    <div className={styles.tabs}>
      <label className={styles.search}>Search<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === 'loadouts' ? 'Search loadouts' : 'Search cylinders'} /></label>
      {tab === 'cylinders' && <details className={styles.columnChooser}><summary>Cylinder table columns</summary><div>{CYLINDER_COLUMNS.map((column) => <label key={column}><input type="checkbox" checked={visibleColumns.includes(column)} onChange={(event) => setVisibleColumns((current) => {
        const next = event.target.checked ? normaliseCylinderColumns([...current, column]) : current.filter((value) => value !== column);
        return next.length ? next : current;
      })}/>{CYLINDER_COLUMN_LABELS[column]}</label>)}</div></details>}
    </div>

    {tab === 'loadouts' ? <div className={styles.grid}>
      {visibleLoadouts.map((item) => {
        const validation = validateReusableLoadout(item, loadoutEquipment);
        return <Card key={item.entityId} className={styles.loadoutCard}>
          <div className={styles.cardActions}><button className="focus-icon" title="Clone loadout" aria-label={`Clone ${item.name}`} onClick={() => void cloneReusableLoadout(item).then(refresh)}><Copy size={16}/></button><button className="focus-icon" aria-label={`Edit ${item.name}`} onClick={() => setEditing(item)}><Pencil size={16}/></button><button className="focus-icon danger" aria-label={`Delete ${item.name}`} onClick={() => void removeLoadout(item)}><Trash2 size={16}/></button></div>
          <span className="focus-eyebrow">{item.intendedUse || 'REUSABLE LOADOUT'}</span><h2 className={styles.iconTitle}><ZeusTekIcon id={item.intendedUse?.toLowerCase().includes('sidemount') ? 'sidemount' : item.intendedUse?.toLowerCase().includes('twin') ? 'twinset' : item.intendedUse?.toLowerCase().includes('rebreather') || item.intendedUse?.toLowerCase().includes('ccr') ? 'ccr-rebreather' : 'equipment'} size="card"/><button className={styles.loadoutTitle} onClick={() => setViewingLoadout(item)}>{item.name}</button></h2><p>{item.description || item.notes || 'No description recorded.'}</p>
          <div className={styles.chips}><span>{validation.referencedItemCount} items</span>{(item.environmentTags ?? []).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
          {validation.warnings.length ? <div className={styles.warning}><AlertTriangle size={16}/><span>{validation.warnings[0]}</span></div> : <div className={styles.ok}><CheckCircle2 size={16}/><span>All referenced items available</span></div>}
          <button className="focus-secondary" onClick={() => setViewingLoadout(item)}>View {item.name}</button>
          <button className="focus-primary" onClick={() => setApplying(item)}>Apply to Dive / Plan</button>
        </Card>;
      })}
      {!visibleLoadouts.length && <Card className="focus-empty"><Wrench size={30}/><h2>{loadouts.length ? 'No matching loadouts' : 'No reusable loadouts yet'}</h2><p>Existing Equipment Sets remain compatible. Open one to assign semantic slots, or create a new loadout.</p><button className="focus-primary" onClick={() => setEditing(null)}>Create loadout</button></Card>}
    </div> : <Card className={styles.tableCard}>
      {visibleCylinders.length ? <div className={styles.tableWrap}><table className={styles.cylinderTable}>
        <thead><tr>{visibleColumns.map((column) => <th key={column}>{CYLINDER_COLUMN_LABELS[column]}</th>)}</tr></thead>
        <tbody>{visibleCylinders.map((item) => {
          const itemFills = fills.filter((fill) => fill.cylinderEquipmentId === item.entityId);
          const state = deriveCylinderCurrentState(item, itemFills, analyses.filter((analysis) => analysis.cylinderEquipmentId === item.entityId));
          const fill = state.latestFill;
          const analysis = state.currentAnalysis ?? state.latestAnyAnalysis;
          const schedule = deriveCylinderInspectionSchedule(item);
          const nextTest = [schedule.hydroDueAt, schedule.visualDueAt, monthOnly(item.oxygenCleanUntil)].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)))[0] ?? null;
          return <tr key={item.entityId} tabIndex={0} onClick={() => setCylinder(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setCylinder(item); } }} aria-label={`Open ${item.name} cylinder details`}>
            {visibleColumns.includes('id') && <td>{item.cylinderNumber || '—'}</td>}
            {visibleColumns.includes('serial') && <td>{item.serialNumber || '—'}</td>}
            {visibleColumns.includes('gas') && <td>{state.declaredMixLabel}</td>}
            {visibleColumns.includes('oxygen') && <td>{analysis?.oxygenFraction == null ? '—' : Math.round(analysis.oxygenFraction * 100)}</td>}
            {visibleColumns.includes('helium') && <td>{analysis?.heliumFraction == null ? '—' : Math.round(analysis.heliumFraction * 100)}</td>}
            {visibleColumns.includes('pressure') && <td>{fill?.pressureBar ?? '—'}</td>}
            {visibleColumns.includes('volume') && <td>{item.waterVolumeLiters ?? '—'}</td>}
            {visibleColumns.includes('oxygenClean') && <td>{item.oxygenClean ? 'Yes' : 'No'}</td>}
            {visibleColumns.includes('analysis') && <td className={state.analysisState === 'current' ? styles.current : styles.stale}>{state.analysisState}</td>}
            {visibleColumns.includes('lastFill') && <td>{fill?.filledAt ? new Date(fill.filledAt).toLocaleDateString() : '—'}</td>}
            {visibleColumns.includes('fillLocation') && <td>{fill?.provider || '—'}</td>}
            {visibleColumns.includes('valve') && <td>{item.valveType || '—'}</td>}
            {visibleColumns.includes('nextTest') && <td>{displayMonth(nextTest)}</td>}
          </tr>;
        })}</tbody>
      </table></div> : <div className="focus-empty"><Cylinder size={30}/><h2>No cylinders found</h2><p>Add and manage physical cylinders here. Equipment is reserved for non-cylinder gear.</p><button className="focus-primary" onClick={() => setEditingCylinder(null)}>Add first cylinder</button></div>}
      <div className={styles.serviceDefaults}><b>Service defaults</b><span>Hydro: 5 years</span><span>Visual: 30 months</span><span>O₂ clean/inspection: optional 12–15 months</span></div>
    </Card>}

    {viewingLoadout && <LoadoutDetail item={viewingLoadout} equipment={loadoutEquipment} close={() => setViewingLoadout(null)} edit={() => { setEditing(viewingLoadout); setViewingLoadout(null); }} />}
    {applying && <ApplyLoadoutDialog loadout={applying} equipment={loadoutEquipment} plans={plans} dives={dives} close={() => setApplying(null)} saved={refresh} />}
    {cylinder && <CylinderDetail item={cylinder} fills={fills.filter((fill) => fill.cylinderEquipmentId === cylinder.entityId)} analyses={analyses.filter((analysis) => analysis.cylinderEquipmentId === cylinder.entityId)} people={people} close={() => setCylinder(null)} edit={() => { setEditingCylinder(cylinder); setCylinder(null); }} remove={() => void removeCylinder(cylinder)} saved={async () => { await refresh(); const latest = (await listCylinderInventory()).find((item) => item.entityId === cylinder.entityId); if (latest) setCylinder(latest); }} />}
  </>;
}

export function Loadouts() {
  return <LoadoutsGasWorkspace initialTab="loadouts" />;
}

export function CylindersGas() {
  return <LoadoutsGasWorkspace initialTab="cylinders" />;
}

/** @deprecated Kept for source compatibility; navigation now exposes separate workspaces. */
export function LoadoutsGas() {
  return <Loadouts />;
}

function LoadoutEditor({ item, equipment, close, saved }: { item: Stored<ReusableLoadoutRecord> | null; equipment: Array<Stored<EquipmentRecord>>; close: () => void; saved: () => Promise<void> | void }) {
  const initial = item ? normaliseReusableLoadout(item) : null;
  const [value, setValue] = useState<ReusableLoadoutInput>({
    ...(initial ? { entityId: initial.entityId } : {}),
    name: initial?.name ?? '', description: initial?.description ?? '', intendedUse: initial?.intendedUse ?? '', environmentTags: initial?.environmentTags ?? [],
    slots: initial?.slots ?? {}, cameraVideoItemIds: initial?.cameraVideoItemIds ?? [], otherItemIds: initial?.otherItemIds ?? [], notes: initial?.notes ?? '', ...(initial?.iconMediaId ? { iconMediaId: initial.iconMediaId } : {}),
  });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const groups = [...new Set(LOADOUT_SLOT_DEFINITIONS.map((definition) => definition.group))];
  const setSlot = (key: string, next: string | string[]) => setValue((current) => ({ ...current, slots: { ...current.slots, [key]: next } }));
  async function submit() {
    if (!value.name.trim()) return; setBusy(true); setError('');
    try { await saveReusableLoadout(value); await saved(); close(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Loadout could not be saved.'); }
    finally { setBusy(false); }
  }
  return <RecordEditorWorkspace label={item ? `Edit ${item.name}` : 'Create reusable loadout'} close={close} save={submit} busy={busy} saveLabel="Save loadout" saveDisabled={!value.name.trim()} value={value} trackInteractions={false} contentClassName={styles.editor}>
    <div><span className="focus-eyebrow">REUSABLE LOADOUT</span><h2>{item ? 'Edit loadout' : 'New loadout'}</h2><p>Equipment descriptions are not copied; slots store canonical Equipment IDs.</p></div>
      <fieldset disabled={busy}><div className={styles.editorTop}><label>Name<input required value={value.name} onChange={(event) => setValue((current) => ({ ...current, name: event.target.value }))}/></label><label>Intended use<input value={value.intendedUse ?? ''} onChange={(event) => setValue((current) => ({ ...current, intendedUse: event.target.value }))} placeholder="Cold water recreational, Tec, Travel…"/></label><label className={styles.span2}>Description<textarea value={value.description ?? ''} onChange={(event) => setValue((current) => ({ ...current, description: event.target.value }))}/></label><label className={styles.span2}>Environment tags<input value={(value.environmentTags ?? []).join(', ')} onChange={(event) => setValue((current) => ({ ...current, environmentTags: event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean) }))} placeholder="Cold water, UK, Drysuit"/></label></div>
      <div className={styles.slotGroups}>{groups.map((group) => <section key={group}><h3>{group}</h3>{LOADOUT_SLOT_DEFINITIONS.filter((definition) => definition.group === group).map((definition) => {
        const selected = slotSelectedIds(value.slots[definition.key]);
        const options = withMissingEquipment(loadoutSlotChoices(definition, equipment, selected), selected);
        return <label key={definition.key}>{definition.label}{definition.multiple ? <select multiple value={selected} size={Math.min(5, Math.max(2, options.length))} onChange={(event) => setSlot(definition.key, Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}>{options.map((gear) => <option key={gear.entityId} value={gear.entityId}>{itemLabel(gear)}{gear.retired ? ' — retired' : ''}</option>)}</select> : <select value={selected[0] ?? ''} onChange={(event) => setSlot(definition.key, event.target.value)}><option value="">Not assigned</option>{options.map((gear) => <option key={gear.entityId} value={gear.entityId}>{itemLabel(gear)}{gear.retired ? ' — retired' : ''}</option>)}</select>}</label>;
      })}</section>)}</div><label>Notes<textarea value={value.notes ?? ''} onChange={(event) => setValue((current) => ({ ...current, notes: event.target.value }))}/></label></fieldset>
      {error && <p role="alert" className="dive-save-error">{error}</p>}
  </RecordEditorWorkspace>;
}

function ApplyLoadoutDialog({ loadout, equipment, plans, dives, close, saved }: { loadout: Stored<ReusableLoadoutRecord>; equipment: Array<Stored<EquipmentRecord>>; plans: Array<Stored<DiveTripRecord>>; dives: Array<DiveRecord & { entityId: string }>; close: () => void; saved: () => Promise<void> | void }) {
  const normalised = normaliseReusableLoadout(loadout);
  const [kind, setKind] = useState<LoadoutTargetKind>('trip'); const [targetId, setTargetId] = useState(''); const [overrides, setOverrides] = useState<LoadoutSlots>({}); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const targets = kind === 'trip' ? plans.map((plan) => ({ id: plan.entityId, label: `${plan.name} · ${plan.startDate || 'no date'}` })) : dives.map((dive) => ({ id: dive.entityId, label: `${dive.date} · ${dive.site || 'Dive'}` }));
  async function apply() { if (!targetId) return; setBusy(true); setMessage('Applying locally…'); try { await applyReusableLoadout(kind, targetId, loadout, overrides); await saved(); close(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Loadout could not be applied.'); } finally { setBusy(false); } }
  return <div className="focus-modal-bg"><AccessibleDialog editable label={`Apply ${loadout.name}`} className={`focus-modal ${styles.applyDialog}`} close={() => { if (!busy) close(); }}><header><div><span className="focus-eyebrow">LOADOUT ASSIGNMENT</span><h2>Apply {loadout.name}</h2><p>The target receives stable equipment IDs plus this loadout reference. Later loadout edits do not rewrite the applied historical item IDs.</p></div><button className="focus-icon" data-dialog-close aria-label="Close apply dialog" onClick={close}><X/></button></header>
    <fieldset disabled={busy}><div className={styles.editorTop}><label>Target type<select value={kind} onChange={(event) => { setKind(event.target.value as LoadoutTargetKind); setTargetId(''); }}><option value="trip">Dive Plan</option><option value="dive">Logged Dive</option></select></label><label>Target<select required value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Choose {kind === 'trip' ? 'Plan' : 'Dive'}</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label></div>
      <section><h3>Per-instance overrides</h3><p className="focus-copy">Leave “Use loadout selection” to keep the saved slot. Choosing another item changes this application only.</p><div className={styles.overrideGrid}>{LOADOUT_SLOT_DEFINITIONS.filter((definition) => !definition.multiple && slotSelectedIds(normalised.slots?.[definition.key]).length).map((definition) => { const baseId = slotSelectedIds(normalised.slots?.[definition.key])[0]!; const base = equipment.find((item) => item.entityId === baseId); const options = withMissingEquipment(loadoutSlotChoices(definition, equipment, [baseId]), [baseId]); return <label key={definition.key}>{definition.label}<select value={typeof overrides[definition.key] === 'string' ? String(overrides[definition.key]) : overrides[definition.key] === null ? '__clear' : '__base'} onChange={(event) => setOverrides((current) => ({ ...current, [definition.key]: event.target.value === '__base' ? baseId : event.target.value === '__clear' ? null : event.target.value }))}><option value="__base">Use loadout selection — {base?.name ?? 'saved item'}</option><option value="__clear">No item for this application</option>{options.filter((option) => option.entityId !== baseId).map((option) => <option key={option.entityId} value={option.entityId}>{itemLabel(option)}</option>)}</select></label>; })}</div></section>
    </fieldset>{message && <p role={message.includes('could not') ? 'alert' : 'status'}>{message}</p>}<footer><button className="focus-secondary" data-dialog-close onClick={close}>Cancel</button><button className="focus-primary" disabled={!targetId || busy} onClick={() => void apply()}>{busy ? 'Applying…' : 'Apply loadout'}</button></footer>
  </AccessibleDialog></div>;
}

function CylinderEditor({ item, close, saved }: { item: Stored<CylinderEquipmentRecord> | null; close: () => void; saved: () => Promise<void> | void }) {
  const lastStamp = item?.hydroTestStamps?.at(-1);
  const existingSchedule = deriveCylinderInspectionSchedule(item ?? {});
  const inferredLastTestType = item?.lastTestType ?? (monthOnly(item?.visualTestAt ?? item?.visualInspection?.inspectedAt) > monthOnly(existingSchedule.latestHydro) ? 'visual' : existingSchedule.latestHydro ? 'hydro' : 'visual');
  const inferredLastTestAt = monthOnly(item?.lastTestAt) || (inferredLastTestType === 'hydro' ? monthOnly(existingSchedule.latestHydro) : monthOnly(existingSchedule.latestVisualQualifyingTest));
  const [value, setValue] = useState({
    name: item?.name ?? '', manufacturer: item?.manufacturer ?? '', model: item?.model ?? '', serialNumber: item?.serialNumber ?? '', threadType: item?.threadType ?? 'M25 x 2', countryCode: item?.countryCode ?? '', cylinderMaterial: item?.cylinderMaterial ?? '', waterVolumeLiters: item?.waterVolumeLiters == null ? '' : String(item.waterVolumeLiters), emptyWeightKg: item?.emptyWeightKg == null ? (item?.tareKg == null ? '' : String(item.tareKg)) : String(item.emptyWeightKg), wallThicknessMm: item?.wallThicknessMm == null ? '' : String(item.wallThicknessMm), workingPressureBar: item?.workingPressureBar == null ? '' : String(item.workingPressureBar), testPressureBar: item?.testPressureBar == null ? '' : String(item.testPressureBar), birthDate: monthOnly(item?.birthDate), valveType: item?.valveType === 'A-CLAMP' ? 'A-CLAMP' : 'DIN', owner: item?.owner ?? '', cylinderStatus: item?.cylinderStatus ?? 'active', notes: item?.notes ?? '', hydroStampFacility: lastStamp?.facility ?? '', hydroStampMark: lastStamp?.stampMark ?? '', lastTestType: inferredLastTestType, lastTestAt: inferredLastTestAt, visualStickerColour: item?.visualInspection?.stickerColour ?? 'Blue quadrant sticker', oxygenClean: Boolean(item?.oxygenClean), oxygenCleanUntil: monthOnly(item?.oxygenCleanUntil),
  });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [catalogOptions, setCatalogOptions] = useState<Array<Stored<CatalogOptionRecord>>>([]);
  useEffect(() => { void listCatalogOptions().then(setCatalogOptions); }, []);
  const manufacturers = [...new Set([...DEFAULT_GEAR_MANUFACTURERS, ...catalogOptions.filter((option) => option.group === 'manufacturer').map((option) => option.value), ...(value.manufacturer ? [value.manufacturer] : [])])].sort();
  const field = (name: keyof typeof value, next: string | boolean) => setValue((current) => ({ ...current, [name]: next }));
  async function submit() {
    setBusy(true); setError('');
    try {
      const priorStamps = item?.hydroTestStamps ?? [];
      const hydroChanged = value.lastTestType === 'hydro' && (value.lastTestAt !== monthOnly(lastStamp?.testedAt) || value.hydroStampFacility !== (lastStamp?.facility ?? '') || value.hydroStampMark !== (lastStamp?.stampMark ?? ''));
      const nextStamps = hydroChanged && value.lastTestAt ? [...priorStamps, { facility: value.hydroStampFacility, testedAt: value.lastTestAt, stampMark: value.hydroStampMark }] : priorStamps;
      await saveCylinderProfile({ ...(item ? { entityId: item.entityId, recordStorageKind: item.recordStorageKind, cylinderNumber: item.cylinderNumber } : {}), name: value.name, manufacturer: value.manufacturer, model: value.model, serialNumber: value.serialNumber, threadType: value.threadType, countryCode: value.countryCode, cylinderMaterial: value.cylinderMaterial, waterVolumeLiters: value.waterVolumeLiters ? Number(value.waterVolumeLiters) : null, emptyWeightKg: value.emptyWeightKg ? Number(value.emptyWeightKg) : null, wallThicknessMm: value.wallThicknessMm ? Number(value.wallThicknessMm) : null, workingPressureBar: value.workingPressureBar ? Number(value.workingPressureBar) : null, testPressureBar: value.testPressureBar ? Number(value.testPressureBar) : null, birthDate: value.birthDate || null, valveType: value.valveType, owner: value.owner, cylinderStatus: value.cylinderStatus as NonNullable<CylinderEquipmentRecord['cylinderStatus']>, notes: value.notes, retired: value.cylinderStatus === 'retired', lastTestType: value.lastTestType, lastTestAt: value.lastTestAt || null, hydroTestAt: value.lastTestType === 'hydro' ? value.lastTestAt || null : item?.hydroTestAt ?? null, hydroTestStamps: nextStamps, visualTestAt: value.lastTestAt || null, visualInspection: { ...item?.visualInspection, inspectedAt: value.lastTestAt || null, stickerColour: value.visualStickerColour, notes: value.lastTestType === 'hydro' ? 'Hydro test includes the visual inspection for this cycle.' : 'Visual inspection evidence is recorded by sticker, not neck stamp.' }, oxygenClean: value.oxygenClean, oxygenCleanUntil: value.oxygenCleanUntil || null });
      await saved(); close();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cylinder could not be saved.'); } finally { setBusy(false); }
  }
  return <RecordEditorWorkspace label={item ? `Edit ${item.name}` : 'Add cylinder'} close={close} save={submit} busy={busy} saveLabel="Save cylinder" saveDisabled={!value.name.trim()} value={value} trackInteractions={false} contentClassName={styles.cylinderDetail}><div><span className="focus-eyebrow">CYLINDER DATABASE</span><h2>{item ? 'Edit cylinder' : 'Add cylinder'}</h2><p>Physical identity, stamped specifications and inspection evidence.</p></div>
    <details open><summary>Identity &amp; construction</summary><div className={styles.editorTop}><label>ID #<input value={item?.cylinderNumber ?? 'Assigned automatically on save'} disabled/></label><label>Serial number (S/N)<input value={value.serialNumber} onChange={(event) => field('serialNumber', event.target.value)}/></label><label>Name<input required value={value.name} onChange={(event) => field('name', event.target.value)} placeholder="12L steel backgas"/></label><label>Manufacturer<select value={value.manufacturer} onChange={(event) => field('manufacturer', event.target.value)}><option value="">Choose manufacturer</option>{manufacturers.map((manufacturer) => <option key={manufacturer} value={manufacturer}>{manufacturer}</option>)}</select></label><label>Model<input value={value.model} onChange={(event) => field('model', event.target.value)}/></label><label>Neck thread<input value={value.threadType} onChange={(event) => field('threadType', event.target.value)} placeholder="M25 x 2"/></label><label>Country code<input value={value.countryCode} onChange={(event) => field('countryCode', event.target.value)} placeholder="UK"/></label><label>Material / alloy<input value={value.cylinderMaterial} onChange={(event) => field('cylinderMaterial', event.target.value)} placeholder="Steel / AA6061 T6"/></label><label>Birth date (month / year)<input type="month" value={value.birthDate} onChange={(event) => field('birthDate', event.target.value)}/></label><label>Water capacity (L)<input type="number" min="0" step="0.1" value={value.waterVolumeLiters} onChange={(event) => field('waterVolumeLiters', event.target.value)}/></label><label>Empty weight (kg)<input type="number" min="0" step="0.1" value={value.emptyWeightKg} onChange={(event) => field('emptyWeightKg', event.target.value)}/></label><label>Minimum wall thickness (mm)<input type="number" min="0" step="0.1" value={value.wallThicknessMm} onChange={(event) => field('wallThicknessMm', event.target.value)}/></label><label>Valve type<select value={value.valveType} onChange={(event) => field('valveType', event.target.value)}><option value="DIN">DIN</option><option value="A-CLAMP">A-CLAMP</option></select></label></div></details>
    <details open><summary>Pressure ratings</summary><div className={styles.editorTop}><label>PW working pressure (bar)<input type="number" min="0" value={value.workingPressureBar} onChange={(event) => field('workingPressureBar', event.target.value)} placeholder="232"/></label><label>PT test pressure (bar)<input type="number" min="0" value={value.testPressureBar} onChange={(event) => field('testPressureBar', event.target.value)} placeholder="348"/></label></div></details>
    <details open><summary>Manufacturing &amp; inspection evidence</summary><div className={styles.editorTop}><label>Latest test type<select value={value.lastTestType} onChange={(event) => field('lastTestType', event.target.value)}><option value="hydro">Hydro + visual</option><option value="visual">Visual inspection</option></select></label><label>Latest test (month / year)<input type="month" value={value.lastTestAt} onChange={(event) => field('lastTestAt', event.target.value)}/></label><label>Test facility / logo<input value={value.hydroStampFacility} onChange={(event) => field('hydroStampFacility', event.target.value)}/></label><label>Hydro stamp mark<input value={value.hydroStampMark} onChange={(event) => field('hydroStampMark', event.target.value)} placeholder="Facility mark / 25-08" disabled={value.lastTestType !== 'hydro'}/></label><label>Visual sticker evidence<input value={value.visualStickerColour} onChange={(event) => field('visualStickerColour', event.target.value)} placeholder="Blue quadrant sticker"/></label><label>Hydro due (automatic)<input value={displayMonth(deriveCylinderInspectionSchedule({ ...item, lastTestType: value.lastTestType, lastTestAt: value.lastTestAt, hydroTestAt: value.lastTestType === 'hydro' ? value.lastTestAt : item?.hydroTestAt ?? null }).hydroDueAt)} disabled/></label><label>Visual due (automatic)<input value={displayMonth(deriveCylinderInspectionSchedule({ ...item, lastTestType: value.lastTestType, lastTestAt: value.lastTestAt, visualTestAt: value.lastTestAt }).visualDueAt)} disabled/></label><label><input type="checkbox" checked={value.oxygenClean} onChange={(event) => field('oxygenClean', event.target.checked)}/> O₂-clean / inspected</label><label>O₂-clean until (month / year)<input type="month" value={value.oxygenCleanUntil} onChange={(event) => field('oxygenCleanUntil', event.target.value)}/></label></div><p className="focus-copy">A hydro test includes the visual inspection. Hydro is due every 60 months; visual inspection is due every 30 months from the latest qualifying Hydro or Visual test.</p></details>
    <details><summary>Ownership &amp; notes</summary><div className={styles.editorTop}><label>Owner<input value={value.owner} onChange={(event) => field('owner', event.target.value)}/></label><label>Status<select value={value.cylinderStatus} onChange={(event) => field('cylinderStatus', event.target.value)}><option value="active">Active</option><option value="service">In service</option><option value="retired">Retired</option><option value="unknown">Unknown</option></select></label><label className={styles.span2}>Notes<textarea value={value.notes} onChange={(event) => field('notes', event.target.value)}/></label></div></details>
    {error && <p role="alert" className="dive-save-error">{error}</p>}
  </RecordEditorWorkspace>;
}

function CylinderDetail({ item, fills, analyses, people, close, edit, remove, saved }: { item: Stored<CylinderEquipmentRecord>; fills: Array<Stored<CylinderFillRecord>>; analyses: Array<Stored<GasAnalysisRecord>>; people: Array<Stored<PersonRecord>>; close: () => void; edit: () => void; remove: () => void; saved: () => Promise<void> | void }) {
  const state = deriveCylinderCurrentState(item, fills, analyses);
  const schedule = deriveCylinderInspectionSchedule(item);
  const [profile, setProfile] = useState({ waterVolumeLiters: item.waterVolumeLiters == null ? '' : String(item.waterVolumeLiters), workingPressureBar: item.workingPressureBar == null ? '' : String(item.workingPressureBar), cylinderMaterial: item.cylinderMaterial ?? '', valveType: item.valveType === 'A-CLAMP' ? 'A-CLAMP' : 'DIN', oxygenClean: Boolean(item.oxygenClean), oxygenCleanUntil: monthOnly(item.oxygenCleanUntil), lastTestType: item.lastTestType ?? (monthOnly(item.visualTestAt) > monthOnly(schedule.latestHydro) ? 'visual' : 'hydro'), lastTestAt: monthOnly(item.lastTestAt) || monthOnly(schedule.latestVisualQualifyingTest), tareKg: item.tareKg == null ? '' : String(item.tareKg), owner: item.owner ?? '', cylinderStatus: item.cylinderStatus ?? 'active' });
  const [fill, setFill] = useState({ filledAt: localDateTime(), pressureBar: '', oxygenPercent: '', heliumPercent: '', provider: '', notes: '' });
  const [usage, setUsage] = useState({ recordedAt: localDateTime(), pressureUsedBar: '', remainingPressureBar: '', notes: '' });
  const [analysis, setAnalysis] = useState({ fillId: state.latestFill?.originFillId || state.latestFill?.entityId || '', analysedAt: localDateTime(), oxygenPercent: '', heliumPercent: '', analysedByPersonId: '', notes: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function saveProfile() { setBusy(true); setError(''); try { await saveCylinderProfile({ ...item, entityId: item.entityId, waterVolumeLiters: profile.waterVolumeLiters ? Number(profile.waterVolumeLiters) : null, workingPressureBar: profile.workingPressureBar ? Number(profile.workingPressureBar) : null, cylinderMaterial: profile.cylinderMaterial, valveType: profile.valveType, oxygenClean: profile.oxygenClean, oxygenCleanUntil: profile.oxygenCleanUntil || null, lastTestType: profile.lastTestType as 'hydro' | 'visual', lastTestAt: profile.lastTestAt || null, hydroTestAt: profile.lastTestType === 'hydro' ? profile.lastTestAt || null : item.hydroTestAt ?? null, visualTestAt: profile.lastTestAt || null, tareKg: profile.tareKg ? Number(profile.tareKg) : null, owner: profile.owner, cylinderStatus: profile.cylinderStatus as NonNullable<CylinderEquipmentRecord['cylinderStatus']> }); await saved(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cylinder profile could not be saved.'); } finally { setBusy(false); } }
  async function addFill(event: React.SyntheticEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); try { const result = await saveCylinderFill({ cylinderEquipmentId: item.entityId, filledAt: new Date(fill.filledAt).toISOString(), pressureBar: fill.pressureBar ? Number(fill.pressureBar) : null, oxygenFraction: asFraction(fill.oxygenPercent), heliumFraction: asFraction(fill.heliumPercent), provider: fill.provider, notes: fill.notes, source: 'recorded' }); setAnalysis((current) => ({ ...current, fillId: result.id, analysedAt: localDateTime() })); setFill({ filledAt: localDateTime(), pressureBar: '', oxygenPercent: '', heliumPercent: '', provider: '', notes: '' }); await saved(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Fill could not be saved.'); } finally { setBusy(false); } }
  async function addUsage(event: React.SyntheticEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); try { await recordCylinderGasUsage({ cylinderEquipmentId: item.entityId, recordedAt: new Date(usage.recordedAt).toISOString(), pressureUsedBar: usage.pressureUsedBar ? Number(usage.pressureUsedBar) : null, remainingPressureBar: usage.remainingPressureBar ? Number(usage.remainingPressureBar) : null, notes: usage.notes }); setUsage({ recordedAt: localDateTime(), pressureUsedBar: '', remainingPressureBar: '', notes: '' }); await saved(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Gas use could not be saved.'); } finally { setBusy(false); } }
  async function addAnalysis(event: React.SyntheticEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); try { await saveGasAnalysis({ cylinderEquipmentId: item.entityId, fillId: analysis.fillId || null, analysedAt: new Date(analysis.analysedAt).toISOString(), oxygenFraction: asFraction(analysis.oxygenPercent), heliumFraction: asFraction(analysis.heliumPercent), analysedByPersonId: analysis.analysedByPersonId || null, attachmentIds: [], notes: analysis.notes }); setAnalysis({ fillId: state.latestFill?.originFillId || state.latestFill?.entityId || '', analysedAt: localDateTime(), oxygenPercent: '', heliumPercent: '', analysedByPersonId: '', notes: '' }); await saved(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Analysis could not be saved.'); } finally { setBusy(false); } }
  async function addAnalysisMedia(row: Stored<GasAnalysisRecord>, ids: string[], removed?: string) { await saveGasAnalysis({ ...row, entityId: row.entityId, attachmentIds: [...new Set([...(row.attachmentIds ?? []), ...ids])].filter((id) => id !== removed) }); await saved(); }
  return <div className="focus-modal-bg"><AccessibleDialog editable label={`${item.name} cylinder details`} className={`focus-modal ${styles.cylinderDetail}`} close={() => { if (!busy) close(); }}><header><div><span className="focus-eyebrow">CYLINDER / GAS</span><h2>{item.name}</h2><p>{[item.manufacturer, item.model, item.serialNumber && `S/N ${item.serialNumber}`].filter(Boolean).join(' · ')}</p></div><button className="focus-icon" data-dialog-close aria-label="Close cylinder details" onClick={close}><X/></button></header>
    <section className={styles.currentState}><div><Gauge/><small>Latest fill</small><strong>{state.latestFill ? `${state.latestFill.pressureBar ?? '—'} bar` : 'None'}</strong><span>{state.declaredMixLabel}</span></div><div className={state.analysisState === 'current' ? styles.goodPanel : styles.warnPanel}><FlaskConical/><small>Analysis</small><strong>{state.analysedMixLabel}</strong><span>{state.analysisState === 'current' ? 'Explicitly linked to latest fill' : state.analysisState === 'stale' ? 'Do not treat the previous analysis as current' : 'No analysis recorded'}</span></div><div><Cylinder/><small>Approx. surface gas</small><strong>{state.approximateSurfaceLitres == null ? '—' : `${Math.round(state.approximateSurfaceLitres).toLocaleString()} L`}</strong><span>Calculated: water volume × fill pressure</span></div></section>

    <details open><summary>Stamped identity &amp; specification</summary><dl className={styles.specGrid}><div><dt>ID #</dt><dd>{item.cylinderNumber || 'Assigned automatically when loaded'}</dd></div><div><dt>Serial number (S/N)</dt><dd>{item.serialNumber || 'Not recorded'}</dd></div><div><dt>Thread type</dt><dd>{item.threadType || 'Not recorded'}</dd></div><div><dt>Country code</dt><dd>{item.countryCode || 'Not recorded'}</dd></div><div><dt>Material / alloy</dt><dd>{item.cylinderMaterial || 'Not recorded'}</dd></div><div><dt>Valve type</dt><dd>{item.valveType || 'Not recorded'}</dd></div><div><dt>Water capacity</dt><dd>{item.waterVolumeLiters == null ? 'Not recorded' : `${item.waterVolumeLiters} L`}</dd></div><div><dt>Empty weight</dt><dd>{item.emptyWeightKg == null && item.tareKg == null ? 'Not recorded' : `${item.emptyWeightKg ?? item.tareKg} kg`}</dd></div><div><dt>Minimum wall thickness</dt><dd>{item.wallThicknessMm == null ? 'Not recorded' : `${item.wallThicknessMm} mm`}</dd></div><div><dt>PW working pressure</dt><dd>{item.workingPressureBar == null ? 'Not recorded' : `${item.workingPressureBar} bar`}</dd></div><div><dt>PT test pressure</dt><dd>{item.testPressureBar == null ? 'Not recorded' : `${item.testPressureBar} bar`}</dd></div><div><dt>Birth date</dt><dd>{displayMonth(item.birthDate)}</dd></div><div><dt>Latest test</dt><dd>{item.lastTestAt ? `${item.lastTestType === 'hydro' ? 'Hydro + visual' : 'Visual'} · ${displayMonth(item.lastTestAt)}` : 'Not recorded'}</dd></div><div><dt>Hydro due</dt><dd>{displayMonth(schedule.hydroDueAt)}</dd></div><div><dt>Visual due</dt><dd>{displayMonth(schedule.visualDueAt)}</dd></div><div><dt>Visual evidence</dt><dd>{item.visualInspection?.stickerColour || 'Not recorded'}</dd></div><div><dt>Record source</dt><dd>{item.recordStorageKind === 'equipment' ? 'Legacy Equipment cylinder · compatible' : 'Cylinders & Gas table'}</dd></div></dl></details>

    <details><summary>Physical cylinder profile</summary><div className={styles.editorTop}><label>Water volume (L)<input inputMode="decimal" value={profile.waterVolumeLiters} onChange={(e) => setProfile((v) => ({ ...v, waterVolumeLiters: e.target.value }))}/></label><label>Working pressure (bar)<input inputMode="decimal" value={profile.workingPressureBar} onChange={(e) => setProfile((v) => ({ ...v, workingPressureBar: e.target.value }))}/></label><label>Material<input value={profile.cylinderMaterial} onChange={(e) => setProfile((v) => ({ ...v, cylinderMaterial: e.target.value }))}/></label><label>Valve type<select value={profile.valveType} onChange={(e) => setProfile((v) => ({ ...v, valveType: e.target.value }))}><option value="DIN">DIN</option><option value="A-CLAMP">A-CLAMP</option></select></label><label>Tare (kg)<input inputMode="decimal" value={profile.tareKg} onChange={(e) => setProfile((v) => ({ ...v, tareKg: e.target.value }))}/></label><label>Owner<input value={profile.owner} onChange={(e) => setProfile((v) => ({ ...v, owner: e.target.value }))}/></label><label><input type="checkbox" checked={profile.oxygenClean} onChange={(e) => setProfile((v) => ({ ...v, oxygenClean: e.target.checked }))}/> O₂-clean</label><label>O₂-clean until<input type="month" value={profile.oxygenCleanUntil} onChange={(e) => setProfile((v) => ({ ...v, oxygenCleanUntil: e.target.value }))}/></label><label>Latest test type<select value={profile.lastTestType} onChange={(e) => setProfile((v) => ({ ...v, lastTestType: e.target.value as 'hydro' | 'visual' }))}><option value="hydro">Hydro + visual</option><option value="visual">Visual inspection</option></select></label><label>Latest test month<input type="month" value={profile.lastTestAt} onChange={(e) => setProfile((v) => ({ ...v, lastTestAt: e.target.value }))}/></label><label>Hydro due (automatic)<input value={displayMonth(deriveCylinderInspectionSchedule({ ...item, lastTestType: profile.lastTestType, lastTestAt: profile.lastTestAt, hydroTestAt: profile.lastTestType === 'hydro' ? profile.lastTestAt : item.hydroTestAt ?? null }).hydroDueAt)} disabled/></label><label>Visual due (automatic)<input value={displayMonth(deriveCylinderInspectionSchedule({ ...item, lastTestType: profile.lastTestType, lastTestAt: profile.lastTestAt, visualTestAt: profile.lastTestAt }).visualDueAt)} disabled/></label></div><button className="focus-secondary" disabled={busy} onClick={() => void saveProfile()}>Save cylinder profile</button></details>

    <details open><summary>Gas use / remaining pressure</summary><form className={styles.inlineForm} onSubmit={(event) => void addUsage(event)}><label>Recorded at<input type="datetime-local" required value={usage.recordedAt} onChange={(e) => setUsage((v) => ({ ...v, recordedAt: e.target.value }))}/></label><label>Pressure used (bar)<input type="number" min="0" max="500" step="1" value={usage.pressureUsedBar} onChange={(e) => setUsage((v) => ({ ...v, pressureUsedBar: e.target.value, remainingPressureBar: e.target.value ? '' : v.remainingPressureBar }))} placeholder="Enter this OR remaining"/></label><label>Set remaining pressure (bar)<input type="number" min="0" max="500" step="1" value={usage.remainingPressureBar} onChange={(e) => setUsage((v) => ({ ...v, remainingPressureBar: e.target.value, pressureUsedBar: e.target.value ? '' : v.pressureUsedBar }))} placeholder="Enter this OR used"/></label><label className={styles.span2}>Notes<input value={usage.notes} onChange={(e) => setUsage((v) => ({ ...v, notes: e.target.value }))}/></label><button className="focus-primary" disabled={busy || (!usage.pressureUsedBar && !usage.remainingPressureBar)}>Record gas remaining</button></form><p className="focus-copy">This records pressure use against the current fill. It keeps the gas mix and linked analysis provenance; it does not pretend the cylinder was refilled.</p></details>

    <details open><summary>Fill &amp; pressure history</summary><form className={styles.inlineForm} onSubmit={(event) => void addFill(event)}><label>Filled at<input type="datetime-local" required value={fill.filledAt} onChange={(e) => setFill((v) => ({ ...v, filledAt: e.target.value }))}/></label><label>Pressure bar<input type="number" min="0" max="500" step="1" value={fill.pressureBar} onChange={(e) => setFill((v) => ({ ...v, pressureBar: e.target.value }))}/></label><label>Declared O₂ %<input type="number" min="0" max="100" step="0.1" value={fill.oxygenPercent} onChange={(e) => setFill((v) => ({ ...v, oxygenPercent: e.target.value }))}/></label><label>Declared He %<input type="number" min="0" max="100" step="0.1" value={fill.heliumPercent} onChange={(e) => setFill((v) => ({ ...v, heliumPercent: e.target.value }))}/></label><label>Provider<input value={fill.provider} onChange={(e) => setFill((v) => ({ ...v, provider: e.target.value }))}/></label><label className={styles.span2}>Notes<input value={fill.notes} onChange={(e) => setFill((v) => ({ ...v, notes: e.target.value }))}/></label><button className="focus-primary" disabled={busy}>Add fill</button></form>
      <div className={styles.history}>{[...fills].sort((a,b)=>b.filledAt.localeCompare(a.filledAt)).map((row) => <article key={row.entityId}><b>{new Date(row.filledAt).toLocaleString('en-GB')} · {row.pressureBar ?? '—'} bar remaining</b><span>{row.eventType === 'usage' ? `${row.pressureUsedBar ?? '—'} bar used` : row.eventType === 'adjustment' ? 'Manual remaining-pressure adjustment' : `${gasMixLabel(row.oxygenFraction, row.heliumFraction)} · ${row.provider || row.source}`}</span>{state.latestFill?.entityId === row.entityId && <em>Current pressure</em>}</article>)}</div></details>

    <details open><summary>Gas analysis history</summary><form className={styles.inlineForm} onSubmit={(event) => void addAnalysis(event)}><label>Fill analysed<select value={analysis.fillId} onChange={(e) => setAnalysis((v) => ({ ...v, fillId: e.target.value }))}><option value="">No explicit fill link</option>{[...fills].sort((a,b)=>b.filledAt.localeCompare(a.filledAt)).map((row) => <option key={row.entityId} value={row.entityId}>{new Date(row.filledAt).toLocaleString('en-GB')} · {row.pressureBar ?? '—'} bar</option>)}</select></label><label>Analysed at<input type="datetime-local" required value={analysis.analysedAt} onChange={(e) => setAnalysis((v) => ({ ...v, analysedAt: e.target.value }))}/></label><label>O₂ %<input type="number" required min="0" max="100" step="0.1" value={analysis.oxygenPercent} onChange={(e) => setAnalysis((v) => ({ ...v, oxygenPercent: e.target.value }))}/></label><label>He %<input type="number" min="0" max="100" step="0.1" value={analysis.heliumPercent} onChange={(e) => setAnalysis((v) => ({ ...v, heliumPercent: e.target.value }))}/></label><label>Analysed by<select value={analysis.analysedByPersonId} onChange={(e) => setAnalysis((v) => ({ ...v, analysedByPersonId: e.target.value }))}><option value="">Not recorded</option>{people.map((person) => <option key={person.entityId} value={person.entityId}>{person.name}</option>)}</select></label><label className={styles.span2}>Notes<input value={analysis.notes} onChange={(e) => setAnalysis((v) => ({ ...v, notes: e.target.value }))}/></label><button className="focus-primary" disabled={busy}>Add analysis</button></form>
      <div className={styles.history}>{[...analyses].sort((a,b)=>b.analysedAt.localeCompare(a.analysedAt)).map((row) => { const mod = maximumOperatingDepthM(row.oxygenFraction); const linkedCurrent = (state.latestFill?.originFillId || state.latestFill?.entityId) === row.fillId && !row.markedStaleAt; return <details key={row.entityId}><summary><b>{new Date(row.analysedAt).toLocaleString('en-GB')} · {gasMixLabel(row.oxygenFraction, row.heliumFraction)}</b><span>{linkedCurrent ? 'Current fill chain' : row.fillId ? 'Older/stale fill' : 'Unlinked'} · O₂ {percent(row.oxygenFraction)} · He {percent(row.heliumFraction)}{mod != null ? ` · calculated MOD @1.4: ${Math.floor(mod)} m` : ''}</span></summary><MediaGallery ownerKind="gas-analysis" ownerId={row.entityId} accessibleViewer acceptFiles retainOfflineMetadata featuredIds={row.attachmentIds ?? []} onUploaded={(ids) => addAnalysisMedia(row, ids)} onRemoved={(id) => addAnalysisMedia(row, [], id)}/></details>; })}</div></details>
    <details><summary>Cylinder photos &amp; videos</summary><MediaGallery ownerKind={item.recordStorageKind === 'equipment' ? 'equipment' : 'cylinder'} ownerId={item.entityId} accessibleViewer acceptFiles retainOfflineMetadata /></details>
    {error && <p role="alert" className="dive-save-error">{error}</p>}<footer><button className="focus-secondary danger" type="button" disabled={busy} onClick={remove}><Trash2 size={16}/>Delete cylinder</button><span/><button className="focus-secondary" type="button" disabled={busy} onClick={edit}><Pencil size={16}/>Edit cylinder</button><button className="focus-secondary" data-dialog-close onClick={close}>Close</button></footer>
  </AccessibleDialog></div>;
}

