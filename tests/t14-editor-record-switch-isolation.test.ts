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
  });

  it('guards collapse of a configuration card that contains a dirty editor', () => {
    const card = source('components/workflow/collapsible-work-card.tsx');
    expect(card).toContain("import {recordNavigation} from '../../lib/editor/navigation-guard'");
    expect(card).toContain('recordNavigation.request(() => setMinimized((value) => !value))');
  });
});
