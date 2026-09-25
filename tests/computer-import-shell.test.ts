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
      "const DiveComputerData=lazy(()=>import('@/components/dive-computer-data').then(module=>({default:module.DiveComputerData})));",
    );
    expect(dashboard).toContain("active === 'Dive Computer Imports'");
    const workflow = read('lib/workflow/workflow-model.ts');
    expect(workflow).toContain(
      "route: 'Dive Computer Imports', label: 'Dive Computer Imports'",
    );
    expect(workflow).toContain("section: 'dive-data', implemented: true");
  });

  it('finishes import before optional Dive linking and exposes the post-import review controls', () => {
    const importUi = read('components/dive-computer-data.tsx');
    const reviewUi = read('components/imported-computer-profiles.tsx');
    expect(importUi).toContain('Import all new profiles');
    expect(importUi).toContain(
      'No Dive assignment or field decision is required',
    );
    expect(importUi).not.toContain('Continue to assignment');
    for (const label of [
      'Imported Profiles',
      'Unlinked profiles',
      'Linked profiles',
      'Excluded / deferred',
      'Possible matching Dive',
      'Link to Dive',
      'Unlink',
      'Remove import',
    ]) {
      expect(reviewUi).toContain(label);
    }
  });

  it('keeps removal dependency-aware and requires explicit typed confirmation', () => {
    const source = read('components/imported-computer-profiles.tsx');
    const management = read('lib/offline/computer-profile-management.ts');
    expect(source).toContain('Type REMOVE to confirm');
    expect(management).toContain(
      'Unlink the linked profiles before removing this import',
    );
    expect(source).toContain("confirmation !== 'REMOVE'");
  });
});
