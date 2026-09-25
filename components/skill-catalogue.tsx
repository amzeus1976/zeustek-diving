'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Download, FileUp, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { AccessibleDialog } from './accessible-dialog';
import { RecordEditorWorkspace } from './shared/record-editor-workspace';
import {
  CANONICAL_SKILL_GROUPS, CANONICAL_SKILLS_CHANGED_EVENT, canonicalSkillGroups, createCanonicalSkill, createCanonicalSkills,
  deleteUnusedArchivedSkills, listCanonicalSkills, listSkillEvidence, previewCanonicalSkillBatch,
  previewUnusedArchivedSkills, resolveCanonicalSkillReference, setCanonicalSkillArchived, skillRecordGroup,
  skillRecordName, updateCanonicalSkill, type ArchivedSkillCleanupPreview, type CanonicalSkillRecord,
} from '../lib/offline/dive-context';
import { refreshDiveRecords } from '../lib/offline/dive-store';
import { applySkillCsvRows, exportSkillsCsv, previewSkillCsv, type SkillCsvPreview, type SkillCsvPreviewRow } from '../lib/skills/skill-csv';

const levels = ['foundation','developing','competent','advanced','mastered'] as const;
const levelLabel = (level: typeof levels[number]) => level.charAt(0).toUpperCase() + level.slice(1);
export const SKILL_CATALOGUE_BATCH_SIZE = 75;

export function SkillCsvMatchedSkill({ row }: { row: Pick<SkillCsvPreviewRow, 'matchedSkillId' | 'matchedSkillName' | 'matchedSkillGroup'> }) {
  if (!row.matchedSkillId) return <>—</>;
  return <><b>{row.matchedSkillName || 'Existing Skill'}</b><small>{row.matchedSkillGroup || 'Skill group not recorded'}</small></>;
}

export function filterSkillCatalogueSkills(skills: CanonicalSkillRecord[], selectedGroups: ReadonlySet<string>, query: string, limit = SKILL_CATALOGUE_BATCH_SIZE) {
  if (selectedGroups.size === 0) return { matches: [] as CanonicalSkillRecord[], visible: [] as CanonicalSkillRecord[], total: 0 };
  const normalizedQuery = query.trim().toLocaleLowerCase('en-GB');
  const matches = skills.filter(skill => selectedGroups.has(skillRecordGroup(skill)) && (!normalizedQuery || `${skillRecordName(skill)} ${skillRecordGroup(skill)} ${skill.description || ''}`.toLocaleLowerCase('en-GB').includes(normalizedQuery))).sort((a, b) => Number(Boolean(a.archived)) - Number(Boolean(b.archived)) || skillRecordGroup(a).localeCompare(skillRecordGroup(b), 'en-GB') || skillRecordName(a).localeCompare(skillRecordName(b), 'en-GB'));
  return { matches, visible: matches.slice(0, limit), total: matches.length };
}

function SkillEditor({ skill, close, saved }: { skill: CanonicalSkillRecord | null; close: () => void; saved: () => void }) {
  const [name, setName] = useState(skill ? skillRecordName(skill) : '');
  const [group, setGroup] = useState(skill ? skillRecordGroup(skill) : 'Other');
  const [description, setDescription] = useState(skill?.description || '');
  const [definitions, setDefinitions] = useState(() => Object.fromEntries(levels.map(level => [level, skill?.competenceDefinitions?.[level] || ''])) as Record<typeof levels[number], string>);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    try {
      const input = { name, group, description, competenceDefinitions: definitions };
      if (skill) await updateCanonicalSkill(skill.entityId, input); else await createCanonicalSkill(input);
      window.dispatchEvent(new Event(CANONICAL_SKILLS_CHANGED_EVENT)); saved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The Skill could not be saved.'); }
    finally { setBusy(false); }
  }
  return <RecordEditorWorkspace label={skill ? 'Edit canonical Skill' : 'Add canonical Skill'} close={close} save={submit} busy={busy} saveLabel="Save skill" saveDisabled={!name.trim()||!group.trim()} value={{name,group,description,definitions}} trackInteractions={false} contentClassName="skill-catalogue-dialog">
    <div><span className="focus-eyebrow">SKILL CATALOGUE</span><h2>{skill ? 'Edit skill' : 'Add skill'}</h2></div>
      <fieldset disabled={busy} className="skill-rich-fields">
        <div className="skill-editor-grid"><label>Skill group<input required value={group} list="skill-groups" onChange={event => setGroup(event.target.value)} placeholder="e.g. Buoyancy & Trim" /></label><label>Skill name<input required value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Air-sharing stop control" /></label></div>
        <datalist id="skill-groups">{CANONICAL_SKILL_GROUPS.map(value => <option key={value} value={value} />)}</datalist>
        <label>Description<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="What the diver should be able to do" /></label>
        <fieldset className="skill-competence-fields"><legend>Competence definitions</legend>{levels.map(level => <label key={level}>{levelLabel(level)}<textarea value={definitions[level]} onChange={event => setDefinitions(current => ({ ...current, [level]: event.target.value }))} placeholder={`${levelLabel(level)} performance for this Skill`} /></label>)}</fieldset>
      </fieldset>
      {error && <p role="alert" className="dive-save-error">{error}</p>}
  </RecordEditorWorkspace>;
}

function BulkSkillEditor({ existing, close, saved }: { existing: CanonicalSkillRecord[]; close: () => void; saved: (count: number) => void }) {
  const [value, setValue] = useState(''); const preview = useMemo(() => previewCanonicalSkillBatch(value, existing), [value, existing]);
  const [accepted, setAccepted] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => setAccepted(preview.newSkills), [preview]);
  async function commit() { setBusy(true); setError(''); try { const created = await createCanonicalSkills(accepted); window.dispatchEvent(new Event(CANONICAL_SKILLS_CHANGED_EVENT)); saved(created.length); } catch (reason) { setError(reason instanceof Error ? reason.message : 'The Skills could not be added.'); } finally { setBusy(false); } }
  return <RecordEditorWorkspace label="Add multiple canonical Skills" close={close} save={commit} busy={busy} saveLabel={`Add ${accepted.length} skill${accepted.length===1?'':'s'}`} saveDisabled={!accepted.length} value={{value,accepted}} trackInteractions={false} contentClassName="skill-bulk-dialog">
    <div><span className="focus-eyebrow">SKILL CATALOGUE</span><h2>Add multiple skills</h2><p>Enter one Skill per line. New entries use the Other group and can be enriched later.</p></div>
    <label>Skill names<textarea value={value} disabled={busy} onChange={event => setValue(event.target.value)} placeholder={'Trim\nHover\nFrog kick\nBack kick'} /></label>
    <section className="skill-bulk-preview" aria-live="polite"><div><b>{preview.submittedCount}</b><span>submitted</span></div><div><b>{preview.newSkills.length}</b><span>new</span></div><div><b>{preview.existingSkills.length}</b><span>already exist</span></div><div><b>{preview.duplicateSkills.length}</b><span>repeated</span></div><div><b>{preview.blankCount}</b><span>blank ignored</span></div></section>
    {preview.newSkills.length > 0 && <fieldset className="skill-import-choices" disabled={busy}><legend>Skills to create</legend>{preview.newSkills.map(name => <label key={name}><input type="checkbox" checked={accepted.includes(name)} onChange={event => setAccepted(current => event.target.checked ? [...current, name] : current.filter(item => item !== name))} /><span>{name}</span></label>)}</fieldset>}
    {error && <p role="alert" className="dive-save-error">{error}</p>}
  </RecordEditorWorkspace>;
}

function CsvImportDialog({ skills, close, saved }: { skills: CanonicalSkillRecord[]; close: () => void; saved: (count: number) => void }) {
  const [preview, setPreview] = useState<SkillCsvPreview | null>(null); const [selected, setSelected] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function choose(file?: File) {
    if (!file) return; setError(''); setFileName(file.name);
    try { const result = previewSkillCsv(await file.text(), skills); setPreview(result); setSelected(new Set(result.rows.filter(row => row.included).map(row => row.rowNumber))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The CSV could not be read.'); }
  }
  async function apply() {
    if (!preview) return; setBusy(true); setError('');
    try {
      const count = await applySkillCsvRows(preview.rows.map(row => ({ ...row, included: selected.has(row.rowNumber) })), { create: createCanonicalSkill, update: updateCanonicalSkill, archive: setCanonicalSkillArchived });
      window.dispatchEvent(new Event(CANONICAL_SKILLS_CHANGED_EVENT)); saved(count);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The selected CSV rows could not be applied.'); }
    finally { setBusy(false); }
  }
  return <RecordEditorWorkspace label="Import Skills CSV" close={close} save={apply} busy={busy} saveLabel={`Apply ${selected.size} selected row${selected.size===1?'':'s'}`} saveDisabled={!preview||Boolean(preview.fatalError)||selected.size===0} value={{fileName,selected:[...selected].sort((a,b)=>a-b)}} trackInteractions={false} contentClassName="skill-csv-dialog">
    <div><span className="focus-eyebrow">SKILL CATALOGUE</span><h2>Import Skills CSV</h2><p>Parsing and preview happen on this device. Nothing is changed until you apply selected rows.</p></div>
    <label className="skill-file-picker"><FileUp size={18}/><span>{fileName || 'Choose UTF-8 CSV file'}</span><input type="file" accept=".csv,text/csv" aria-label="Choose Skills CSV file" disabled={busy} onChange={event => void choose(event.target.files?.[0])} /></label>
    {preview?.fatalError && <p role="alert" className="dive-save-error">{preview.fatalError}</p>}
    {preview && !preview.fatalError && <><section className="skill-csv-counts" aria-label="CSV preview counts"><b>{preview.totalRows} rows</b>{Object.entries(preview.counts).filter(([, count]) => count).map(([status, count]) => <span key={status}>{count} {status.replace('_', ' ')}</span>)}</section>
      <div className="skill-csv-table-wrap"><table className="skill-csv-table"><thead><tr><th>Include</th><th>Row</th><th>Result</th><th>Skill</th><th>Matched canonical Skill</th><th>Changes / validation</th></tr></thead><tbody>{preview.rows.map(row => { const canInclude = ['NEW','UPDATE','ARCHIVE','RESTORE'].includes(row.status); return <tr key={row.rowNumber}><td><input type="checkbox" aria-label={`Include CSV row ${row.rowNumber}`} disabled={!canInclude || busy} checked={selected.has(row.rowNumber)} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(row.rowNumber); else next.delete(row.rowNumber); return next; })} /></td><td>{row.rowNumber}</td><td><span className={`skill-csv-status status-${row.status.toLowerCase()}`}>{row.status.replace('_', ' ')}</span></td><td><b>{row.group || '—'} — {row.name || '—'}</b><small>{row.action}</small></td><td><SkillCsvMatchedSkill row={row} /></td><td>{row.problem || (row.changes.length ? row.changes.map(change => <div key={change.field}><b>{change.field}:</b> {change.from || '(blank)'} → {change.to || '(blank)'}</div>) : 'No field changes')}</td></tr>; })}</tbody></table></div>
    </>}
    {error && <p role="alert" className="dive-save-error">{error}</p>}
  </RecordEditorWorkspace>;
}

function CleanupDialog({ close, saved }: { close: () => void; saved: (count: number) => void }) {
  const [preview, setPreview] = useState<ArchivedSkillCleanupPreview | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { void previewUnusedArchivedSkills().then(setPreview).catch(reason => setError(reason instanceof Error ? reason.message : 'Archived Skills could not be reviewed.')); }, []);
  async function remove() { if (!preview) return; setBusy(true); setError(''); try { const count = await deleteUnusedArchivedSkills(preview.eligible.map(item => item.skill.entityId)); window.dispatchEvent(new Event(CANONICAL_SKILLS_CHANGED_EVENT)); saved(count); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unused archived Skills could not be deleted.'); } finally { setBusy(false); } }
  return <div className="focus-modal-bg"><AccessibleDialog label="Clear unused archived Skills" className="focus-modal skill-cleanup-dialog" close={() => { if (!busy) close(); }}><header><div><span className="focus-eyebrow">DESTRUCTIVE MAINTENANCE</span><h2>Clear unused archived skills</h2><p>Referenced historical Skills are protected. This action uses the existing local-first deletion workflow and is not a secure purge.</p></div><button className="focus-icon" aria-label="Close archived Skill cleanup" disabled={busy} onClick={close}><X /></button></header>
    {preview && <><section className="skill-bulk-preview"><div><b>{preview.archivedCount}</b><span>archived</span></div><div><b>{preview.eligible.length}</b><span>unused and eligible</span></div><div><b>{preview.protected.length}</b><span>referenced and protected</span></div></section><div className="skill-cleanup-lists"><section><h3>Will be deleted</h3>{preview.eligible.length ? <ul>{preview.eligible.map(item => <li key={item.skill.entityId}>{skillRecordGroup(item.skill)} — {skillRecordName(item.skill)}</li>)}</ul> : <p>No unused archived Skills are eligible.</p>}</section><section><h3>Protected</h3>{preview.protected.length ? <ul>{preview.protected.map(item => <li key={item.skill.entityId}>{skillRecordGroup(item.skill)} — {skillRecordName(item.skill)} ({item.referenceCount} reference{item.referenceCount === 1 ? '' : 's'})</li>)}</ul> : <p>No referenced archived Skills found.</p>}</section></div></>}
    {error && <p role="alert" className="dive-save-error">{error}</p>}<footer><button className="focus-secondary" disabled={busy} onClick={close}>Cancel</button><button className="focus-secondary danger" disabled={busy || !preview?.eligible.length} onClick={() => void remove()}><Trash2 size={16}/>{busy ? 'Deleting…' : `Delete ${preview?.eligible.length || 0} unused archived skill${preview?.eligible.length === 1 ? '' : 's'}`}</button></footer>
  </AccessibleDialog></div>;
}

export function SkillCatalogue() {
  const [skills, setSkills] = useState<CanonicalSkillRecord[]>([]); const [usage, setUsage] = useState<Map<string, number>>(new Map()); const [query, setQuery] = useState(''); const [selectedGroups, setSelectedGroups] = useState<string[]>([]); const [groupQuery, setGroupQuery] = useState(''); const [visibleLimit, setVisibleLimit] = useState(SKILL_CATALOGUE_BATCH_SIZE);
  const [editor, setEditor] = useState<CanonicalSkillRecord | null | undefined>(undefined); const [bulkOpen, setBulkOpen] = useState(false); const [csvOpen, setCsvOpen] = useState(false); const [cleanupOpen, setCleanupOpen] = useState(false); const [busyId, setBusyId] = useState(''); const [message, setMessage] = useState('Loading Skill Catalogue…');
  const load = useCallback(async () => { const [definitions, evidence] = await Promise.all([listCanonicalSkills(), listSkillEvidence()]); const counts = new Map<string, number>(); for (const item of evidence) { const resolved = resolveCanonicalSkillReference(item.skillKey, definitions); if (resolved) counts.set(resolved.entityId, (counts.get(resolved.entityId) ?? 0) + 1); } setSkills(definitions); setUsage(counts); setMessage(`${definitions.length} canonical Skill${definitions.length === 1 ? '' : 's'} available on this device.`); }, []);
  useEffect(() => { const changed = () => { void load(); }; void load().then(() => Promise.all([refreshDiveRecords('skill'), refreshDiveRecords('skill_evidence')])).then(load).catch(() => setMessage('Showing locally available Skills. Cloud refresh is currently unavailable.')); window.addEventListener(CANONICAL_SKILLS_CHANGED_EVENT, changed); return () => window.removeEventListener(CANONICAL_SKILLS_CHANGED_EVENT, changed); }, [load]);
  const groups = canonicalSkillGroups(skills);
  const selectedGroupSet = useMemo(() => new Set(selectedGroups), [selectedGroups]);
  const filteredGroups = groups.filter(group => group.toLocaleLowerCase('en-GB').includes(groupQuery.trim().toLocaleLowerCase('en-GB')));
  const groupSelectionLabel = selectedGroups.length === 0 ? 'No Skill Groups selected' : selectedGroups.length === groups.length ? 'All Skill Groups' : selectedGroups.length === 1 ? selectedGroups[0] : `${selectedGroups.length} Skill Groups selected`;
  const result = useMemo(() => filterSkillCatalogueSkills(skills, selectedGroupSet, query, visibleLimit), [skills, selectedGroupSet, query, visibleLimit]);
  function chooseGroups(next: string[]) { setSelectedGroups(next); setVisibleLimit(SKILL_CATALOGUE_BATCH_SIZE); }
  function toggleGroup(group: string, checked: boolean) { setSelectedGroups(current => checked ? (current.includes(group) ? current : [...current, group]) : current.filter(item => item !== group)); setVisibleLimit(SKILL_CATALOGUE_BATCH_SIZE); }
  async function toggleArchive(skill: CanonicalSkillRecord) { setBusyId(skill.entityId); try { await setCanonicalSkillArchived(skill.entityId, !skill.archived); window.dispatchEvent(new Event(CANONICAL_SKILLS_CHANGED_EVENT)); setMessage(skill.archived ? 'Skill restored.' : 'Skill archived. Existing evidence remains readable.'); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'The Skill could not be updated.'); } finally { setBusyId(''); } }
  function downloadCsv() { const url = URL.createObjectURL(new Blob([exportSkillsCsv(skills)], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `zeustek-skill-catalogue-${new Date().toISOString().slice(0,10)}.csv`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  if (editor !== undefined) return <SkillEditor key={editor?.entityId ?? 'new-skill'} skill={editor} close={() => setEditor(undefined)} saved={() => { setEditor(undefined); void load(); }} />;
  if (bulkOpen) return <BulkSkillEditor existing={skills} close={() => setBulkOpen(false)} saved={count => { setBulkOpen(false); setMessage(`${count} Skill${count === 1 ? '' : 's'} added.`); void load(); }} />;
  if (csvOpen) return <CsvImportDialog skills={skills} close={() => setCsvOpen(false)} saved={count => { setCsvOpen(false); setMessage(`${count} CSV change${count === 1 ? '' : 's'} applied locally.`); void load(); }} />;
  if (cleanupOpen) return <CleanupDialog close={() => setCleanupOpen(false)} saved={count => { setCleanupOpen(false); setMessage(`${count} unused archived Skill${count === 1 ? '' : 's'} deleted.`); void load(); }} />;
  return <section className="focus-card skill-catalogue" aria-labelledby="skill-catalogue-title"><div className="skill-catalogue-head"><span className="focus-eyebrow">DIVING DATA</span><h2 id="skill-catalogue-title">Skill Catalogue</h2><p className="focus-copy">Manage the canonical Skills used by Dive evidence and future Skills &amp; Currency views.</p></div><div className="record-actions skill-catalogue-toolbar" aria-label="Skill Catalogue actions"><button className="focus-primary" onClick={() => setEditor(null)}><Plus size={16}/> Add skill</button><button className="focus-secondary" onClick={() => setCsvOpen(true)}><FileUp size={16}/> Import CSV</button><button className="focus-secondary" onClick={downloadCsv} disabled={!skills.length}><Download size={16}/> Export CSV</button><button className="focus-secondary" onClick={() => setBulkOpen(true)}>Add multiple skills</button><button className="focus-secondary danger" onClick={() => setCleanupOpen(true)}><Trash2 size={16}/> Clear unused archived</button></div>
    <div className="skill-catalogue-filters"><label className="skill-catalogue-search"><Search size={16}/><span className="sr-only">Search Skill Catalogue within selected groups</span><input value={query} onChange={event => { setQuery(event.target.value); setVisibleLimit(SKILL_CATALOGUE_BATCH_SIZE); }} placeholder="Search name, group or description" /></label><details className="skill-group-selector"><summary aria-label={`Skill Groups: ${groupSelectionLabel}`}><span>{groupSelectionLabel}</span><small>{selectedGroups.length} of {groups.length}</small></summary><div className="skill-group-menu"><label className="skill-group-search"><Search size={15}/><span className="sr-only">Search Skill Groups</span><input value={groupQuery} onChange={event => setGroupQuery(event.target.value)} placeholder="Search groups…" /></label><div className="skill-group-actions"><button type="button" className="focus-secondary" onClick={() => chooseGroups(groups)}>Select all</button><button type="button" className="focus-secondary" onClick={() => chooseGroups([])}>Clear all</button></div><fieldset><legend className="sr-only">Select Skill Groups</legend>{filteredGroups.map(group => <label key={group}><input type="checkbox" checked={selectedGroupSet.has(group)} onChange={event => toggleGroup(group, event.target.checked)} /><span>{group}</span></label>)}{filteredGroups.length === 0 && <p>No Skill Groups match.</p>}</fieldset></div></details></div>
    <p className="focus-notice" role="status">{message}{selectedGroups.length > 0 && ` Showing ${result.visible.length} of ${result.total} matching Skills.`}</p><div className="skill-catalogue-list">{result.visible.map(skill => <article key={skill.entityId} className={skill.archived ? 'archived' : ''}><div><b>{skillRecordName(skill)}</b><span>{skillRecordGroup(skill)} · {usage.get(skill.entityId) ?? 0} evidence record{usage.get(skill.entityId) === 1 ? '' : 's'}</span>{skill.description && <p>{skill.description}</p>}{skill.archived && <small>Archived · retained for historical evidence</small>}</div><div className="record-actions"><button className="focus-secondary" disabled={busyId === skill.entityId} onClick={() => setEditor(skill)}><Pencil size={15}/> Edit</button><button className="focus-secondary" disabled={busyId === skill.entityId} onClick={() => void toggleArchive(skill)}>{skill.archived ? <RotateCcw size={15}/> : <Archive size={15}/>} {skill.archived ? 'Restore' : 'Archive'}</button></div></article>)}</div>
    {selectedGroups.length === 0 && <p className="skill-catalogue-empty">{skills.length ? 'Select one or more Skill Groups to view Skills.' : 'No canonical Skills yet. Add one, paste a list or import a CSV to get started.'}</p>}
    {selectedGroups.length > 0 && result.total === 0 && <p className="skill-catalogue-empty">No Skills match those filters.</p>}
    {result.visible.length < result.total && <button type="button" className="focus-secondary skill-catalogue-more" onClick={() => setVisibleLimit(current => current + SKILL_CATALOGUE_BATCH_SIZE)}>Load {Math.min(SKILL_CATALOGUE_BATCH_SIZE, result.total - result.visible.length)} more Skills</button>}
  </section>;
}
