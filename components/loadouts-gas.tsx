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
import { useCallback, useMemo, useState } from 'react';
import { AccessibleDialog } from './accessible-dialog';
import { MediaGallery } from './media-gallery';
import { useRecordRefresh } from './record-status';
import {
  deleteEquipmentSet,
  listDiveTrips,
  listEquipment,
  listEquipmentSets,
  listPeople,
  type DiveTripRecord,
  type EquipmentRecord,
  type EquipmentSetRecord,
  type PersonRecord,
  type Stored,
} from '../lib/offline/dive-planning';
import { listDives, type DiveRecord } from '../lib/offline/dives';
import {
  LOADOUT_SLOT_DEFINITIONS,
  applyReusableLoadout,
  cloneReusableLoadout,
  deriveCylinderCurrentState,
  filterEquipmentForSlot,
  gasMixLabel,
  isCylinderEquipment,
  listCylinderFills,
  listGasAnalyses,
  maximumOperatingDepthM,
  normaliseReusableLoadout,
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

export function LoadoutsGas() {
  const [tab, setTab] = useState<'loadouts' | 'cylinders'>('loadouts');
  const [equipment, setEquipment] = useState<Array<Stored<EquipmentRecord>>>([]);
  const [loadouts, setLoadouts] = useState<Array<Stored<ReusableLoadoutRecord>>>([]);
  const [fills, setFills] = useState<Array<Stored<CylinderFillRecord>>>([]);
  const [analyses, setAnalyses] = useState<Array<Stored<GasAnalysisRecord>>>([]);
  const [people, setPeople] = useState<Array<Stored<PersonRecord>>>([]);
  const [plans, setPlans] = useState<Array<Stored<DiveTripRecord>>>([]);
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>([]);
  const [editing, setEditing] = useState<Stored<ReusableLoadoutRecord> | null | undefined>(undefined);
  const [applying, setApplying] = useState<Stored<ReusableLoadoutRecord> | null>(null);
  const [cylinder, setCylinder] = useState<Stored<CylinderEquipmentRecord> | null>(null);
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    const [gear, sets, fillRows, analysisRows, persons, planRows, diveRows] = await Promise.all([
      listEquipment(), listEquipmentSets(), listCylinderFills(), listGasAnalyses(), listPeople(), listDiveTrips(), listDives(),
    ]);
    setEquipment(gear);
    setLoadouts(sets.map((set) => normaliseReusableLoadout(set as Stored<ReusableLoadoutRecord>)));
    setFills(fillRows); setAnalyses(analysisRows); setPeople(persons); setPlans(planRows); setDives(diveRows);
  }, []);
  useRecordRefresh(refresh);

  const cylinders = useMemo(
    () => equipment.filter(isCylinderEquipment) as Array<Stored<CylinderEquipmentRecord>>,
    [equipment],
  );
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

  return <>
    <header className={styles.heading}>
      <div><span className="focus-eyebrow">EQUIPMENT</span><h1>Reusable Loadouts &amp; Gas</h1><p>Build configurations from your existing Equipment, then track physical cylinders, fills and gas analyses as separate evidence.</p></div>
      <button className="focus-primary" onClick={() => tab === 'loadouts' ? setEditing(null) : setTab('cylinders')}><Plus size={17}/>{tab === 'loadouts' ? 'New loadout' : 'Cylinders'}</button>
    </header>

    <div className={styles.tabs} role="group" aria-label="Loadouts and gas sections">
      <button aria-pressed={tab === 'loadouts'} className={tab === 'loadouts' ? styles.activeTab : ''} onClick={() => setTab('loadouts')}><Wrench size={17}/>Reusable loadouts</button>
      <button aria-pressed={tab === 'cylinders'} className={tab === 'cylinders' ? styles.activeTab : ''} onClick={() => setTab('cylinders')}><Cylinder size={17}/>Cylinders / gas</button>
      <label className={styles.search}>Search<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === 'loadouts' ? 'Search loadouts' : 'Search cylinders'} /></label>
    </div>

    {tab === 'loadouts' ? <div className={styles.grid}>
      {visibleLoadouts.map((item) => {
        const validation = validateReusableLoadout(item, equipment);
        return <Card key={item.entityId} className={styles.loadoutCard}>
          <div className={styles.cardActions}><button className="focus-icon" title="Clone loadout" aria-label={`Clone ${item.name}`} onClick={() => void cloneReusableLoadout(item).then(refresh)}><Copy size={16}/></button><button className="focus-icon" aria-label={`Edit ${item.name}`} onClick={() => setEditing(item)}><Pencil size={16}/></button><button className="focus-icon danger" aria-label={`Delete ${item.name}`} onClick={() => void removeLoadout(item)}><Trash2 size={16}/></button></div>
          <span className="focus-eyebrow">{item.intendedUse || 'REUSABLE LOADOUT'}</span><h2>{item.name}</h2><p>{item.description || item.notes || 'No description recorded.'}</p>
          <div className={styles.chips}><span>{validation.referencedItemCount} items</span>{(item.environmentTags ?? []).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
          {validation.warnings.length ? <div className={styles.warning}><AlertTriangle size={16}/><span>{validation.warnings[0]}</span></div> : <div className={styles.ok}><CheckCircle2 size={16}/><span>All referenced items available</span></div>}
          <button className="focus-primary" onClick={() => setApplying(item)}>Apply to Dive / Plan</button>
        </Card>;
      })}
      {!visibleLoadouts.length && <Card className="focus-empty"><Wrench size={30}/><h2>{loadouts.length ? 'No matching loadouts' : 'No reusable loadouts yet'}</h2><p>Existing Equipment Sets remain compatible. Open one to assign semantic slots, or create a new loadout.</p><button className="focus-primary" onClick={() => setEditing(null)}>Create loadout</button></Card>}
    </div> : <div className={styles.grid}>
      {visibleCylinders.map((item) => {
        const state = deriveCylinderCurrentState(item, fills.filter((fill) => fill.cylinderEquipmentId === item.entityId), analyses.filter((analysis) => analysis.cylinderEquipmentId === item.entityId));
        return <Card key={item.entityId} className={styles.cylinderCard}>
          <span className="focus-eyebrow">PHYSICAL CYLINDER</span><h2>{item.name}</h2><p>{[item.manufacturer, item.model, item.serialNumber && `S/N ${item.serialNumber}`].filter(Boolean).join(' · ') || 'Equipment record'}</p>
          <dl><div><dt>Volume / working pressure</dt><dd>{item.waterVolumeLiters ?? '—'} L · {item.workingPressureBar ?? '—'} bar</dd></div><div><dt>Latest fill</dt><dd>{state.latestFill ? `${state.latestFill.pressureBar ?? '—'} bar · ${state.declaredMixLabel}` : 'No fill recorded'}</dd></div><div><dt>Analysis</dt><dd className={state.analysisState === 'current' ? styles.current : state.analysisState === 'stale' ? styles.stale : ''}>{state.analysedMixLabel}</dd></div></dl>
          <button className="focus-primary" onClick={() => setCylinder(item)}>Open cylinder</button>
        </Card>;
      })}
      {!visibleCylinders.length && <Card className="focus-empty"><Cylinder size={30}/><h2>No cylinders found</h2><p>Add physical cylinders in Equipment using a Cylinder/Tank category. This page deliberately reuses that inventory rather than creating a second one.</p></Card>}
    </div>}

    {editing !== undefined && <LoadoutEditor item={editing} equipment={equipment} close={() => setEditing(undefined)} saved={refresh} />}
    {applying && <ApplyLoadoutDialog loadout={applying} equipment={equipment} plans={plans} dives={dives} close={() => setApplying(null)} saved={refresh} />}
    {cylinder && <CylinderDetail item={cylinder} fills={fills.filter((fill) => fill.cylinderEquipmentId === cylinder.entityId)} analyses={analyses.filter((analysis) => analysis.cylinderEquipmentId === cylinder.entityId)} people={people} close={() => setCylinder(null)} saved={async () => { await refresh(); const latest = (await listEquipment()).find((item) => item.entityId === cylinder.entityId) as Stored<CylinderEquipmentRecord> | undefined; if (latest) setCylinder(latest); }} />}
  </>;
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
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!value.name.trim()) return; setBusy(true); setError('');
    try { await saveReusableLoadout(value); await saved(); close(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Loadout could not be saved.'); }
    finally { setBusy(false); }
  }
  return <div className="focus-modal-bg"><AccessibleDialog editable label={item ? `Edit ${item.name}` : 'Create reusable loadout'} className={`focus-modal ${styles.editor}`} close={() => { if (!busy) close(); }}>
    <form onSubmit={(event) => void submit(event)}><header><div><span className="focus-eyebrow">REUSABLE LOADOUT</span><h2>{item ? 'Edit loadout' : 'New loadout'}</h2><p>Equipment descriptions are not copied; slots store canonical Equipment IDs.</p></div><button type="button" className="focus-icon" data-dialog-close aria-label="Close loadout editor" disabled={busy} onClick={close}><X/></button></header>
      <fieldset disabled={busy}><div className={styles.editorTop}><label>Name<input required value={value.name} onChange={(event) => setValue((current) => ({ ...current, name: event.target.value }))}/></label><label>Intended use<input value={value.intendedUse ?? ''} onChange={(event) => setValue((current) => ({ ...current, intendedUse: event.target.value }))} placeholder="Cold water recreational, Tec, Travel…"/></label><label className={styles.span2}>Description<textarea value={value.description ?? ''} onChange={(event) => setValue((current) => ({ ...current, description: event.target.value }))}/></label><label className={styles.span2}>Environment tags<input value={(value.environmentTags ?? []).join(', ')} onChange={(event) => setValue((current) => ({ ...current, environmentTags: event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean) }))} placeholder="Cold water, UK, Drysuit"/></label></div>
      <div className={styles.slotGroups}>{groups.map((group) => <section key={group}><h3>{group}</h3>{LOADOUT_SLOT_DEFINITIONS.filter((definition) => definition.group === group).map((definition) => {
        const selected = slotSelectedIds(value.slots[definition.key]);
        const options = withMissingEquipment(filterEquipmentForSlot(definition, equipment, selected), selected);
        return <label key={definition.key}>{definition.label}{definition.multiple ? <select multiple value={selected} size={Math.min(5, Math.max(2, options.length))} onChange={(event) => setSlot(definition.key, Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}>{options.map((gear) => <option key={gear.entityId} value={gear.entityId}>{itemLabel(gear)}{gear.retired ? ' — retired' : ''}</option>)}</select> : <select value={selected[0] ?? ''} onChange={(event) => setSlot(definition.key, event.target.value)}><option value="">Not assigned</option>{options.map((gear) => <option key={gear.entityId} value={gear.entityId}>{itemLabel(gear)}{gear.retired ? ' — retired' : ''}</option>)}</select>}</label>;
      })}</section>)}</div><label>Notes<textarea value={value.notes ?? ''} onChange={(event) => setValue((current) => ({ ...current, notes: event.target.value }))}/></label></fieldset>
      {error && <p role="alert" className="dive-save-error">{error}</p>}<footer><button type="button" className="focus-secondary" data-dialog-close disabled={busy} onClick={close}>Cancel</button><button className="focus-primary" disabled={busy}>{busy ? 'Saving…' : 'Save loadout'}</button></footer>
    </form>
  </AccessibleDialog></div>;
}

function ApplyLoadoutDialog({ loadout, equipment, plans, dives, close, saved }: { loadout: Stored<ReusableLoadoutRecord>; equipment: Array<Stored<EquipmentRecord>>; plans: Array<Stored<DiveTripRecord>>; dives: Array<DiveRecord & { entityId: string }>; close: () => void; saved: () => Promise<void> | void }) {
  const normalised = normaliseReusableLoadout(loadout);
  const [kind, setKind] = useState<LoadoutTargetKind>('trip'); const [targetId, setTargetId] = useState(''); const [overrides, setOverrides] = useState<LoadoutSlots>({}); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const targets = kind === 'trip' ? plans.map((plan) => ({ id: plan.entityId, label: `${plan.name} · ${plan.startDate || 'no date'}` })) : dives.map((dive) => ({ id: dive.entityId, label: `${dive.date} · ${dive.site || 'Dive'}` }));
  async function apply() { if (!targetId) return; setBusy(true); setMessage('Applying locally…'); try { await applyReusableLoadout(kind, targetId, loadout, overrides); await saved(); close(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Loadout could not be applied.'); } finally { setBusy(false); } }
  return <div className="focus-modal-bg"><AccessibleDialog editable label={`Apply ${loadout.name}`} className={`focus-modal ${styles.applyDialog}`} close={() => { if (!busy) close(); }}><header><div><span className="focus-eyebrow">LOADOUT ASSIGNMENT</span><h2>Apply {loadout.name}</h2><p>The target receives stable equipment IDs plus this loadout reference. Later loadout edits do not rewrite the applied historical item IDs.</p></div><button className="focus-icon" data-dialog-close aria-label="Close apply dialog" onClick={close}><X/></button></header>
    <fieldset disabled={busy}><div className={styles.editorTop}><label>Target type<select value={kind} onChange={(event) => { setKind(event.target.value as LoadoutTargetKind); setTargetId(''); }}><option value="trip">Dive Plan</option><option value="dive">Logged Dive</option></select></label><label>Target<select required value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Choose {kind === 'trip' ? 'Plan' : 'Dive'}</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label></div>
      <section><h3>Per-instance overrides</h3><p className="focus-copy">Leave “Use loadout selection” to keep the saved slot. Choosing another item changes this application only.</p><div className={styles.overrideGrid}>{LOADOUT_SLOT_DEFINITIONS.filter((definition) => !definition.multiple && slotSelectedIds(normalised.slots?.[definition.key]).length).map((definition) => { const baseId = slotSelectedIds(normalised.slots?.[definition.key])[0]!; const base = equipment.find((item) => item.entityId === baseId); const options = withMissingEquipment(filterEquipmentForSlot(definition, equipment, [baseId]), [baseId]); return <label key={definition.key}>{definition.label}<select value={typeof overrides[definition.key] === 'string' ? String(overrides[definition.key]) : overrides[definition.key] === null ? '__clear' : '__base'} onChange={(event) => setOverrides((current) => ({ ...current, [definition.key]: event.target.value === '__base' ? baseId : event.target.value === '__clear' ? null : event.target.value }))}><option value="__base">Use loadout selection — {base?.name ?? 'saved item'}</option><option value="__clear">No item for this application</option>{options.filter((option) => option.entityId !== baseId).map((option) => <option key={option.entityId} value={option.entityId}>{itemLabel(option)}</option>)}</select></label>; })}</div></section>
    </fieldset>{message && <p role={message.includes('could not') ? 'alert' : 'status'}>{message}</p>}<footer><button className="focus-secondary" data-dialog-close onClick={close}>Cancel</button><button className="focus-primary" disabled={!targetId || busy} onClick={() => void apply()}>{busy ? 'Applying…' : 'Apply loadout'}</button></footer>
  </AccessibleDialog></div>;
}

function CylinderDetail({ item, fills, analyses, people, close, saved }: { item: Stored<CylinderEquipmentRecord>; fills: Array<Stored<CylinderFillRecord>>; analyses: Array<Stored<GasAnalysisRecord>>; people: Array<Stored<PersonRecord>>; close: () => void; saved: () => Promise<void> | void }) {
  const state = deriveCylinderCurrentState(item, fills, analyses);
  const [profile, setProfile] = useState({ waterVolumeLiters: item.waterVolumeLiters == null ? '' : String(item.waterVolumeLiters), workingPressureBar: item.workingPressureBar == null ? '' : String(item.workingPressureBar), cylinderMaterial: item.cylinderMaterial ?? '', valveType: item.valveType ?? '', oxygenClean: Boolean(item.oxygenClean), oxygenCleanUntil: item.oxygenCleanUntil ?? '', hydroTestAt: item.hydroTestAt ?? '', hydroDueAt: item.hydroDueAt ?? '', visualTestAt: item.visualTestAt ?? '', visualDueAt: item.visualDueAt ?? '', tareKg: item.tareKg == null ? '' : String(item.tareKg), owner: item.owner ?? '', cylinderStatus: item.cylinderStatus ?? 'active' });
  const [fill, setFill] = useState({ filledAt: localDateTime(), pressureBar: '', oxygenPercent: '', heliumPercent: '', provider: '', notes: '' });
  const [analysis, setAnalysis] = useState({ fillId: state.latestFill?.entityId ?? '', analysedAt: localDateTime(), oxygenPercent: '', heliumPercent: '', analysedByPersonId: '', notes: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function saveProfile() { setBusy(true); setError(''); try { await saveCylinderProfile({ ...item, entityId: item.entityId, waterVolumeLiters: profile.waterVolumeLiters ? Number(profile.waterVolumeLiters) : null, workingPressureBar: profile.workingPressureBar ? Number(profile.workingPressureBar) : null, cylinderMaterial: profile.cylinderMaterial, valveType: profile.valveType, oxygenClean: profile.oxygenClean, oxygenCleanUntil: profile.oxygenCleanUntil || null, hydroTestAt: profile.hydroTestAt || null, hydroDueAt: profile.hydroDueAt || null, visualTestAt: profile.visualTestAt || null, visualDueAt: profile.visualDueAt || null, tareKg: profile.tareKg ? Number(profile.tareKg) : null, owner: profile.owner, cylinderStatus: profile.cylinderStatus as NonNullable<CylinderEquipmentRecord['cylinderStatus']> }); await saved(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cylinder profile could not be saved.'); } finally { setBusy(false); } }
  async function addFill(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { const result = await saveCylinderFill({ cylinderEquipmentId: item.entityId, filledAt: new Date(fill.filledAt).toISOString(), pressureBar: fill.pressureBar ? Number(fill.pressureBar) : null, oxygenFraction: asFraction(fill.oxygenPercent), heliumFraction: asFraction(fill.heliumPercent), provider: fill.provider, notes: fill.notes, source: 'recorded' }); setAnalysis((current) => ({ ...current, fillId: result.id, analysedAt: localDateTime() })); setFill({ filledAt: localDateTime(), pressureBar: '', oxygenPercent: '', heliumPercent: '', provider: '', notes: '' }); await saved(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Fill could not be saved.'); } finally { setBusy(false); } }
  async function addAnalysis(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { await saveGasAnalysis({ cylinderEquipmentId: item.entityId, fillId: analysis.fillId || null, analysedAt: new Date(analysis.analysedAt).toISOString(), oxygenFraction: asFraction(analysis.oxygenPercent), heliumFraction: asFraction(analysis.heliumPercent), analysedByPersonId: analysis.analysedByPersonId || null, attachmentIds: [], notes: analysis.notes }); setAnalysis({ fillId: state.latestFill?.entityId ?? '', analysedAt: localDateTime(), oxygenPercent: '', heliumPercent: '', analysedByPersonId: '', notes: '' }); await saved(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Analysis could not be saved.'); } finally { setBusy(false); } }
  async function addAnalysisMedia(row: Stored<GasAnalysisRecord>, ids: string[], removed?: string) { await saveGasAnalysis({ ...row, entityId: row.entityId, attachmentIds: [...new Set([...(row.attachmentIds ?? []), ...ids])].filter((id) => id !== removed) }); await saved(); }
  return <div className="focus-modal-bg"><AccessibleDialog editable label={`${item.name} cylinder details`} className={`focus-modal ${styles.cylinderDetail}`} close={() => { if (!busy) close(); }}><header><div><span className="focus-eyebrow">CYLINDER / GAS</span><h2>{item.name}</h2><p>{[item.manufacturer, item.model, item.serialNumber && `S/N ${item.serialNumber}`].filter(Boolean).join(' · ')}</p></div><button className="focus-icon" data-dialog-close aria-label="Close cylinder details" onClick={close}><X/></button></header>
    <section className={styles.currentState}><div><Gauge/><small>Latest fill</small><strong>{state.latestFill ? `${state.latestFill.pressureBar ?? '—'} bar` : 'None'}</strong><span>{state.declaredMixLabel}</span></div><div className={state.analysisState === 'current' ? styles.goodPanel : styles.warnPanel}><FlaskConical/><small>Analysis</small><strong>{state.analysedMixLabel}</strong><span>{state.analysisState === 'current' ? 'Explicitly linked to latest fill' : state.analysisState === 'stale' ? 'Do not treat the previous analysis as current' : 'No analysis recorded'}</span></div><div><Cylinder/><small>Approx. surface gas</small><strong>{state.approximateSurfaceLitres == null ? '—' : `${Math.round(state.approximateSurfaceLitres).toLocaleString()} L`}</strong><span>Calculated: water volume × fill pressure</span></div></section>

    <details><summary>Physical cylinder profile</summary><div className={styles.editorTop}><label>Water volume (L)<input inputMode="decimal" value={profile.waterVolumeLiters} onChange={(e) => setProfile((v) => ({ ...v, waterVolumeLiters: e.target.value }))}/></label><label>Working pressure (bar)<input inputMode="decimal" value={profile.workingPressureBar} onChange={(e) => setProfile((v) => ({ ...v, workingPressureBar: e.target.value }))}/></label><label>Material<input value={profile.cylinderMaterial} onChange={(e) => setProfile((v) => ({ ...v, cylinderMaterial: e.target.value }))}/></label><label>Valve type<input value={profile.valveType} onChange={(e) => setProfile((v) => ({ ...v, valveType: e.target.value }))}/></label><label>Tare (kg)<input inputMode="decimal" value={profile.tareKg} onChange={(e) => setProfile((v) => ({ ...v, tareKg: e.target.value }))}/></label><label>Owner<input value={profile.owner} onChange={(e) => setProfile((v) => ({ ...v, owner: e.target.value }))}/></label><label><input type="checkbox" checked={profile.oxygenClean} onChange={(e) => setProfile((v) => ({ ...v, oxygenClean: e.target.checked }))}/> O₂-clean</label><label>O₂-clean until<input type="date" value={profile.oxygenCleanUntil} onChange={(e) => setProfile((v) => ({ ...v, oxygenCleanUntil: e.target.value }))}/></label><label>Hydro test<input type="date" value={profile.hydroTestAt} onChange={(e) => setProfile((v) => ({ ...v, hydroTestAt: e.target.value }))}/></label><label>Hydro due<input type="date" value={profile.hydroDueAt} onChange={(e) => setProfile((v) => ({ ...v, hydroDueAt: e.target.value }))}/></label><label>Visual test<input type="date" value={profile.visualTestAt} onChange={(e) => setProfile((v) => ({ ...v, visualTestAt: e.target.value }))}/></label><label>Visual due<input type="date" value={profile.visualDueAt} onChange={(e) => setProfile((v) => ({ ...v, visualDueAt: e.target.value }))}/></label></div><button className="focus-secondary" disabled={busy} onClick={() => void saveProfile()}>Save cylinder profile</button></details>

    <details open><summary>Fill history</summary><form className={styles.inlineForm} onSubmit={(event) => void addFill(event)}><label>Filled at<input type="datetime-local" required value={fill.filledAt} onChange={(e) => setFill((v) => ({ ...v, filledAt: e.target.value }))}/></label><label>Pressure bar<input type="number" min="0" max="500" step="1" value={fill.pressureBar} onChange={(e) => setFill((v) => ({ ...v, pressureBar: e.target.value }))}/></label><label>Declared O₂ %<input type="number" min="0" max="100" step="0.1" value={fill.oxygenPercent} onChange={(e) => setFill((v) => ({ ...v, oxygenPercent: e.target.value }))}/></label><label>Declared He %<input type="number" min="0" max="100" step="0.1" value={fill.heliumPercent} onChange={(e) => setFill((v) => ({ ...v, heliumPercent: e.target.value }))}/></label><label>Provider<input value={fill.provider} onChange={(e) => setFill((v) => ({ ...v, provider: e.target.value }))}/></label><label className={styles.span2}>Notes<input value={fill.notes} onChange={(e) => setFill((v) => ({ ...v, notes: e.target.value }))}/></label><button className="focus-primary" disabled={busy}>Add fill</button></form>
      <div className={styles.history}>{[...fills].sort((a,b)=>b.filledAt.localeCompare(a.filledAt)).map((row) => <article key={row.entityId}><b>{new Date(row.filledAt).toLocaleString('en-GB')} · {row.pressureBar ?? '—'} bar</b><span>{gasMixLabel(row.oxygenFraction, row.heliumFraction)} · {row.provider || row.source}</span>{state.latestFill?.entityId === row.entityId && <em>Latest fill</em>}</article>)}</div></details>

    <details open><summary>Gas analysis history</summary><form className={styles.inlineForm} onSubmit={(event) => void addAnalysis(event)}><label>Fill analysed<select value={analysis.fillId} onChange={(e) => setAnalysis((v) => ({ ...v, fillId: e.target.value }))}><option value="">No explicit fill link</option>{[...fills].sort((a,b)=>b.filledAt.localeCompare(a.filledAt)).map((row) => <option key={row.entityId} value={row.entityId}>{new Date(row.filledAt).toLocaleString('en-GB')} · {row.pressureBar ?? '—'} bar</option>)}</select></label><label>Analysed at<input type="datetime-local" required value={analysis.analysedAt} onChange={(e) => setAnalysis((v) => ({ ...v, analysedAt: e.target.value }))}/></label><label>O₂ %<input type="number" required min="0" max="100" step="0.1" value={analysis.oxygenPercent} onChange={(e) => setAnalysis((v) => ({ ...v, oxygenPercent: e.target.value }))}/></label><label>He %<input type="number" min="0" max="100" step="0.1" value={analysis.heliumPercent} onChange={(e) => setAnalysis((v) => ({ ...v, heliumPercent: e.target.value }))}/></label><label>Analysed by<select value={analysis.analysedByPersonId} onChange={(e) => setAnalysis((v) => ({ ...v, analysedByPersonId: e.target.value }))}><option value="">Not recorded</option>{people.map((person) => <option key={person.entityId} value={person.entityId}>{person.name}</option>)}</select></label><label className={styles.span2}>Notes<input value={analysis.notes} onChange={(e) => setAnalysis((v) => ({ ...v, notes: e.target.value }))}/></label><button className="focus-primary" disabled={busy}>Add analysis</button></form>
      <div className={styles.history}>{[...analyses].sort((a,b)=>b.analysedAt.localeCompare(a.analysedAt)).map((row) => { const mod = maximumOperatingDepthM(row.oxygenFraction); const linkedCurrent = state.latestFill?.entityId === row.fillId; return <details key={row.entityId}><summary><b>{new Date(row.analysedAt).toLocaleString('en-GB')} · {gasMixLabel(row.oxygenFraction, row.heliumFraction)}</b><span>{linkedCurrent ? 'Current fill' : row.fillId ? 'Older fill' : 'Unlinked'} · O₂ {percent(row.oxygenFraction)} · He {percent(row.heliumFraction)}{mod != null ? ` · calculated MOD @1.4: ${Math.floor(mod)} m` : ''}</span></summary><MediaGallery ownerKind="gas-analysis" ownerId={row.entityId} accessibleViewer acceptFiles retainOfflineMetadata featuredIds={row.attachmentIds ?? []} onUploaded={(ids) => addAnalysisMedia(row, ids)} onRemoved={(id) => addAnalysisMedia(row, [], id)}/></details>; })}</div></details>
    {error && <p role="alert" className="dive-save-error">{error}</p>}<footer><span/><button className="focus-secondary" data-dialog-close onClick={close}>Close</button></footer>
  </AccessibleDialog></div>;
}
