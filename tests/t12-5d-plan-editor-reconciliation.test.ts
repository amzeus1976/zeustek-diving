import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, pendingDiveChanges } from '../lib/offline/dive-store';
import { listEnrichedDivePlans, saveEnrichedDivePlan } from '../lib/offline/dive-planning-centre';
import { matchSiteChoice, siteChoiceLabel, siteMapQuery } from '../lib/offline/plan-site-choice';
import type { DiveSiteRecord, Stored } from '../lib/offline/dive-planning';

const editor = () => readFileSync(resolve(process.cwd(), 'components/dive-planning-centre.tsx'), 'utf8');

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn());
  configureDiveStore('t12-5d-test');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('Sites108 Plan editor baseline reconciliation', () => {
  it('uses search-and-add for People and Skills, never the stale checkbox catalogue', () => {
    const source = editor();
    expect(source).toContain('aria-label="Matching People"');
    expect(source).toContain('aria-label="Selected Dive team"');
    expect(source).toContain('>+ Add {person.name}</button>');
    expect(source).toContain('aria-label="Matching Dive Skills"');
    expect(source).toContain('aria-label="Selected planned Skills"');
    expect(source).toContain('>+ Add {skillRecordName(skill)}</button>');
    expect(source).not.toContain('className={styles.choiceList}>{people.filter(');
    expect(source).not.toContain('className={styles.choiceList}>{skills.filter(');
    expect(source).toContain("onClick={()=>update({planTeam:(draft.planTeam??[]).filter(row=>row.personId!==member.personId)})}");
  });

  it('retains spaces during controlled multiline typing, and uses compact accessible help', () => {
    const source = editor();
    expect(source).toContain("goals:e.target.value.split('\\n')");
    expect(source).toContain("secondaryObjectives:e.target.value.split('\\n')");
    expect(source).not.toContain("e.target.value.split('\\n').map(value=>value.trim()).filter(Boolean)");
    expect(source).not.toContain("e.target.value.split('\\n').map((v:string)=>v.trim()).filter(Boolean)");
    expect(source).toContain('aria-label="About duplicate Site selection"');
    expect(source).toContain('aria-label="About team capability"');
    expect(readFileSync(resolve(process.cwd(), 'components/dive-planning-centre.module.css'), 'utf8')).toContain('.editorGrid label>.infoButton');
  });

  it('renders canonical Site facts and disambiguates identical names using stable IDs', () => {
    const sites = [
      { entityId: 'site-first', name: 'Twin Quarry', location: 'North', waterType: 'freshwater', maxDepthM: 20 },
      { entityId: 'site-second', name: 'Twin Quarry', location: 'South', waterType: 'freshwater', maxDepthM: 30 },
    ] as unknown as Array<Stored<DiveSiteRecord>>;
    expect(siteChoiceLabel(sites[0]!)).not.toBe(siteChoiceLabel(sites[1]!));
    expect(matchSiteChoice(sites, 'Twin Quarry')).toBeNull();
    expect(matchSiteChoice(sites, siteChoiceLabel(sites[1]!))?.entityId).toBe('site-second');
    expect(siteMapQuery({ name: 'Unlocated' } as DiveSiteRecord)).toBeNull();
    const source = editor();
    expect(source).toContain('aria-label="Canonical Site facts"');
    expect(source).toContain('Site maximum depth');
    expect(source).toContain('Water type');
    expect(source).toContain('matchSiteChoice(sites,value)');
  });

  it('reopens offline with selected team members and planned skills intact', async () => {
    await saveEnrichedDivePlan({
      entityId: 'plan-108', name: 'Reconciliation check', planType: 'day-dive',
      startDate: '2026-09-20', endDate: '2026-09-20', siteName: 'Twin Quarry',
      buddy: '', status: 'planned', notes: '', siteId: 'site-second',
      planTeam: [{ personId: 'person-one', role: 'Team leader', teamLead: true }],
      plannedSkillKeys: ['skill-one', 'skill-two'],
    });
    const original = (await listEnrichedDivePlans())[0]!;
    await saveEnrichedDivePlan({ ...original, entityId: original.entityId, notes: 'Reopened and edited' });
    const reopened = (await listEnrichedDivePlans())[0]!;
    expect(reopened).toMatchObject({
      entityId: 'plan-108', siteId: 'site-second',
      planTeam: [{ personId: 'person-one', role: 'Team leader', teamLead: true }],
      plannedSkillKeys: ['skill-one', 'skill-two'],
    });
    expect((await pendingDiveChanges()).some((change) => change.key.endsWith(':plan-108'))).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
