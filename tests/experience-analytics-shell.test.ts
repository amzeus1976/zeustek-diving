import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AnalysisScopePanel} from '../components/insights/analysis-scope-panel';
import {DEFAULT_ANALYSIS_SCOPE} from '../lib/offline/experience-analytics';
const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('T09 shell integration', () => {
  it('mounts Insights in the current dashboard shell', () => {
    const source = read('app/dashboard-client.tsx');
    expect(source).toContain(
      "import { ExperienceAnalytics } from '@/components/experience-analytics';",
    );
    expect(source).toContain('Insights: BarChart3');
    expect(read('lib/workflow/workflow-model.ts')).toContain("{ route: 'Insights', label: 'Insights'");
    expect(source).toContain("active === 'Insights'");
  });
  it('keeps analytics derived rather than adding a canonical analytics kind', () => {
    const identity = read('lib/record-identity.ts');
    expect(identity).not.toMatch(/['"]analytics['"]/);
    for (const retained of [
      'site-overhead-profile',
      'dive-trip',
      'cylinder-fill',
      'gas-analysis',
      'currency-policy',
      'reference-requirement-set',
      'professional-pathway',
      'professional-evidence',
      'equipment-event',
    ]) {
      expect(identity).toContain(`'${retained}'`);
    }
    expect(read('lib/offline/experience-analytics.ts')).toContain(
      'canonicalDataChanged: false',
    );
  });
  it('uses the supplied diver hero asset and accessible detail dialog', () => {
    const component = read('components/experience-analytics.tsx');
    const css = read('components/experience-analytics.module.css');
    expect(css).toContain("url('/course-art/open-water-diver.webp')");
    expect(component).toContain('AccessibleDialog');
    expect(component).toContain('Saltwater vs freshwater');
    const scope=renderToStaticMarkup(createElement(AnalysisScopePanel,{value:DEFAULT_ANALYSIS_SCOPE,apply:()=>{},close:()=>{},sites:[],loadouts:[]}));
    expect(scope).toContain('Include pool dives');
    expect(scope).toContain('Include training dives');
    expect(scope).toContain('Water type');
    expect(component).toContain('Dive environment / activity');
    expect(component).toContain('Apply Saltwater to dashboard');
    expect(read('components/insights/analysis-source-records.tsx')).toContain("route:'Logbook',recordId:dive.entityId");
    expect(scope).toContain('data-record-editor-workspace');
    expect(scope).not.toContain('<dialog');
  });
});
