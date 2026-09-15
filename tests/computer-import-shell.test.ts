import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('T12 shell', () => {
  it('adds generic canonical kinds without a computer-specific D1 table', () => {
    const identity = read('lib/record-identity.ts');
    for (const kind of [
      'computer-import',
      'computer-profile',
      'import-resolution',
    ]) {
      expect(identity).toContain(`'${kind}'`);
    }
    expect(read('lib/offline/computer-import.ts')).toContain(
      'mutateEntitiesAtomically',
    );
  });

  it('keeps release fail-closed until source/profile evidence has local backup and cloud sync', () => {
    const source = read('lib/offline/computer-import.ts');
    expect(source).toContain('evidenceStore.capabilities.localBackup');
    expect(source).toContain('evidenceStore.capabilities.cloudSync');
  });

  it('mounts Dive Computer Imports as one current-app route', () => {
    const dashboard = read('app/dashboard-client.tsx');
    expect(dashboard).toContain(
      "import { DiveComputerData } from '@/components/dive-computer-data';",
    );
    expect(dashboard).toContain("active === 'Dive Computer Imports'");
    const workflow = read('lib/workflow/workflow-model.ts');
    expect(workflow).toContain(
      "route: 'Dive Computer Imports', label: 'Dive Computer Imports'",
    );
    expect(workflow).toContain("section: 'dive-data', implemented: true");
  });
});
