import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const dataTools = readFileSync(new URL('../components/workflow/synthetic-fixture-review.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../app/dashboard-client.tsx', import.meta.url), 'utf8');
const planning = readFileSync(new URL('../components/dive-planning-centre.tsx', import.meta.url), 'utf8');
const media = readFileSync(new URL('../components/media-gallery.tsx', import.meta.url), 'utf8');
const evidence = readFileSync(new URL('../components/dive-record-detail.tsx', import.meta.url), 'utf8');

describe('T10.6 universal user-data controls shell', () => {
  it('has no default select-all and requires typed destructive confirmation', () => {
    expect(dataTools).toContain("useState<string[]>([])");
    expect(dataTools).toContain('DELETE ${deletionPlan.deleteIds.length} SAFE RECORDS');
    expect(dataTools).toContain('!scanComplete || !deletionPlan.deleteIds.length');
    expect(dataTools).toContain('confirmation !== deletePhrase');
    expect(dataTools).not.toContain('Select all');
  });

  it('provides details, metadata edit, delete, archive and unlink controls', () => {
    for (const label of ['Available safe action', 'Edit', 'Delete', 'Archive / suppress', 'Unlink only', 'Manual dependency review']) expect(dataTools).toContain(label);
    expect(dataTools).toContain('recordActionReason');
    expect(dataTools).toContain('data-opens-detail');
    expect(dataTools).not.toContain('View details');
    expect(dataTools).toContain('saveLocalRecord');
    expect(dataTools).toContain('deleteLocalRecord');
  });

  it('keeps representative native controls and immutable Plan-to-Dive workflow present', () => {
    expect(dashboard).toContain('Synthetic data & record controls');
    expect(dashboard).toContain('deleteCertification');
    expect(planning).toContain('Save / edit draft');
    expect(planning).toContain('Log dive');
    expect(planning).toContain('Link logged dive');
    expect(media).toContain('Edit selected files');
    expect(media).toContain('Delete selected files');
    expect(evidence).toContain('Unlink evidence');
    expect(evidence).toContain('Delete evidence');
  });

  it('keeps aliases, Insights and Planning routes in the application shell', () => {
    expect(dashboard).toContain("active === 'Insights'");
    expect(dashboard).toContain("active === 'Dive Plans'");
    expect(dashboard).toContain("active === 'Settings'");
  });
});
