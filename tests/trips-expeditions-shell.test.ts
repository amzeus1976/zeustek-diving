import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIVE_RECORD_KINDS } from '../lib/record-identity';

const read = (path: string) => readFileSync(path, 'utf8');

describe('T04 Trips & Expeditions shell integration', () => {
  it('registers a distinct dive-trip record kind without repurposing legacy trip Plans', () => {
    expect(DIVE_RECORD_KINDS).toContain('trip');
    expect(DIVE_RECORD_KINDS).toContain('dive-trip');
    const planning = read('lib/offline/dive-planning.ts');
    expect(planning).toContain("listRecords<DiveTripRecord>('trip')");
    expect(planning).toContain("saveRecord('trip', input)");
  });

  it('adds Trips as a separate navigation destination', () => {
    const dashboard = read('app/dashboard-client.tsx');
    expect(dashboard).toContain("import { TripsExpeditions } from '@/components/trips-expeditions'");
    expect(dashboard).toContain("['Trips', ShipWheel]");
    expect(dashboard).toContain("active === 'Trips' && <TripsExpeditions />");
  });

  it('keeps document attachment ids in sync when common media is removed', () => {
    const media = read('components/media-gallery.tsx');
    expect(media).toContain('onRemoved?: (id: string) => Promise<void>');
    expect(media).toContain("if (!response.ok)");
    expect(media).toContain('if (onRemoved) await onRemoved(id)');
  });

  it('preserves T03 containment and reuses common private evidence files and protected Trip editors', () => {
    expect(DIVE_RECORD_KINDS).toContain('site-overhead-profile');
    const source=read('components/trips-expeditions.tsx');
    expect(source).toContain('<AccessibleDialog editable dirty={dirty}');
    expect(source).toContain('<TripResources');
    expect(read('components/trip-resources.tsx')).toContain('acceptFiles retainOfflineMetadata accessibleViewer');
    const mediaKinds = read('app/api/media/route.ts').match(/const conservationFile = \[([^\]]+)\]\.includes\(ownerKind\)/)?.[1] ?? '';
    for (const kind of ['conservation_activity','site-overhead-profile','dive-trip','gas-analysis']) expect(mediaKinds).toContain(`'${kind}'`);
    expect(read('components/site-overhead-profile.tsx')).toContain('onKeyDown={handleOverheadEscape}');
  });
});
