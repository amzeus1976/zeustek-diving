import type { CanonicalSkillInput, CanonicalSkillRecord } from '../offline/dive-context';
import { normaliseCanonicalSkillName, skillRecordGroup, skillRecordName } from '../offline/dive-context';

export const SKILL_CSV_COLUMNS = ['schema_version','action','skill_id','skill_group','skill_name','description','foundation','developing','competent','advanced','mastered'] as const;
export type SkillCsvStatus = 'NEW'|'UPDATE'|'UNCHANGED'|'ARCHIVE'|'RESTORE'|'DUPLICATE'|'INVALID'|'REVIEW_REQUIRED';
export interface SkillCsvChange { field: string; from: string; to: string }
export interface SkillCsvPreviewRow {
  rowNumber: number;
  status: SkillCsvStatus;
  action: string;
  skillId: string;
  group: string;
  name: string;
  matchedSkillId?: string;
  matchedSkillName?: string;
  matchedSkillGroup?: string;
  changes: SkillCsvChange[];
  problem?: string;
  included: boolean;
  input: CanonicalSkillInput;
}
export interface SkillCsvPreview { rows: SkillCsvPreviewRow[]; counts: Record<SkillCsvStatus, number>; totalRows: number; fatalError?: string }

const statuses: SkillCsvStatus[] = ['NEW','UPDATE','UNCHANGED','ARCHIVE','RESTORE','DUPLICATE','INVALID','REVIEW_REQUIRED'];
const clean = (value: string | undefined) => (value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const identity = (value: string) => clean(value).toLocaleLowerCase('en-GB');
const pairIdentity = (group: string, name: string) => `${identity(group)}\u0000${identity(name)}`;
const fieldValue = (skill: CanonicalSkillRecord, key: string) => {
  if (key === 'skill_group') return skillRecordGroup(skill);
  if (key === 'skill_name') return skillRecordName(skill);
  if (key === 'description') return skill.description || '';
  return skill.competenceDefinitions?.[key as keyof NonNullable<CanonicalSkillRecord['competenceDefinitions']>] || '';
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') {
      if (field) throw new Error('Malformed CSV: a quoted field must begin immediately after a comma.');
      quoted = true;
    } else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('Malformed CSV: an opening quote is not closed.');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(values => values.some(value => value.trim()));
}

function csvInput(values: string[]): CanonicalSkillInput {
  return {
    group: clean(values[3]), name: clean(values[4]), description: values[5]?.trim() || '',
    competenceDefinitions: {
      foundation: values[6]?.trim() || '', developing: values[7]?.trim() || '', competent: values[8]?.trim() || '',
      advanced: values[9]?.trim() || '', mastered: values[10]?.trim() || '',
    },
  };
}

function changesFor(skill: CanonicalSkillRecord, input: CanonicalSkillInput): SkillCsvChange[] {
  const desired: Record<string, string> = {
    skill_group: input.group || '', skill_name: input.name, description: input.description || '',
    foundation: input.competenceDefinitions?.foundation || '', developing: input.competenceDefinitions?.developing || '',
    competent: input.competenceDefinitions?.competent || '', advanced: input.competenceDefinitions?.advanced || '', mastered: input.competenceDefinitions?.mastered || '',
  };
  return Object.entries(desired).filter(([field, value]) => fieldValue(skill, field) !== value).map(([field, value]) => ({ field, from: fieldValue(skill, field), to: value }));
}

export function previewSkillCsv(text: string, existing: CanonicalSkillRecord[]): SkillCsvPreview {
  const counts = Object.fromEntries(statuses.map(status => [status, 0])) as Record<SkillCsvStatus, number>;
  let parsed: string[][];
  try { parsed = parseCsv(text); } catch (error) { return { rows: [], counts, totalRows: 0, fatalError: error instanceof Error ? error.message : 'Malformed CSV.' }; }
  if (!parsed.length) return { rows: [], counts, totalRows: 0, fatalError: 'Choose a non-empty CSV file.' };
  const header = parsed[0]!;
  if (header.map(value => value.trim()).join(',') !== SKILL_CSV_COLUMNS.join(',')) return { rows: [], counts, totalRows: Math.max(0, parsed.length - 1), fatalError: `CSV header must be exactly: ${SKILL_CSV_COLUMNS.join(',')}` };
  const byPair = new Map<string, CanonicalSkillRecord[]>();
  const byName = new Map<string, CanonicalSkillRecord[]>();
  for (const skill of existing) {
    const pair = pairIdentity(skillRecordGroup(skill), skillRecordName(skill));
    byPair.set(pair, [...(byPair.get(pair) || []), skill]);
    const name = identity(skillRecordName(skill)); byName.set(name, [...(byName.get(name) || []), skill]);
  }
  const idCounts = new Map<string, number>();
  for (const values of parsed.slice(1)) { const id = clean(values[2]); if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1); }
  const seenPairs = new Set<string>();
  const rows = parsed.slice(1).map((values, rowIndex): SkillCsvPreviewRow => {
    const rowNumber = rowIndex + 2; const padded = [...values, ...Array(Math.max(0, SKILL_CSV_COLUMNS.length - values.length)).fill('')];
    const action = clean(padded[1]).toLocaleLowerCase('en-GB'); const skillId = clean(padded[2]); const input = csvInput(padded);
    const base = { rowNumber, action, skillId, group: input.group || '', name: input.name, changes: [] as SkillCsvChange[], included: false, input };
    const finish = (status: SkillCsvStatus, extra: Partial<SkillCsvPreviewRow> = {}) => ({ ...base, status, included: ['NEW','UPDATE','ARCHIVE','RESTORE'].includes(status), ...extra });
    if (values.length !== SKILL_CSV_COLUMNS.length) return finish('INVALID', { problem: `Expected ${SKILL_CSV_COLUMNS.length} columns; found ${values.length}.` });
    if (clean(padded[0]) !== '1') return finish('INVALID', { problem: `Unsupported schema_version “${padded[0] || '(blank)'}”.` });
    if (!['upsert','archive','restore'].includes(action)) return finish('INVALID', { problem: `Invalid action “${padded[1] || '(blank)'}”.` });
    if ((action === 'archive' || action === 'restore') && !skillId) return finish('INVALID', { problem: `${action} requires skill_id.` });
    if (action === 'upsert' && (!input.group || !input.name)) return finish('INVALID', { problem: 'upsert requires skill_group and skill_name.' });
    if (skillId) {
      if ((idCounts.get(skillId) || 0) > 1) return finish('DUPLICATE', { problem: `skill_id ${skillId} appears more than once in this file; no row for it will be applied.` });
      const skill = existing.find(item => item.entityId === skillId);
      if (!skill) return finish('REVIEW_REQUIRED', { problem: `Unknown canonical skill_id ${skillId}.` });
      const match = { matchedSkillId: skill.entityId, matchedSkillName: skillRecordName(skill), matchedSkillGroup: skillRecordGroup(skill) };
      if (action === 'archive') return skill.archived ? finish('UNCHANGED', match) : finish('ARCHIVE', match);
      if (action === 'restore') return skill.archived ? finish('RESTORE', match) : finish('UNCHANGED', match);
      const changes = changesFor(skill, input);
      return changes.length ? finish('UPDATE', { ...match, changes }) : finish('UNCHANGED', match);
    }
    const pair = pairIdentity(input.group || '', input.name); const matches = byPair.get(pair) || [];
    if (seenPairs.has(pair)) return finish('DUPLICATE', { problem: 'The same normalized Skill group and name appears more than once in this file.' });
    seenPairs.add(pair);
    if (matches.length > 1) return finish('REVIEW_REQUIRED', { problem: 'More than one canonical Skill matches this normalized group and name.' });
    if (matches.length === 1) {
      const skill = matches[0]!; const match = { matchedSkillId: skill.entityId, matchedSkillName: skillRecordName(skill), matchedSkillGroup: skillRecordGroup(skill) }; const changes = changesFor(skill, input);
      return changes.length ? finish('UPDATE', { ...match, changes }) : finish('UNCHANGED', match);
    }
    const sameName = byName.get(identity(input.name)) || [];
    if (sameName.length) { const same = sameName[0]!; return finish(sameName.length > 1 ? 'REVIEW_REQUIRED' : 'DUPLICATE', { problem: 'A canonical Skill with this normalized name already exists in another group.', matchedSkillId: same.entityId, matchedSkillName: skillRecordName(same), matchedSkillGroup: skillRecordGroup(same) }); }
    return finish('NEW');
  });
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return { rows, counts, totalRows: rows.length };
}

export interface SkillCsvMutations {
  create: (input: CanonicalSkillInput) => Promise<CanonicalSkillRecord>;
  update: (entityId: string, input: CanonicalSkillInput) => Promise<CanonicalSkillRecord>;
  archive: (entityId: string, archived: boolean) => Promise<CanonicalSkillRecord>;
}
export async function applySkillCsvRows(rows: SkillCsvPreviewRow[], mutations: SkillCsvMutations): Promise<number> {
  let applied = 0;
  for (const row of rows.filter(item => item.included)) {
    if (row.status === 'NEW') await mutations.create(row.input);
    else if (row.status === 'UPDATE' && row.matchedSkillId) await mutations.update(row.matchedSkillId, row.input);
    else if (row.status === 'ARCHIVE' && row.matchedSkillId) await mutations.archive(row.matchedSkillId, true);
    else if (row.status === 'RESTORE' && row.matchedSkillId) await mutations.archive(row.matchedSkillId, false);
    else continue;
    applied += 1;
  }
  return applied;
}

const escapeCsv = (value: string) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
export function exportSkillsCsv(skills: CanonicalSkillRecord[]): string {
  const lines = [SKILL_CSV_COLUMNS.join(',')];
  for (const skill of [...skills].sort((a, b) => skillRecordGroup(a).localeCompare(skillRecordGroup(b), 'en-GB') || skillRecordName(a).localeCompare(skillRecordName(b), 'en-GB'))) {
    const c = skill.competenceDefinitions || {};
    lines.push(['1', skill.archived ? 'archive' : 'upsert', skill.entityId, skillRecordGroup(skill), skillRecordName(skill), skill.description || '', c.foundation || '', c.developing || '', c.competent || '', c.advanced || '', c.mastered || ''].map(value => escapeCsv(value)).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
