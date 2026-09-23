import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { RecreationalGasPlanner } from '../components/planning/recreational-gas-planner';
import { T14GasPlanEditor } from '../components/planning/t14-gas-plan-editor';
import type { StoredEnrichedDivePlan } from '../lib/offline/dive-planning-centre';
import { initialRecreationalInput } from '../lib/gas-allocation/editor-input';
import { buildRecreationalGasSnapshot } from '../lib/offline/recreational-gas-planner';
describe('T14 gas editor supply integration', () => {
  it('retains legacy linked-Plan depth, duration and multilevel intent when creating a gas draft', () => {
    const linked = {
      entityId: 'legacy-plan',
      name: 'Legacy linked Plan',
      maxDepthM: 22,
      bottomTimeMin: 25,
      multiLevel: true,
      startDate: '2026-09-24',
    } as StoredEnrichedDivePlan;
    const html = renderToStaticMarkup(
      createElement(T14GasPlanEditor, {
        item: null,
        newGasPlanFor: linked.entityId,
        divePlans: [linked],
        equipment: [],
        fills: [],
        analyses: [],
        dives: [],
        trips: [],
        sites: [],
        rmvBaseline: { litresPerMinute: 15, observationCount: 0, diveIds: [] },
        close: () => {},
        saved: () => {},
      }),
    );
    expect(html).toMatch(/Planned depth \(m\)<input[^>]*value="22"/);
    expect(html).toMatch(/Planned working time \(min\)<input[^>]*value="25"/);
    expect(html).toContain('<option value="multilevel" selected="">');
  });
  it('places supply commitments after depth and requirements and uses exact supply choices', () => {
    const input = {
      ...initialRecreationalInput(null, {
        litresPerMinute: 15,
        observationCount: 0,
        diveIds: [],
      }),
      mode: 'multilevel' as const,
      plannedWorkingTimeMin: 10,
      routeSegments: [
        {
          id: 'leg',
          label: 'Working leg',
          depthM: 20,
          minutes: 10,
          cylinderId: 'left',
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(RecreationalGasPlanner, {
        input,
        snapshot: buildRecreationalGasSnapshot(input),
        error: null,
        change: () => {},
        allocationMode: true,
        supplyChoices: [
          { id: 'left', label: 'Independent left' },
          { id: 'right', label: 'Independent right' },
        ],
        supplyContent: createElement('section', null, 'Supply commitments'),
      }),
    );
    expect(html.indexOf('Supply commitments')).toBeGreaterThan(
      html.indexOf('Gas time &amp; emergency reserve'),
    );
    expect(html).toContain(
      '<option value="left" selected="">Independent left</option>',
    );
    expect(html).toContain('Frozen single-supply reference');
    expect(html).toContain('does not establish overall readiness');
    expect(html).toContain('Help: Stress factor');
  });
});
