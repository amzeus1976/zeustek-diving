import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('T11 Dive Knowledge shell', () => {
  const dashboard = read('app/dashboard-client.tsx');
  const workflow = read('lib/workflow/workflow-model.ts');
  const centre = read('components/knowledge-centre.tsx');
  const review = read('components/knowledge-review-workflow.tsx');

  it('mounts a standalone implemented Dive Knowledge page under Diving CPD', () => {
    expect(dashboard).toContain(
      "active === 'Dive Knowledge' && <KnowledgeCentre go={go}",
    );
    expect(dashboard).not.toContain("'Gas Planning','Dive Knowledge'");
    expect(workflow).toContain(
      "route: 'Dive Knowledge', label: 'Dive Knowledge'",
    );
    expect(workflow).toContain("section: 'diving-cpd', implemented: true");
    expect(centre).toContain('<h1>Dive Knowledge</h1>');
    expect(centre).not.toContain('Back to Dive Media');
  });

  it('uses the five compact workbench cards and current workflow links', () => {
    for (const title of [
      'Question Banks',
      'Take Test',
      'Review & Diagnostics',
      'Study Packs',
      'AI Review Export',
    ])
      expect(`${centre}\n${review}`).toContain(`title="${title}"`);
    for (const route of ['Dive Media', 'Skills & Currency', 'Course Map'])
      expect(centre).toContain(`route: '${route}'`);
    expect(`${centre}\n${review}`).toContain('CollapsibleWorkCard');
    expect(`${centre}\n${review}`).not.toContain('Open detail');
  });

  it('keeps every required review reason and historical-attempt warning reachable', () => {
    const domain = read('lib/offline/learning-review.ts');
    for (const reason of [
      'Incorrect answer / answer key',
      'Poor wording',
      'Missing diagram / media',
      'Ambiguous',
      'Duplicate',
      'Wrong topic',
      'Obsolete',
      'Bad explanation',
      'Technical issue',
      'Other',
    ])
      expect(domain).toContain(reason);
    expect(review).toContain('Historical attempt snapshots');
    expect(review).toContain('remain unchanged and auditable');
    expect(review).toContain('Restore to future tests');
  });

  it('adds only additive review/advice kinds and the shared atomic batch path', () => {
    const identity = read('lib/record-identity.ts');
    for (const kind of [
      'question-review-state',
      'learning-ai-checkpoint',
      'learning-ai-advice',
    ])
      expect(identity).toContain(`'${kind}'`);
    expect(identity.match(/'test-attempt'/g)?.length).toBe(1);
    const batch = read('lib/offline/batch-mutations.ts');
    expect(batch).toContain('zeustekDb.transaction');
    expect(batch).toContain('failAfterMutation');
    expect(batch).toContain('zeustekDb.outbox.add');
  });
});
