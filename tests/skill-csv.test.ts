import { describe, expect, it, vi } from 'vitest';
import type { CanonicalSkillRecord } from '../lib/offline/dive-context';
import { applySkillCsvRows, exportSkillsCsv, parseCsv, previewSkillCsv, SKILL_CSV_COLUMNS } from '../lib/skills/skill-csv';

const header = SKILL_CSV_COLUMNS.join(',');
const rich: CanonicalSkillRecord = {
  entityId: 'skill-1', skillKey: 'skill-1', group: 'Buoyancy & Trim', name: 'Air-sharing stop control',
  description: 'Maintain depth, contact and gas awareness.', archived: false,
  competenceDefinitions: { foundation: 'Coached', developing: 'Corrections', competent: 'Reliable', advanced: 'Communicates', mastered: 'Automatic' },
};
const row = (values: string[]) => values.map(value => /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join(',');

describe('canonical Skill CSV', () => {
  it('parses quoted commas, escaped quotes, embedded newlines and UTF-8', () => {
    const parsed = parseCsv(`${header}\r\n${row(['1','upsert','','Environment','Marine awareness','Recognise “ghost gear”, nets','Line 1\nLine 2','','','',''])}\r\n`);
    expect(parsed[1]?.[5]).toBe('Recognise “ghost gear”, nets');
    expect(parsed[1]?.[6]).toBe('Line 1\nLine 2');
  });

  it('classifies create, update by ID, unchanged, archive, restore, invalid and unknown ID without mutation', () => {
    const archived = { ...rich, entityId: 'skill-2', skillKey: 'skill-2', name: 'Hover', archived: true };
    const active = { ...rich, entityId: 'skill-3', skillKey: 'skill-3', name: 'Frog kick', group: 'Propulsion' };
    const csv = [header,
      row(['1','upsert','','Propulsion','Back kick','','','','','','']),
      row(['1','upsert','skill-1','Buoyancy & Trim','Air-sharing stop control','Changed','','','','','']),
      row(['1','upsert','','Buoyancy & Trim','Air-sharing stop control','Maintain depth, contact and gas awareness.','Coached','Corrections','Reliable','Communicates','Automatic']),
      row(['1','archive','skill-3','Propulsion','Frog kick','','','','','','']),
      row(['1','restore','skill-2','Buoyancy & Trim','Hover','','','','','','']),
      row(['2','upsert','','Other','Bad schema','','','','','','']),
      row(['1','upsert','missing','Other','Unknown','','','','','','']),
    ].join('\n');
    const result = previewSkillCsv(csv, [rich, archived, active]);
    expect(result.rows.map(item => item.status)).toEqual(['NEW','UPDATE','UNCHANGED','ARCHIVE','RESTORE','INVALID','REVIEW_REQUIRED']);
    expect(result.rows.find(item => item.status === 'UPDATE')?.changes).toContainEqual({ field: 'description', from: rich.description, to: 'Changed' });
  });

  it('detects case/whitespace duplicates, ambiguous canonical matches and contradictory duplicate IDs', () => {
    const ambiguous = [{ ...rich, entityId: 'a' }, { ...rich, entityId: 'b' }];
    const csv = [header,
      row(['1','upsert','',' Buoyancy   & Trim ',' trim ','','','','','','']),
      row(['1','upsert','','Buoyancy & Trim','TRIM','','','','','','']),
      row(['1','upsert','','Buoyancy & Trim','Air-sharing stop control','','','','','','']),
      row(['1','archive','a','','','','','','','','']),
      row(['1','restore','a','','','','','','','','']),
    ].join('\n');
    const existing = [...ambiguous, { entityId: 'trim-id', name: 'Trim', group: 'Other' }];
    const result = previewSkillCsv(csv, existing);
    expect(result.rows[0]?.status).toBe('DUPLICATE');
    expect(result.rows[1]?.status).toBe('DUPLICATE');
    expect(result.rows[2]?.status).toBe('REVIEW_REQUIRED');
    expect(result.rows.slice(3).every(item => item.status === 'DUPLICATE')).toBe(true);
  });

  it('previews 20+ rows, applies only selected actionable rows, and never mutates during preview', async () => {
    const create = vi.fn(async input => ({ entityId: input.name, ...input } as CanonicalSkillRecord));
    const update = vi.fn(async (entityId, input) => ({ entityId, ...input } as CanonicalSkillRecord));
    const archive = vi.fn(async (entityId, archived) => ({ entityId, archived } as CanonicalSkillRecord));
    const lines = Array.from({ length: 21 }, (_, index) => row(['1','upsert','','Training',`Skill ${index + 1}`,'','','','','','']));
    const preview = previewSkillCsv([header, ...lines].join('\n'), []);
    expect(preview.counts.NEW).toBe(21); expect(create).not.toHaveBeenCalled();
    const selected = preview.rows.map((item, index) => ({ ...item, included: index !== 0 }));
    expect(await applySkillCsvRows(selected, { create, update, archive })).toBe(20);
    expect(create).toHaveBeenCalledTimes(20); expect(create).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'Skill 1' }));
  });

  it('exports exact columns, IDs and archive actions and is safely re-importable', () => {
    const archived = { ...rich, entityId: 'skill-2', skillKey: 'skill-2', name: 'Quoted "skill"', archived: true };
    const csv = exportSkillsCsv([rich, archived]);
    expect(csv.replace(/^\uFEFF/, '').split(/\r?\n/)[0]).toBe(header);
    const parsed = parseCsv(csv); expect(parsed[1]?.[2]).toBe('skill-1'); expect(parsed[2]?.[1]).toBe('archive');
    const preview = previewSkillCsv(csv, [rich, archived]);
    expect(preview.fatalError).toBeUndefined(); expect(preview.rows.every(item => item.status === 'UNCHANGED')).toBe(true);
  });
});
