import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('Stage 9 record editor isolation', () => {
  it.each([
    ['Sites', 'app/dashboard-client.tsx', 'if (adding) return <div className="t14-record-domain t14-sites"><SiteV2Form', '<div className="site-list">'],
    ['Trips', 'components/trips-expeditions.tsx', 'if (adding) return <TripEditor', '<div className={styles.grid}>'],
    ['Skills', 'components/skill-catalogue.tsx', 'if (editor !== undefined) return <SkillEditor', 'className="skill-catalogue-list"'],
    ['Calendar', 'components/planning/diving-calendar-bookings.tsx', 'if (editing !== undefined) return <BookingEditor', '<div className={styles.shell}>'],
    ['Conservation', 'components/conservation-page.tsx', 'if (adding) return <section className="conservation-page"><ActivityForm', '<div className="conservation-grid">'],
    ['Logbook Dive', 'app/dashboard-client.tsx', 'if (editing) return <DiveModal', '<div className="log-list">'],
    ['Logbook Dive detail', 'app/dashboard-client.tsx', 'if (viewing) return (\n    <DiveRecordDetail', '<div className="log-list">'],
    ['Imported profile link', 'components/imported-computer-profiles.tsx', 'if (linking) return (', '<div className={styles.profileRows}>'],
    ['Staged import', 'components/dive-computer-data.tsx', 'if (reviewing) return (', 'className={styles.importSources}'],
    ['Bibliography', 'app/dashboard-client.tsx', 'if (adding) return <DiveMediaForm', 'className="media-library-grid"'],
    ['Technical reference', 'components/technical-workspace.tsx', 'if (editingReference !== undefined) return <RequirementSetEditor', '<section className={styles.pathways}>'],
  ])('%s editor replaces its record-switching list', (_, path, editorBranch, listMarker) => {
    const code = source(path);
    const editor = code.indexOf(editorBranch);
    const list = code.indexOf(listMarker, editor);
    expect(editor).toBeGreaterThan(0);
    expect(list).toBeGreaterThan(editor);
  });

  it('keys each editor by its canonical record so draft state cannot transfer to another record', () => {
    expect(source('app/dashboard-client.tsx')).toContain('key={editing?.entityId ?? \'new-site\'}');
    expect(source('components/trips-expeditions.tsx')).toContain('key={editing?.entityId ?? \'new-trip\'}');
    expect(source('components/skill-catalogue.tsx')).toContain('key={editor?.entityId ?? \'new-skill\'}');
    expect(source('components/planning/diving-calendar-bookings.tsx')).toContain('key={editing?.entityId ?? \'new-booking\'}');
    expect(source('components/conservation-page.tsx')).toContain('key={editing?.entityId ?? \'new-activity\'}');
    expect(source('app/dashboard-client.tsx')).toContain('key={editing.entityId}');
    expect(source('components/imported-computer-profiles.tsx')).toContain('key={linking.entityId}');
    expect(source('components/dive-computer-data.tsx')).toContain('key={reviewing.sessionId}');
    expect(source('app/dashboard-client.tsx')).toContain("key={editing?.entityId ?? 'new-media'}");
    expect(source('components/technical-workspace.tsx')).toContain("key={editingReference?.entityId ?? 'new-reference'}");
  });

  it('isolates every Skill bulk, CSV and cleanup editor from catalogue edit controls', () => {
    const code = source('components/skill-catalogue.tsx');
    const catalogue = code.indexOf('return <section className="focus-card skill-catalogue"');
    for (const branch of ['if (bulkOpen) return <BulkSkillEditor', 'if (csvOpen) return <CsvImportDialog', 'if (cleanupOpen) return <CleanupDialog']) {
      const at = code.indexOf(branch);
      expect(at).toBeGreaterThan(0);
      expect(at).toBeLessThan(catalogue);
    }
  });

  it('guards collapse of a configuration card that contains a dirty editor', () => {
    const card = source('components/workflow/collapsible-work-card.tsx');
    expect(card).toContain("import {recordNavigation} from '../../lib/editor/navigation-guard'");
    expect(card).toContain('recordNavigation.request(() => setMinimized((value) => !value))');
  });

  it('guards parent import actions while a profile-link draft is open', () => {
    const code = source('components/dive-computer-data.tsx');
    expect(code).toContain("import { recordNavigation } from '../lib/editor/navigation-guard'");
    expect(code).toContain('recordNavigation.request(() => void pick(file))');
    expect(code).toContain('recordNavigation.request(() => setReviewing(stage))');
    expect(code).toContain('recordNavigation.request(() =>');
    expect(code).toContain('setSelectedProfile(');
  });

  it('guards the global Log dive action while another editor owns the route', () => {
    const code = source('app/dashboard-client.tsx');
    expect(code).toContain("import { recordNavigation } from '@/lib/editor/navigation-guard'");
    expect(code).toContain('const openNewDive = () => recordNavigation.request(() => { setDraftDive(null); setShowAdd(true); });');
    expect(code).toContain('onClick={openNewDive}');
    expect(code).toContain('<Logbook openLog={openNewDive} go={go} />');
    expect(code).toContain('if (showAdd) return <main className="focus-app"><section className="focus-shell"><div className="focus-content"><DiveModal');
  });
});
