'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Cylinder,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { AccessibleDialog } from '../accessible-dialog';
import { useRecordRefresh } from '../record-status';
import { CollapsibleWorkCard } from '../workflow/collapsible-work-card';
import { ZeusTekIcon } from '../zeustek-icon';
import { listDiveSites, type DiveSiteRecord, type Stored } from '../../lib/offline/dive-planning';
import type { StoredEnrichedDivePlan } from '../../lib/offline/dive-planning-centre';
import type { DiveRecord } from '../../lib/offline/dives';
import { listDiveExpeditionTrips, type DiveExpeditionTripRecord } from '../../lib/offline/trips-expeditions';
import { flightProximity, previousDiveContext } from '../../lib/offline/plan-context-checks';
import {
  deriveCylinderInspectionSchedule,
  gasMixLabel,
  type CylinderEquipmentRecord,
  type CylinderFillRecord,
  type GasAnalysisRecord,
} from '../../lib/offline/loadouts-gas';
import {
  cylinderPickerSummary,
  deleteGasPlan,
  fractionLabel,
  planningPageSources,
  projectGasCylinder,
  rentalCylinderRecreationalInput,
  saveGasPlan,
  saveGasPlanNotesToDivePlan,
  saveRentalCylinderAsOwned,
  setGasCylinderSourceMode,
  warnGasPlan,
  type GasPlanCylinder,
  type GasPlanRecord,
  type RentalCylinderSnapshot,
  type RmvBaseline,
  type StoredGasPlanRecord,
} from '../../lib/offline/planning-pages';
import {
  bestOxygenFraction,
  conservativeOxygenFraction,
  equivalentAirDepth,
  GAS_FORMULA_PROVENANCE,
  GAS_PLANNING_CAUTION,
  NDL_UNCONFIGURED,
  type GasDepthSegment,
} from '../../lib/offline/gas-planning-foundation';
import styles from './planning-pages.module.css';
import { RecreationalGasPlanner } from './recreational-gas-planner';
import { buildRecreationalGasSnapshot, recreationalReadinessBlockers, type RecreationalGasInput } from '../../lib/offline/recreational-gas-planner';

type Props = { go?: (route: string) => void };
type GasPlanDraft = GasPlanRecord & { entityId?: string };
const GAS_HELP = {
  'Depth limits': 'Site, owner-entered user and team depth limits are separate. The lowest known limit applies, and unknown capability is not a pass. Verify training evidence independently.',
  'Gas aggregation': 'Overall gas needed is Unknown when multiple cylinders have no explicit segment assignments; show per-cylinder values instead.',
  'Gas needed': 'This gas estimate uses recorded RMV, depth and minutes. Missing inputs remain Unknown; ascent, stops and contingencies require separate planning.',
  'PPO₂ / MOD': 'PPO₂ is oxygen fraction multiplied by absolute pressure. MOD is the depth where the selected target PPO₂ is reached.',
  Reserve: 'Usable gas deducts the recorded reserve pressure. Missing size or pressure evidence remains Unknown.',
} as const;

const nowIso = () => new Date().toISOString();

function emptyPlan(
  divePlan: StoredEnrichedDivePlan | undefined,
  baseline: RmvBaseline,
): GasPlanDraft {
  const now = nowIso();
  return {
    name: divePlan ? `${divePlan.name} gas plan` : '',
    divePlanId: divePlan?.entityId ?? null,
    status: 'draft',
    plannedDepthM: divePlan?.plannedMaxDepthM ?? divePlan?.maxDepthM ?? null,
    plannedBottomTimeMin:
      divePlan?.plannedDurationMin ?? divePlan?.bottomTimeMin ?? null,
    depthSegments: [],
    manualStops: [],
    multiLevel: divePlan?.multiLevel ?? false,
    reserveStrategy: 'fixed',
    sacRateBarMin: null,
    rmvRateLitresMin: baseline.litresPerMinute,
    rmvSource: baseline.litresPerMinute == null ? null : 'logbook-average',
    rmvSourceDiveIds: baseline.diveIds,
    cylinders: [],
    warnings: [],
    notes: '',
    createdAt: now,
    modifiedAt: now,
  };
}

function fillFor(
  cylinder: GasPlanCylinder,
  fills: Array<Stored<CylinderFillRecord>>,
) {
  if (cylinder.fillId)
    return fills.find((item) => item.entityId === cylinder.fillId);
  return [...fills]
    .filter((item) => item.cylinderEquipmentId === cylinder.cylinderEquipmentId)
    .sort((left, right) => right.filledAt.localeCompare(left.filledAt))[0];
}

function analysisFor(
  cylinder: GasPlanCylinder,
  analyses: Array<Stored<GasAnalysisRecord>>,
  fill: Stored<CylinderFillRecord> | undefined,
  fills: Array<Stored<CylinderFillRecord>>,
) {
  if (!fill) return undefined;
  const latestFill = fills.filter(row => row.cylinderEquipmentId === cylinder.cylinderEquipmentId).sort((a, b) => b.filledAt.localeCompare(a.filledAt))[0];
  const rootFillId = fill.originFillId || fill.entityId;
  const latestRootFillId = latestFill?.originFillId || latestFill?.entityId;
  if (latestRootFillId !== rootFillId) return undefined;
  const rootFill = fills.find(row => row.entityId === rootFillId) ?? fill;
  const eligible = analyses.filter((item) => item.fillId === rootFillId && item.cylinderEquipmentId === fill.cylinderEquipmentId && !item.markedStaleAt && Date.parse(item.analysedAt) >= Date.parse(rootFill.filledAt));
  if (cylinder.analysisId)
    return eligible.find((item) => item.entityId === cylinder.analysisId);
  return [...analyses]
    .filter((item) => eligible.some((row) => row.entityId === item.entityId))
    .sort((left, right) => right.analysedAt.localeCompare(left.analysedAt))[0];
}

export function GasPlanning({ go }: Props) {
  const [plans, setPlans] = useState<StoredGasPlanRecord[]>([]);
  const [divePlans, setDivePlans] = useState<StoredEnrichedDivePlan[]>([]);
  const [fills, setFills] = useState<Array<Stored<CylinderFillRecord>>>([]);
  const [analyses, setAnalyses] = useState<Array<Stored<GasAnalysisRecord>>>(
    [],
  );
  const [equipment, setEquipment] = useState<
    Array<Stored<CylinderEquipmentRecord>>
  >([]);
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>([]);
  const [trips, setTrips] = useState<Array<Stored<DiveExpeditionTripRecord>>>([]);
  const [sites, setSites] = useState<Array<Stored<DiveSiteRecord>>>([]);
  const [rmvBaseline, setRmvBaseline] = useState<RmvBaseline>({
    litresPerMinute: null,
    observationCount: 0,
    diveIds: [],
  });
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState<
    StoredGasPlanRecord | null | undefined
  >(undefined);
  const [newGasPlanFor, setNewGasPlanFor] = useState<string | null>(null);
  const openedDeepLink = useRef(false);
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    const [sources, tripRecords, siteRecords] = await Promise.all([
      planningPageSources(),
      listDiveExpeditionTrips(),
      listDiveSites(),
    ]);
    setPlans(
      [...sources.gasPlans].sort((left, right) =>
        right.modifiedAt.localeCompare(left.modifiedAt),
      ),
    );
    setDivePlans(sources.divePlans);
    setFills(sources.fills);
    setAnalyses(sources.analyses);
    setRmvBaseline(sources.rmvBaseline);
    setDives(sources.dives);
    setTrips(tripRecords);
    setSites(siteRecords);
    setEquipment(sources.cylinders);
  }, []);
  useRecordRefresh(refresh);
  useEffect(() => {
    if (openedDeepLink.current || !divePlans.length) return;
    const params = new URLSearchParams(window.location.search);
    const newFor = params.get('newGasPlanFor');
    if (newFor && divePlans.some(plan => plan.entityId === newFor)) {
      openedDeepLink.current = true;
      params.delete('newGasPlanFor');
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${params.size ? `?${params}` : ''}${window.location.hash}`);
      const frame = requestAnimationFrame(() => { setNewGasPlanFor(newFor); setEditing(null); });
      return () => cancelAnimationFrame(frame);
    }
    const linkedGasId = params.get('gasPlanId');
    if (linkedGasId && plans.some(plan => plan.entityId === linkedGasId)) {
      openedDeepLink.current = true;
      const frame = requestAnimationFrame(() => setSelectedId(linkedGasId));
      return () => cancelAnimationFrame(frame);
    }
  }, [divePlans, plans]);

  const filtered = useMemo(
    () =>
      plans.filter(
        (plan) =>
          !query.trim() ||
          `${plan.name} ${plan.notes} ${plan.status}`
            .toLocaleLowerCase('en-GB')
            .includes(query.trim().toLocaleLowerCase('en-GB')),
      ),
    [plans, query],
  );
  const selected =
    plans.find((item) => item.entityId === selectedId) ?? filtered[0] ?? null;
  const selectedDivePlan = selected?.divePlanId
    ? divePlans.find((plan) => plan.entityId === selected.divePlanId)
    : null;
  const selectedTrip = selectedDivePlan?.tripId ? trips.find(trip => trip.entityId === selectedDivePlan.tripId) : null;
  const selectedSite = selectedDivePlan?.siteId ? sites.find(site => site.entityId === selectedDivePlan.siteId) : null;
  const previousDive = selectedDivePlan ? previousDiveContext(selectedDivePlan, dives) : null;
  const flight = selectedDivePlan ? flightProximity(selectedDivePlan, selectedTrip) : null;
  const [warningsOpen, setWarningsOpen] = useState(false);
  const warnings = selected ? warnGasPlan(selected, fills, equipment, analyses) : [];
  const projections = selected ? selected.cylinders.map(cylinder => projectGasCylinder(cylinder, selected, fills, analyses, equipment)) : [];
  const availableValues = projections.map(projection => projection.volume?.usableLitres ?? null);
  const gasAvailable = availableValues.length && availableValues.every((value): value is number => value !== null) ? availableValues.reduce((sum, value) => sum + value, 0) : null;
  const gasNeeded = projections.length === 1 ? projections[0]?.requiredLitres ?? null : null;
  const multiCylinderReason = selected && selected.cylinders.length > 1
    ? 'Overall gas needed is Unknown for multiple cylinders without explicit depth/time segment assignments. Per-cylinder requirements are shown below; cylinders are not interchangeable.'
    : null;
  const detailedWarnings = [...new Set([
    ...warnings,
    ...(selected?.recGasPlan101?.warnings ?? []),
    ...projections.flatMap(projection => projection.warnings),
    ...(previousDive?.warning ? [previousDive.warning] : []),
    ...(flight?.warning ? [flight.warning] : []),
    ...(selected?.manualStops?.length ? ['Gas-needed estimates exclude manually recorded stops, ascent and contingency gas; verify the full profile independently.'] : []),
  ])];

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroTitle}>
          <ZeusTekIcon id="gas-mix" size="hero" />
          <div>
            <span className="focus-eyebrow">PLANNING</span>
            <h1>Gas Planning</h1>
            <p>
              Link a Dive Plan, select current cylinder evidence and compare a
              basic gas estimate. This is not decompression software.
            </p>
          </div>
        </div>
        <button className="focus-primary" onClick={() => setEditing(null)}>
          <Plus size={16} /> New gas plan
        </button>
      </header>

      <div className={styles.shell}>
        <aside className={styles.sideRail}>
          <h2>Planning context</h2>
          <ul>
            <li>Link an existing Dive Plan</li>
            <li>Select canonical cylinders or add rental/temporary snapshots</li>
            <li>Use a Logbook RMV baseline or enter a manual override</li>
            <li>Compare basic gas needed with available usable gas</li>
            <li>Keep reserve, turn, end-pressure and team notes together</li>
          </ul>
          <h3>Evidence source</h3>
          <p>
            Owned cylinders, fills and analyses come from Cylinders &amp; Gas.
            Rental snapshots remain inside their Gas Plan unless explicitly
            saved as an owned cylinder.
          </p>
          <button
            className="focus-secondary"
            onClick={() => go?.('Loadouts & Gas')}
          >
            Open Loadouts &amp; Gas
          </button>
          <button
            className="focus-secondary"
            onClick={() => go?.('Dive Plans')}
          >
            Open Dive Planning Centre
          </button>
        </aside>

        <section className={styles.workArea}>
          <div className={styles.toolbar}>
            <input
              aria-label="Search gas plans"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search gas plans…"
            />
            <button
              className="focus-secondary"
              onClick={() => setEditing(null)}
            >
              <Plus size={14} /> New
            </button>
          </div>

          <CollapsibleWorkCard
            id="gas-planning-recent"
            title="Recent gas plans"
            eyebrow="GAS"
            rowCount={filtered.length}
            previewLimit={5}
            status={`${filtered.length} plan(s)`}
          >
            {({ expanded, previewLimit }) => (
              <div className={styles.eventList}>
                {filtered
                  .slice(0, expanded ? filtered.length : previewLimit)
                  .map((plan) => (
                    <button
                      key={plan.entityId}
                      className={
                        selected?.entityId === plan.entityId
                          ? styles.selectedRow
                          : ''
                      }
                      onClick={() => setSelectedId(plan.entityId)}
                    >
                      <ZeusTekIcon id="gas-mix" size="card" />
                      <span>
                        <b>{plan.name}</b>
                        <small>
                          {divePlans.find(
                            (item) => item.entityId === plan.divePlanId,
                          )?.name ?? 'Standalone'}{' '}
                          · {plan.cylinders.length} cylinder(s)
                        </small>
                      </span>
                      <em>{plan.status}</em>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                {!filtered.length ? (
                  <p className={styles.emptyCopy}>No gas plans yet.</p>
                ) : null}
              </div>
            )}
          </CollapsibleWorkCard>

          {selected ? (
            <>
              <CollapsibleWorkCard
                id="gas-planning-linked-plan"
                title="Linked Dive Plan"
                eyebrow="CONTEXT"
                status={flight?.state === 'overlap'
                  ? <span role="alert">⚠ Flight overlaps dive</span>
                  : flight?.state === 'within-24h'
                    ? <span role="alert">⚠ Flight within 24 h</span>
                  : flight?.state === 'unknown-timing'
                    ? <span role="alert">Flight timing unknown</span>
                    : selectedDivePlan?.name ?? 'Standalone'}
              >
                <div className={styles.linkedPlan}>
                  <ZeusTekIcon id="dive-plan" size="card" />
                  <span>
                    <b>{selectedDivePlan?.name ?? 'No Dive Plan linked'}</b>
                    <small>
                      {selectedDivePlan
                        ? `${selectedDivePlan.startDate} · ${selectedDivePlan.siteName || 'Site not selected'}`
                        : 'Link one in the editor.'}
                    </small>
                  </span>
                  <button
                    className="focus-secondary"
                    onClick={() => go?.('Dive Plans')}
                  >
                    View
                  </button>
                </div>
                {selectedDivePlan ? <div className={styles.contextChecks}>
                  <p>Planned dive #{selectedDivePlan.diveNumberOfDay ?? 'unknown'} of the day · {selectedDivePlan.multiLevel ? 'multi-level' : 'single-level / not marked'} · Site max {selectedSite?.maxDepthM ?? 'unknown'} m · planned max {selectedDivePlan.plannedMaxDepthM ?? 'unknown'} m · total duration {selectedDivePlan.maxTotalDurationMin ?? 'unknown'} min.</p>
                  {previousDive && <p role={previousDive.warning ? 'alert' : undefined}><strong>Previous dive / pressure group:</strong> {previousDive.summary} · recorded post-dive group {previousDive.pressureGroup ?? 'Unknown'}{previousDive.dataset ? ` (${previousDive.dataset})` : ''} · estimated interval to this plan {previousDive.surfaceIntervalMin ?? 'Unknown'} min.{previousDive.warning ? ` ${previousDive.warning}` : ''}</p>}
                  {flight && <p role={flight.warning ? 'alert' : undefined} className={flight.warning ? styles.safetyWarning : undefined}><strong>Trip flight:</strong> {flight.warning ?? (flight.state === 'no-flight-recorded' ? 'No flight recorded in linked Trip; this does not establish clearance.' : `${flight.flightLabel ?? 'Flight'} appears outside the 24-hour flag window; check dive computer and medical guidance.`)}{flight.flightStartsAt ? ` · ${flight.flightStartsAt}` : ''}{flight.provenance ? ` · ${flight.provenance}` : ''}</p>}
                  <p><strong>Recreational no-stop model:</strong> {selected.recGasPlan101 ? `${selected.recGasPlan101.selectedBuhlmannModel} · GF ${selected.recGasPlan101.gfLow}/${selected.recGasPlan101.gfHigh} · ${selected.recGasPlan101.waterType} water · ${selected.recGasPlan101.gasCandidates.find(row => row.selected)?.ndl.minutes ?? 'NDL unavailable'} min at depth` : 'Legacy Gas Plan — open Edit to calculate the T12.6R snapshot.'} No decompression schedule is generated.</p>
                </div> : null}
              </CollapsibleWorkCard>

              <CollapsibleWorkCard
                id="gas-planning-cylinders"
                title="Cylinders & gases"
                eyebrow="EVIDENCE"
                rowCount={selected.cylinders.length}
                previewLimit={4}
                status={`${selected.cylinders.length} selected`}
              >
                {({ expanded, previewLimit }) => (
                  <div className={styles.cylinderList}>
                    {selected.cylinders
                      .slice(
                        0,
                        expanded ? selected.cylinders.length : previewLimit,
                      )
                      .map((cylinder, index) => {
                        const fill = fillFor(cylinder, fills);
                        const analysis = analysisFor(cylinder, analyses, fill, fills);
                        const projection = projections[index];
                        const equipmentItem = equipment.find(
                          (item) =>
                            item.entityId === cylinder.cylinderEquipmentId,
                        );
                        return (
                          <article
                            key={cylinder.id}
                            className={styles.cylinderCard}
                          >
                            <ZeusTekIcon id="dive-cylinder" size="card" />
                            <span>
                              <b>
                                {cylinder.sourceMode === 'rental'
                                  ? `${cylinder.rentalSnapshot?.label || `Cylinder ${index + 1}`} · rental / temporary`
                                  : equipmentItem?.name ?? `Cylinder ${index + 1}`}
                              </b>
                              <small>
                                {cylinder.role} ·{' '}
                                {projection?.mix
                                  ? fractionLabel(projection.mix.oxygenFraction, projection.mix.heliumFraction)
                                  : analysis
                                    ? fractionLabel(analysis.oxygenFraction, analysis.heliumFraction)
                                    : cylinder.mixSource === 'manual'
                                      ? 'Manual mix (unverified)'
                                      : 'Analysed mix unknown'}
                              </small>
                            </span>
                            <em>
                              {projection?.startPressureEvidence.pressureBar ?? '—'}{' '}
                              bar
                            </em>
                          </article>
                        );
                      })}
                  </div>
                )}
              </CollapsibleWorkCard>

              <CollapsibleWorkCard
                id="gas-planning-summary"
                title="Gas summary"
                eyebrow="BASIC ESTIMATE"
                status={detailedWarnings.length ? <button
                  type="button"
                  className={styles.warningIconButton}
                  aria-label={`${detailedWarnings.length} gas planning warnings. Open warning details`}
                  title={detailedWarnings.join('\n')}
                  onClick={() => setWarningsOpen(true)}
                ><AlertTriangle size={16} aria-hidden="true" /> {detailedWarnings.length} warning(s)</button> : 'Ready to review'}
              >
                <div className={styles.summaryGrid}>
                  {selected.recGasPlan101 ? <>
                    <span><small>Selected gas NDL</small><b>{selected.recGasPlan101.gasCandidates.find(row => row.selected)?.ndl.minutes ?? '—'} min</b></span>
                    <span><small>Gas-limited time</small><b>{selected.recGasPlan101.gasCandidates.find(row => row.selected)?.gasLimitedTimeMin?.toFixed(1) ?? '—'} min</b></span>
                    <span><small>Emergency reserve</small><b>{selected.recGasPlan101.reserve.selectedLitres?.toFixed(0) ?? '—'} L</b></span>
                  </> : null}
                  <span>
                    <small>Planned depth</small>
                    <b>{selected.plannedDepthM ?? '—'} m</b>
                  </span>
                  <span>
                    <small>Bottom time</small>
                    <b>{selected.plannedBottomTimeMin ?? '—'} min</b>
                  </span>
                  <span>
                    <small>RMV</small>
                    <b>{selected.rmvRateLitresMin ?? '—'} L/min</b>
                  </span>
                  <span>
                    <small title={GAS_HELP['Gas needed']}>Segment gas needed</small>
                    <b>{gasNeeded ?? '—'} L</b>
                  </span>
                  <span>
                    <small>Gas available</small>
                    <b>{gasAvailable ?? '—'} L</b>
                  </span>
                </div>
                {multiCylinderReason ? <p className={styles.provenance} title={GAS_HELP['Gas aggregation']}>{multiCylinderReason}</p> : null}
                <div className={styles.formulaResults}>
                  {selected.cylinders.map((cylinder, index) => {
                    const projection = projections[index];
                    const depth = cylinder.depthM ?? selected.plannedDepthM;
                    const target = cylinder.targetPpo2 ?? 1.4;
                    const best = bestOxygenFraction(depth, target);
                    const conservative = conservativeOxygenFraction(depth, cylinder.conservatismM ?? 0, target);
                    const ead = projection?.mix ? equivalentAirDepth(projection.mix, depth) : null;
                    return <div key={cylinder.id}><strong>{cylinder.role} · {projection?.mix ? fractionLabel(projection.mix.oxygenFraction, projection.mix.heliumFraction) : 'Mix unknown'}</strong><span>PPO₂ {projection?.ppo2AtDepth?.toFixed(2) ?? 'Unknown'} bar · MOD {projection?.modM?.toFixed(1) ?? 'Unknown'} m · FN₂ {projection?.nitrogenFraction?.toFixed(3) ?? 'Unknown'}</span><span>Best mix O₂ {best == null ? 'Unknown' : `${(best*100).toFixed(1)}%`} · conservative O₂ {conservative == null ? 'Unknown' : `${(conservative*100).toFixed(1)}%`} · EAD {ead == null ? 'Unknown' : `${ead.toFixed(1)} m`}</span><span>Required {projection?.requiredLitres?.toFixed(0) ?? 'Unknown'} L · usable {projection?.volume?.usableLitres?.toFixed(0) ?? 'Unknown'} L · reserve {projection?.volume?.reserveLitres?.toFixed(0) ?? 'Unknown'} L</span><small>{projection?.mixProvenance ?? 'No mix evidence'}</small></div>;
                  })}
                </div>
                <p className={styles.provenance}>
                  RMV source:{' '}
                  {selected.rmvSource === 'logbook-average'
                    ? `${selected.rmvSourceDiveIds?.length ?? 0} Logbook dive(s)`
                    : selected.rmvSource === 'manual'
                      ? 'Manual override'
                      : 'Not recorded'}
                  . Gas available uses selected cylinder size, pressure and
                  reserve evidence.
                </p>
                <p className={styles.provenance}>{GAS_FORMULA_PROVENANCE} Segment estimates exclude ascent, stops and contingency gas. {selected.recGasPlan101 ? 'The recreational NDL is calculated by the selected Bühlmann model; table lookup is backup only.' : NDL_UNCONFIGURED}</p>
                <p className={styles.safetyWarning}>{GAS_PLANNING_CAUTION}</p>
                {detailedWarnings.length ? (
                  <ul className={styles.warningList}>
                    {detailedWarnings.map((warning) => (
                      <li key={warning}>
                        <AlertTriangle size={14} /> {warning}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CollapsibleWorkCard>
            </>
          ) : null}
        </section>

        <aside className={styles.detailPane}>
          {selected ? (
            <GasDetail
              plan={selected}
              divePlan={selectedDivePlan}
              edit={() => setEditing(selected)}
              remove={async () => {
                if (
                  !window.confirm(
                    `Delete “${selected.name}”? The linked Dive Plan and cylinder records will not be deleted.`,
                  )
                )
                  return;
                await deleteGasPlan(selected.entityId);
                setSelectedId('');
                await refresh();
              }}
              saveToPlan={async () => {
                if (selectedDivePlan)
                  await saveGasPlanNotesToDivePlan(selectedDivePlan, selected);
                await refresh();
              }}
            />
          ) : (
            <div className={styles.emptyPane}>
              <Cylinder />
              <h2>No gas plan selected</h2>
              <p>Create a gas plan or pick one from the list.</p>
            </div>
          )}
        </aside>
      </div>

      {editing !== undefined ? (
        <GasPlanEditor
          item={editing}
          newGasPlanFor={newGasPlanFor}
          divePlans={divePlans}
          equipment={equipment}
          fills={fills}
          analyses={analyses}
          dives={dives}
          trips={trips}
          sites={sites}
          rmvBaseline={rmvBaseline}
          close={() => setEditing(undefined)}
          saved={async () => {
            setEditing(undefined);
            await refresh();
          }}
        />
      ) : null}
      {warningsOpen && selected ? <AccessibleDialog label="Gas planning warnings" close={() => setWarningsOpen(false)} className="focus-modal">
        <header><h2>Gas planning warnings</h2><button type="button" className="focus-icon" aria-label="Close warnings" data-dialog-close onClick={() => setWarningsOpen(false)}><X /></button></header>
        <p>{GAS_PLANNING_CAUTION}</p>
        <ul className={styles.warningList}>{detailedWarnings.map(warning => <li key={warning}><AlertTriangle size={16} aria-hidden="true" /> {warning}</li>)}</ul>
        <footer><button type="button" className="focus-secondary" data-dialog-close onClick={() => setWarningsOpen(false)}>Close</button></footer>
      </AccessibleDialog> : null}
    </main>
  );
}

function GasDetail({
  plan,
  divePlan,
  edit,
  remove,
  saveToPlan,
}: {
  plan: StoredGasPlanRecord;
  divePlan: StoredEnrichedDivePlan | null | undefined;
  edit: () => void;
  remove: () => void;
  saveToPlan: () => Promise<void>;
}) {
  const [status, setStatus] = useState('');
  async function linkNotes() {
    setStatus('Saving…');
    try {
      await saveToPlan();
      setStatus('Gas plan notes linked to the Dive Plan.');
    } catch {
      setStatus(
        'The Dive Plan could not be updated. Your gas plan is unchanged.',
      );
    }
  }
  return (
    <section className={styles.detailCard}>
      <header>
        <ZeusTekIcon id="gas-mix" size="heading" />
        <div>
          <span className="focus-eyebrow">GAS PLAN DETAILS</span>
          <h2>{plan.name}</h2>
          <p>{divePlan?.name ?? 'Standalone gas plan'}</p>
        </div>
      </header>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{plan.status}</dd>
        </div>
        <div>
          <dt>Depth</dt>
          <dd>{plan.plannedDepthM ?? '—'} m</dd>
        </div>
        <div>
          <dt>Bottom time</dt>
          <dd>{plan.plannedBottomTimeMin ?? '—'} min</dd>
        </div>
        <div>
          <dt>RMV</dt>
          <dd>{plan.rmvRateLitresMin ?? '—'} L/min</dd>
        </div>
        <div>
          <dt>Notes</dt>
          <dd>{plan.notes || 'No notes yet.'}</dd>
        </div>
      </dl>
      <div className={styles.actionGrid}>
        <button className="focus-secondary" onClick={edit}>
          <Pencil size={14} /> Edit gas plan
        </button>
        <button
          className="focus-secondary"
          disabled={!divePlan}
          onClick={() => void linkNotes()}
        >
          <Save size={14} /> Save notes to Dive Plan
        </button>
        <button className="focus-secondary danger" onClick={remove}>
          <Trash2 size={14} /> Delete gas plan
        </button>
      </div>
      {status ? <output>{status}</output> : null}
    </section>
  );
}

function GasPlanEditor({
  item,
  newGasPlanFor,
  divePlans,
  equipment,
  fills,
  analyses,
  dives,
  trips,
  sites,
  rmvBaseline,
  close,
  saved,
}: {
  item: StoredGasPlanRecord | null;
  newGasPlanFor: string | null;
  divePlans: StoredEnrichedDivePlan[];
  equipment: Array<Stored<CylinderEquipmentRecord>>;
  fills: Array<Stored<CylinderFillRecord>>;
  analyses: Array<Stored<GasAnalysisRecord>>;
  dives: Array<DiveRecord & { entityId: string }>;
  trips: Array<Stored<DiveExpeditionTripRecord>>;
  sites: Array<Stored<DiveSiteRecord>>;
  rmvBaseline: RmvBaseline;
  close: () => void;
  saved: () => void;
}) {
  const [draft, setDraft] = useState<GasPlanDraft>(() =>
    item
      ? { ...item, cylinders: item.cylinders.map((row) => ({ ...row })) }
      : emptyPlan(divePlans.find(plan => plan.entityId === newGasPlanFor) ?? divePlans[0], rmvBaseline),
  );
  const [recInput, setRecInput] = useState<RecreationalGasInput>(() => {
    const saved = item?.recGasPlan101;
    return {
      mode: saved?.mode ?? (item?.multiLevel ? 'multilevel' : 'direct-ascent'),
      selectedBuhlmannModel: saved?.selectedBuhlmannModel ?? 'ZH-L16C',
      compareOtherModel: saved?.compareOtherModel ?? false,
      gfLow: saved?.gfLow ?? item?.gradientFactorLow ?? 40,
      gfHigh: saved?.gfHigh ?? item?.gradientFactorHigh ?? 85,
      waterType: saved?.waterType ?? 'salt', surfacePressureBar: saved?.surfacePressureBar ?? 1,
      plannedDepthM: saved?.plannedDepthM ?? item?.plannedDepthM ?? 30,
      conservatismM: saved?.conservatismM ?? 3, maxPpo2: saved?.maxPpo2 ?? 1.4,
      selectedGasLabel: saved?.selectedGasLabel ?? 'Air / EAN21',
      customGas: saved?.customGas ?? null, analysedGases: saved?.analysedGases ?? [],
      cylinderWaterVolumeL: saved?.cylinderWaterVolumeL ?? null,
      startPressureBar: saved?.startPressureBar ?? null,
      ownRmvLMin: saved?.ownRmvLMin ?? item?.rmvRateLitresMin ?? rmvBaseline.litresPerMinute,
      buddyRmvLMin: saved?.buddyRmvLMin ?? null,
      reserveStrategy: saved?.reserveStrategy ?? 'most-conservative',
      ascentRateMMin: saved?.ascentRateMMin ?? 9,
      ownerMaxDurationMin: saved?.ownerMaxDurationMin ?? item?.plannedBottomTimeMin ?? null,
      routeSegments: saved?.routeSegments ?? [], tableProvider: null,
    };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draftWarningsOpen, setDraftWarningsOpen] = useState(false);
  const [detailsCylinderId, setDetailsCylinderId] = useState<string | null>(null);
  const [saveAsCylinderId, setSaveAsCylinderId] = useState<string | null>(null);
  const [conversionStatus, setConversionStatus] = useState('');
  const [conversionBusy, setConversionBusy] = useState(false);
  const [helpTopic, setHelpTopic] = useState<'PPO₂ / MOD' | 'EAD' | 'Gas volume' | 'Agency table' | 'Bühlmann reference' | 'Depth limits' | null>(null);
  const linkedPlan = divePlans.find(plan => plan.entityId === draft.divePlanId);
  const linkedTrip = linkedPlan?.tripId ? trips.find(trip => trip.entityId === linkedPlan.tripId) : null;
  const linkedSite = linkedPlan?.siteId ? sites.find(site => site.entityId === linkedPlan.siteId) : null;
  const priorDive = linkedPlan ? previousDiveContext(linkedPlan, dives) : null;
  const flight = linkedPlan ? flightProximity(linkedPlan, linkedTrip) : null;
  const recProjection = useMemo(() => {
    try {
      const projectedCylinders = draft.cylinders.map((cylinder) =>
        projectGasCylinder(cylinder, draft, fills, analyses, equipment),
      );
      const analysedGases = draft.cylinders.flatMap((cylinder, index) => {
        const projected = projectedCylinders[index]!;
        return projected.analysisState === 'current' && projected.mix && projected.mix.heliumFraction === 0
          ? [{ label: cylinder.sourceMode === 'rental' ? `Rental · ${cylinder.rentalSnapshot?.label || `cylinder ${index + 1}`} · ${fractionLabel(projected.mix.oxygenFraction, projected.mix.heliumFraction)}` : `Analysed fill ${index + 1}`, oxygenFraction: projected.mix.oxygenFraction, source: 'analysed-fill' as const,
            analysed: true, evidence: projected.mixProvenance }] : [];
      });
      const repetitiveDive = Boolean(linkedPlan && ((linkedPlan.diveNumberOfDay ?? 1) > 1 || dives.some(dive => dive.date === linkedPlan.startDate)));
      const baseInput = { ...recInput, analysedGases, repetitiveDive };
      const rentalIndex = draft.cylinders.findIndex(
        (cylinder) => cylinder.sourceMode === 'rental',
      );
      const effectiveInput = rentalIndex >= 0
        ? rentalCylinderRecreationalInput(
            baseInput,
            draft.cylinders[rentalIndex]!,
            projectedCylinders[rentalIndex]!,
          )
        : baseInput;
      return {
        snapshot: buildRecreationalGasSnapshot(effectiveInput),
        input: effectiveInput,
        error: null,
      };
    } catch (cause) {
      return {
        snapshot: null,
        input: recInput,
        error: cause instanceof Error ? cause.message : 'Recreational planner inputs are invalid.',
      };
    }
  }, [recInput, draft, fills, analyses, equipment, linkedPlan, dives]);
  const draftWarnings = useMemo(
    () => [
      ...new Set([
        ...warnGasPlan(draft, fills, equipment, analyses),
        ...(recProjection.snapshot?.warnings ?? []),
      ]),
    ],
    [draft, fills, equipment, analyses, recProjection.snapshot],
  );

  function update(patch: Partial<GasPlanRecord>) {
    setDraft((current) => ({ ...current, ...patch }));
  }
  function updateCylinder(id: string, patch: Partial<GasPlanCylinder>) {
    update({
      cylinders: draft.cylinders.map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      ),
    });
  }
  function updateRentalSnapshot(
    id: string,
    patch: Partial<RentalCylinderSnapshot>,
  ) {
    update({
      cylinders: draft.cylinders.map((row) =>
        row.id === id && row.rentalSnapshot
          ? { ...row, rentalSnapshot: { ...row.rentalSnapshot, ...patch } }
          : row,
      ),
    });
  }
  function changeCylinderSource(
    id: string,
    sourceMode: 'owned' | 'rental',
  ) {
    update({
      cylinders: draft.cylinders.map((row) =>
        row.id === id ? setGasCylinderSourceMode(row, sourceMode) : row,
      ),
    });
  }
  function updateSegment(id: string, patch: Partial<GasDepthSegment>) {
    update({ depthSegments: (draft.depthSegments ?? []).map(row => row.id === id ? { ...row, ...patch } : row) });
  }
  function addCylinder() {
    update({
      cylinders: [
        ...draft.cylinders,
        {
          id: crypto.randomUUID(),
          sourceMode: 'owned',
          role: 'bottom',
          cylinderEquipmentId: equipment[0]?.entityId ?? null,
          fillId: null,
          analysisId: null,
          startPressureBar: null,
          endPressureBar: null,
          reservePressureBar: 50,
          turnPressureBar: null,
          notes: '',
        },
      ],
    });
  }
  async function confirmSaveAsCylinder() {
    const slot = draft.cylinders.find((row) => row.id === saveAsCylinderId);
    if (!slot?.rentalSnapshot) return;
    setConversionBusy(true);
    setConversionStatus('');
    try {
      const result = await saveRentalCylinderAsOwned(
        slot.rentalSnapshot,
        true,
      );
      updateRentalSnapshot(slot.id, {
        savedCylinderId: result.id,
        savedAsCylinderAt: nowIso(),
      });
      setConversionStatus(
        `Owned cylinder ${result.id} created. This Gas Plan remains a rental snapshot until you explicitly change its source.`,
      );
      setSaveAsCylinderId(null);
    } catch (reason) {
      setConversionStatus(
        reason instanceof Error
          ? reason.message
          : 'The owned cylinder could not be created.',
      );
    } finally {
      setConversionBusy(false);
    }
  }
  function selectDivePlan(divePlanId: string) {
    const selectedPlan = divePlans.find((plan) => plan.entityId === divePlanId);
    update({
      divePlanId: divePlanId || null,
      plannedDepthM:
        selectedPlan?.plannedMaxDepthM ??
        selectedPlan?.maxDepthM ??
        draft.plannedDepthM ??
        null,
      plannedBottomTimeMin:
        selectedPlan?.plannedDurationMin ??
        selectedPlan?.bottomTimeMin ??
        draft.plannedBottomTimeMin ??
        null,
      multiLevel: selectedPlan?.multiLevel ?? draft.multiLevel ?? false,
    });
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (!recProjection.snapshot) throw new Error(recProjection.error ?? 'Complete the recreational planner first.');
      if (draft.status === 'ready') {
        const blockers = recreationalReadinessBlockers(recProjection.snapshot);
        if (blockers.length) throw new Error(`Cannot mark ready: ${blockers.join(' ')}`);
      }
      await saveGasPlan({ ...draft, plannedDepthM: recProjection.input.plannedDepthM, rmvRateLitresMin: recProjection.input.ownRmvLMin,
        gradientFactorLow: recProjection.input.gfLow, gradientFactorHigh: recProjection.input.gfHigh,
        recGasPlan101: recProjection.snapshot, warnings: draftWarnings });
      saved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Gas plan could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }

  const detailsSlot = draft.cylinders.find(
    (cylinder) => cylinder.id === detailsCylinderId,
  );
  const detailsItem = equipment.find(
    (candidate) => candidate.entityId === detailsSlot?.cylinderEquipmentId,
  );
  const detailsProjection = detailsSlot
    ? projectGasCylinder(detailsSlot, draft, fills, analyses, equipment)
    : null;
  const detailsCurrentEvent = detailsProjection?.fillId
    ? fills.find((candidate) => candidate.entityId === detailsProjection.fillId)
    : null;
  const detailsRootFill = detailsProjection?.rootFillId
    ? fills.find((candidate) => candidate.entityId === detailsProjection.rootFillId)
    : null;
  const detailsAnalysis = detailsProjection?.analysisId
    ? analyses.find((candidate) => candidate.entityId === detailsProjection.analysisId)
    : null;
  const detailsSchedule = detailsItem
    ? deriveCylinderInspectionSchedule(detailsItem)
    : null;

  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        label={item ? 'Edit gas plan' : 'New gas plan'}
        close={close}
        className="focus-modal"
      >
        <header>
          <div>
            <span className="focus-eyebrow">GAS PLANNING</span>
            <h2>{item ? 'Edit gas plan' : 'New gas plan'}</h2>
          </div>
          <button
            className="focus-icon"
            onClick={close}
            aria-label="Close editor"
          >
            <X />
          </button>
        </header>

        <RecreationalGasPlanner input={recProjection.input} snapshot={recProjection.snapshot} error={recProjection.error} change={patch => setRecInput(current => ({ ...current, ...patch }))}/>
        {draft.cylinders.some((cylinder) => cylinder.sourceMode === 'rental') ? <p className={styles.provenance}>Rental cylinder volume, current pressure and analysed gas are taken from the saved rental snapshot below and drive the recreational calculation.</p> : null}
        {draftWarnings.length ? <button type="button" className={styles.warningIconButton} aria-label="Open draft Gas Plan warnings" aria-haspopup="dialog" title={draftWarnings.join('\n')} onClick={() => setDraftWarningsOpen(true)}><AlertTriangle size={16} aria-hidden="true" /> {draftWarnings.length} warning(s) · details</button> : null}
        <div className={styles.editorGrid}>
          <label>
            Name
            <input
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
            />
          </label>
          <label>
            Status
            <select
              value={draft.status}
              onChange={(event) =>
                update({
                  status: event.target.value as GasPlanRecord['status'],
                })
              }
            >
              <option value="draft">Draft</option>
              <option value="planned">Planned</option>
              <option value="ready">Ready</option>
              <option value="used">Used</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className={styles.wide}>
            Linked Dive Plan
            <select
              value={draft.divePlanId ?? ''}
              onChange={(event) => selectDivePlan(event.target.value)}
            >
              <option value="">Standalone</option>
              {divePlans.map((plan) => (
                <option key={plan.entityId} value={plan.entityId}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          {linkedPlan ? <div className={`${styles.wide} ${styles.contextChecks}`}>
            <p>Plan: {linkedPlan.startDate} · dive #{linkedPlan.diveNumberOfDay ?? 'unknown'} of day · {linkedPlan.multiLevel ? 'multi-level' : 'single-level / unmarked'} · Site {linkedPlan.siteName || 'Unknown'} max {linkedSite?.maxDepthM ?? 'Unknown'} m · planned max {linkedPlan.plannedMaxDepthM ?? 'Unknown'} m · team limiting depth {linkedPlan.planTeam?.some(row=>row.certifiedDepthM!=null) ? `${Math.min(...linkedPlan.planTeam.flatMap(row=>row.certifiedDepthM!=null?[row.certifiedDepthM]:[]))} m (recorded, verify)` : 'Unknown'}.</p>
            {priorDive && <p>Previous dive: {priorDive.summary} · post-dive pressure group {priorDive.pressureGroup ?? 'Unknown'}{priorDive.dataset ? ` (${priorDive.dataset})` : ''}. {priorDive.warning}</p>}
            {flight && <p role={flight.warning ? 'alert' : undefined} className={flight.warning ? styles.safetyWarning : undefined}>Trip flight: {flight.warning ?? (flight.state==='no-flight-recorded'?'No flight recorded (not clearance).':'Outside the 24-hour flag window; verify independently.')}</p>}
          </div> : null}
          <label>
            Planned depth (m)
            <input
              type="number"
              min="0"
              value={draft.plannedDepthM ?? ''}
              onChange={(event) =>
                update({
                  plannedDepthM:
                    event.target.value === ''
                      ? null
                      : Number(event.target.value),
                })
              }
            />
          </label>
          <label className={styles.inlineCheck}><input type="checkbox" checked={Boolean(draft.multiLevel)} onChange={event=>update({multiLevel:event.target.checked})}/> Multi-level profile</label>
          <label>User maximum depth (m, owner-entered) <button type="button" className={styles.infoButton} aria-label="About user depth limit" title={GAS_HELP['Depth limits']} onClick={()=>setHelpTopic('Depth limits')}>ⓘ</button><input type="number" min="0" step="0.1" value={draft.userMaxDepthM??''} onChange={event=>update({userMaxDepthM:event.target.value?Number(event.target.value):null})}/></label>
          <label>Reserve strategy <button type="button" className={styles.infoButton} title={GAS_HELP.Reserve} aria-label="About reserve gas" onClick={()=>setHelpTopic('Gas volume')}>ⓘ</button><select value={draft.reserveStrategy??'fixed'} onChange={event=>update({reserveStrategy:event.target.value as NonNullable<GasPlanRecord['reserveStrategy']>})}><option value="fixed">Fixed reserve per cylinder</option><option value="thirds">Rule of thirds (strategy note only)</option><option value="custom">Custom team strategy</option></select></label>
          <label>Ascent rate setting (m/min; not calculated)<input type="number" min="0" step="0.1" value={draft.ascentRateMMin??''} onChange={event=>update({ascentRateMMin:event.target.value?Number(event.target.value):null})}/></label>
          <label>
            Bottom time (min)
            <input
              type="number"
              min="0"
              value={draft.plannedBottomTimeMin ?? ''}
              onChange={(event) =>
                update({
                  plannedBottomTimeMin:
                    event.target.value === ''
                      ? null
                      : Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            SAC (bar/min, optional)
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.sacRateBarMin ?? ''}
              onChange={(event) =>
                update({
                  sacRateBarMin:
                    event.target.value === ''
                      ? null
                      : Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            RMV (L/min)
            <input
              type="number"
              min="0"
              step="0.1"
              value={draft.rmvRateLitresMin ?? ''}
              onChange={(event) =>
                update({
                  rmvRateLitresMin:
                    event.target.value === ''
                      ? null
                      : Number(event.target.value),
                  rmvSource: event.target.value === '' ? null : 'manual',
                  rmvSourceDiveIds: [],
                })
              }
            />
            <small>
              {draft.rmvSource === 'logbook-average'
                ? `Logbook baseline from ${rmvBaseline.observationCount} valid observation(s). Editing makes this a manual override.`
                : draft.rmvSource === 'manual'
                  ? 'Manual override.'
                  : 'No valid Logbook RMV baseline is available.'}
            </small>
          </label>
          <label className={styles.wide}>
            Planning notes
            <textarea
              value={draft.notes}
              onChange={(event) => update({ notes: event.target.value })}
              placeholder="Reserve, turn-pressure, team and contingency notes"
            />
          </label>
          <p className={styles.wide}>The recreational NDL above is calculated by the explicitly selected Bühlmann model. Tables are lookup backup only. No manual NDL drives this plan. Legacy table transcriptions remain in older records but are not used here.</p>
        </div>

        <div className={styles.editorSectionHeading}>
          <h3>Cylinders</h3>
          <button className="focus-secondary" onClick={addCylinder}>
            <Plus size={14} /> Add cylinder
          </button>
        </div>
        <div className={styles.editorCylinderList}>
          {draft.cylinders.map((cylinder, index) => (
            <fieldset key={cylinder.id}>
              <legend>Cylinder {index + 1}</legend>
              <label>
                Role
                <select
                  value={cylinder.role}
                  onChange={(event) =>
                    updateCylinder(cylinder.id, {
                      role: event.target.value as GasPlanCylinder['role'],
                    })
                  }
                >
                  <option value="primary">Primary</option>
                  <option value="backup">Backup</option>
                  <option value="stage">Stage</option>
                  <option value="bottom">Bottom</option>
                  <option value="travel">Travel</option>
                  <option value="deco">Deco</option>
                  <option value="bailout">Bailout</option>
                  <option value="suit">Suit</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Cylinder source
                <select
                  value={cylinder.sourceMode ?? 'owned'}
                  onChange={(event) =>
                    changeCylinderSource(
                      cylinder.id,
                      event.target.value as 'owned' | 'rental',
                    )
                  }
                >
                  <option value="owned">Use owned cylinder</option>
                  <option value="rental">Use rental / temporary cylinder</option>
                </select>
              </label>
              {(cylinder.sourceMode ?? 'owned') === 'owned' ? <>
              <label>
                Cylinder
                <select
                  value={cylinder.cylinderEquipmentId ?? ''}
                  onChange={(event) =>
                    updateCylinder(cylinder.id, {
                      cylinderEquipmentId: event.target.value || null,
                      fillId: null,
                      analysisId: null,
                    })
                  }
                >
                  <option value="">Choose</option>
                  {equipment.map((item) => (
                    <option key={item.entityId} value={item.entityId}>
                      {cylinderPickerSummary(
                        item,
                        fills.filter(
                          (fill) => fill.cylinderEquipmentId === item.entityId,
                        ),
                        analyses.filter(
                          (analysis) =>
                            analysis.cylinderEquipmentId === item.entityId,
                        ),
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Required valve / connection
                <select
                  value={cylinder.requiredValveType ?? ''}
                  onChange={(event) =>
                    updateCylinder(cylinder.id, {
                      requiredValveType:
                        (event.target.value as 'DIN' | 'A-CLAMP') || null,
                    })
                  }
                >
                  <option value="">No connection requirement recorded</option>
                  <option value="DIN">DIN</option>
                  <option value="A-CLAMP">A-clamp</option>
                </select>
              </label>
              <label>
                Fill
                <select
                  value={cylinder.fillId ?? ''}
                  onChange={(event) =>
                    updateCylinder(cylinder.id, {
                      fillId: event.target.value || null,
                      analysisId: null,
                    })
                  }
                >
                  <option value="">Latest current fill / none</option>
                  {fills
                    .filter(
                      (fill) =>
                        !cylinder.cylinderEquipmentId ||
                        fill.cylinderEquipmentId ===
                          cylinder.cylinderEquipmentId,
                    )
                    .map((fill) => (
                      <option key={fill.entityId} value={fill.entityId}>
                        {fill.filledAt.slice(0, 10)} · {fill.pressureBar ?? '—'}{' '}
                        bar ·{' '}
                        {fractionLabel(
                          fill.oxygenFraction,
                          fill.heliumFraction,
                        )}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Analysis
                <select
                  value={cylinder.analysisId ?? ''}
                  onChange={(event) =>
                    updateCylinder(cylinder.id, {
                      analysisId: event.target.value || null,
                    })
                  }
                >
                  <option value="">Matching/latest / none</option>
                  {analyses
                    .filter(
                      (analysis) =>
                        analysisFor(
                          { ...cylinder, analysisId: analysis.entityId },
                          analyses,
                          fillFor(cylinder, fills),
                          fills,
                        )?.entityId === analysis.entityId,
                    )
                    .map((analysis) => (
                      <option key={analysis.entityId} value={analysis.entityId}>
                        {fractionLabel(
                          analysis.oxygenFraction,
                          analysis.heliumFraction,
                        )}{' '}
                        · {analysis.analysedAt.slice(0, 10)}
                      </option>
                    ))}
                </select>
              </label>
              {cylinder.analysisId && !analysisFor(cylinder, analyses, fillFor(cylinder, fills), fills) && <p role="alert" className={styles.safetyWarning}>Saved analysis is stale or not linked to the selected current fill. Select a new matching analysis; the old ID remains in the draft until you change it.</p>}
              <label>Gas type<select value={cylinder.gasType??''} onChange={event=>updateCylinder(cylinder.id,{gasType:event.target.value as NonNullable<GasPlanCylinder['gasType']>})}><option value="">Not classified</option><option value="air">Air</option><option value="nitrox">Nitrox</option><option value="trimix">Trimix</option><option value="heliox">Heliox</option><option value="other">Other</option></select></label>
              <label>Mix evidence<select value={cylinder.mixSource??'analysis'} onChange={event=>updateCylinder(cylinder.id,{mixSource:event.target.value as NonNullable<GasPlanCylinder['mixSource']>})}><option value="analysis">Linked current analysis</option><option value="manual">Manual entry (unverified)</option></select></label>
              {cylinder.mixSource==='manual'&&<><label>Manual O₂ fraction (0–1)<input type="number" min="0" max="1" step="0.01" value={cylinder.manualOxygenFraction??''} onChange={event=>updateCylinder(cylinder.id,{manualOxygenFraction:event.target.value?Number(event.target.value):null})}/></label><label>Manual He fraction (0–1)<input type="number" min="0" max="1" step="0.01" value={cylinder.manualHeliumFraction??''} onChange={event=>updateCylinder(cylinder.id,{manualHeliumFraction:event.target.value?Number(event.target.value):null})}/></label></>}
              </> : null}
              <label>Target PPO₂ (bar) <button type="button" className={styles.infoButton} title={GAS_HELP['PPO₂ / MOD']} aria-label="About PPO2 and MOD" onClick={()=>setHelpTopic('PPO₂ / MOD')}>ⓘ</button><input type="number" min="0" max="2" step="0.05" value={cylinder.targetPpo2??1.4} onChange={event=>updateCylinder(cylinder.id,{targetPpo2:event.target.value?Number(event.target.value):null})}/></label>
              <label>Depth conservatism (m)<input type="number" min="0" step="0.5" value={cylinder.conservatismM??0} onChange={event=>updateCylinder(cylinder.id,{conservatismM:event.target.value?Number(event.target.value):null})}/></label>
              <label>Segment / switch depth (m)<input type="number" min="0" step="0.5" value={cylinder.depthM??''} onChange={event=>updateCylinder(cylinder.id,{depthM:event.target.value?Number(event.target.value):null})}/></label>
              {(cylinder.sourceMode ?? 'owned') === 'owned' ? <>
              <label>Water volume override (L, optional)<input type="number" min="0" step="0.1" value={cylinder.waterVolumeOverrideL??''} onChange={event=>updateCylinder(cylinder.id,{waterVolumeOverrideL:event.target.value?Number(event.target.value):null})}/></label>
              <label>
                Start bar
                <input
                  type="number"
                  min="0"
                  value={cylinder.startPressureBar ?? ''}
                  onChange={(event) =>
                    updateCylinder(cylinder.id, {
                      startPressureBar:
                        event.target.value === ''
                          ? null
                          : Number(event.target.value),
                      startPressureSource:
                        event.target.value === '' ? null : 'owner-override',
                    })
                  }
                />
              </label>
              <p className={styles.provenance}>
                <strong>Start-pressure source:</strong>{' '}
                {
                  projectGasCylinder(
                    cylinder,
                    draft,
                    fills,
                    analyses,
                    equipment,
                  ).startPressureEvidence.label
                }
                {cylinder.startPressureBar != null ? (
                  <button
                    type="button"
                    className="focus-secondary"
                    onClick={() =>
                      updateCylinder(cylinder.id, {
                        startPressureBar: null,
                        startPressureSource: null,
                      })
                    }
                  >
                    Use current pressure
                  </button>
                ) : null}
              </p>
              </> : cylinder.rentalSnapshot ? <>
                <label>
                  Rental cylinder label
                  <input
                    value={cylinder.rentalSnapshot.label}
                    placeholder="Boat AL80, Rental 12 L…"
                    onChange={(event) => updateRentalSnapshot(cylinder.id, { label: event.target.value })}
                  />
                </label>
                <label>
                  Cylinder material / type
                  <select
                    value={cylinder.rentalSnapshot.cylinderType}
                    onChange={(event) => updateRentalSnapshot(cylinder.id, { cylinderType: event.target.value as RentalCylinderSnapshot['cylinderType'] })}
                  >
                    <option value="aluminium">Aluminium</option>
                    <option value="steel">Steel</option>
                    <option value="unknown">Unknown</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>Water volume (L)<input type="number" min="0" step="0.1" value={cylinder.rentalSnapshot.waterVolumeL ?? ''} onChange={(event) => updateRentalSnapshot(cylinder.id, { waterVolumeL: event.target.value ? Number(event.target.value) : null })}/></label>
                <label>Working pressure (bar)<input type="number" min="0" value={cylinder.rentalSnapshot.workingPressureBar ?? ''} onChange={(event) => updateRentalSnapshot(cylinder.id, { workingPressureBar: event.target.value ? Number(event.target.value) : null })}/></label>
                <label>Start pressure (bar)<input type="number" min="0" value={cylinder.rentalSnapshot.startPressureBar ?? ''} onChange={(event) => updateRentalSnapshot(cylinder.id, { startPressureBar: event.target.value ? Number(event.target.value) : null })}/></label>
                <label>Remaining pressure (bar, if known)<input type="number" min="0" value={cylinder.rentalSnapshot.remainingPressureBar ?? ''} onChange={(event) => updateRentalSnapshot(cylinder.id, { remainingPressureBar: event.target.value ? Number(event.target.value) : null })}/></label>
                <label>
                  Valve type
                  <select value={cylinder.rentalSnapshot.valveType} onChange={(event) => updateRentalSnapshot(cylinder.id, { valveType: event.target.value as RentalCylinderSnapshot['valveType'] })}>
                    <option value="DIN">DIN</option>
                    <option value="A-CLAMP">A-clamp</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <label>
                  Gas
                  <select
                    value={cylinder.rentalSnapshot.gasType}
                    onChange={(event) => {
                      const gasType = event.target.value as RentalCylinderSnapshot['gasType'];
                      updateRentalSnapshot(cylinder.id, {
                        gasType,
                        ...(gasType === 'air' ? { oxygenFraction: 0.21, heliumFraction: 0 } : {}),
                      });
                    }}
                  >
                    <option value="air">Air</option>
                    <option value="nitrox">Nitrox</option>
                    <option value="custom">Custom FO₂</option>
                  </select>
                </label>
                <label>Analysed O₂ (%)<input type="number" min="0" max="100" step="0.1" value={cylinder.rentalSnapshot.oxygenFraction == null ? '' : cylinder.rentalSnapshot.oxygenFraction * 100} onChange={(event) => updateRentalSnapshot(cylinder.id, { oxygenFraction: event.target.value ? Number(event.target.value) / 100 : null })}/></label>
                <label>Analysed He (%)<input type="number" min="0" max="100" step="0.1" value={(cylinder.rentalSnapshot.heliumFraction ?? 0) * 100} onChange={(event) => updateRentalSnapshot(cylinder.id, { heliumFraction: event.target.value ? Number(event.target.value) / 100 : 0 })}/></label>
                <label>
                  Analysis state
                  <select value={cylinder.rentalSnapshot.analysisStatus} onChange={(event) => updateRentalSnapshot(cylinder.id, { analysisStatus: event.target.value as RentalCylinderSnapshot['analysisStatus'] })}>
                    <option value="current">Current for this rental fill</option>
                    <option value="stale">Stale</option>
                    <option value="missing">Not analysed / unknown</option>
                  </select>
                </label>
                <label>
                  Analyser / evidence source
                  <select value={cylinder.rentalSnapshot.analysisSource} onChange={(event) => updateRentalSnapshot(cylinder.id, { analysisSource: event.target.value as RentalCylinderSnapshot['analysisSource'] })}>
                    <option value="analysed-by-me">Analysed by me</option>
                    <option value="analysed-by-operator">Analysed by operator</option>
                    <option value="label-only">Label only</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <label>Analysis date/time<input type="datetime-local" value={cylinder.rentalSnapshot.analysedAt?.slice(0, 16) ?? ''} onChange={(event) => updateRentalSnapshot(cylinder.id, { analysedAt: event.target.value ? new Date(event.target.value).toISOString() : null })}/></label>
                <label>
                  Fill / operator source
                  <select value={cylinder.rentalSnapshot.fillSource} onChange={(event) => updateRentalSnapshot(cylinder.id, { fillSource: event.target.value as RentalCylinderSnapshot['fillSource'] })}>
                    <option value="dive-centre">Dive centre</option>
                    <option value="day-boat">Day boat</option>
                    <option value="liveaboard">Liveaboard</option>
                    <option value="resort">Resort</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <label className={styles.wide}>Rental cylinder notes<input value={cylinder.rentalSnapshot.notes} onChange={(event) => updateRentalSnapshot(cylinder.id, { notes: event.target.value })}/></label>
                <p className={styles.wide}>Rental cylinder — service history not recorded in ZeusTek. Verify with operator.</p>
                <button type="button" className="focus-secondary" onClick={() => setSaveAsCylinderId(cylinder.id)} disabled={Boolean(cylinder.rentalSnapshot.savedCylinderId)}>
                  {cylinder.rentalSnapshot.savedCylinderId ? `Saved as cylinder ${cylinder.rentalSnapshot.savedCylinderId}` : 'Save as cylinder'}
                </button>
              </> : null}
              <label>
                End bar
                <input
                  type="number"
                  min="0"
                  value={cylinder.endPressureBar ?? ''}
                  onChange={(event) =>
                    updateCylinder(cylinder.id, {
                      endPressureBar:
                        event.target.value === ''
                          ? null
                          : Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Reserve bar
                <input
                  type="number"
                  min="0"
                  value={cylinder.reservePressureBar ?? ''}
                  onChange={(event) =>
                    updateCylinder(cylinder.id, {
                      reservePressureBar:
                        event.target.value === ''
                          ? null
                          : Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Turn pressure bar
                <input
                  type="number"
                  min="0"
                  value={cylinder.turnPressureBar ?? ''}
                  onChange={(event) =>
                    updateCylinder(cylinder.id, {
                      turnPressureBar:
                        event.target.value === ''
                          ? null
                          : Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className={styles.wide}>
                Cylinder notes
                <input
                  value={cylinder.notes ?? ''}
                  onChange={(event) =>
                    updateCylinder(cylinder.id, { notes: event.target.value })
                  }
                />
              </label>
              <button
                type="button"
                className="focus-secondary"
                onClick={() => setDetailsCylinderId(cylinder.id)}
              >
                {cylinder.sourceMode === 'rental'
                  ? 'Rental snapshot details'
                  : 'Cylinder details & provenance'}
              </button>
              <button
                className="focus-secondary danger"
                onClick={() =>
                  update({
                    cylinders: draft.cylinders.filter(
                      (row) => row.id !== cylinder.id,
                    ),
                  })
                }
              >
                <Trash2 size={14} /> Remove cylinder
              </button>
            </fieldset>
          ))}
          {!draft.cylinders.length ? (
            <p className={styles.emptyCopy}>
              No cylinders selected. You can save a draft; a warning will remain
              visible.
            </p>
          ) : null}
        </div>
        {conversionStatus ? <output className={styles.wide}>{conversionStatus}</output> : null}

        <div className={styles.editorSectionHeading}><h3>Depth/time segments</h3><button className="focus-secondary" onClick={()=>update({depthSegments:[...(draft.depthSegments??[]),{id:crypto.randomUUID(),depthM:null,minutes:null,gasCylinderId:null,note:''}]})}><Plus size={14}/> Add segment</button></div>
        <p className={styles.provenance}>Each segment uses its recorded depth, minutes and selected gas. These rows do not calculate decompression obligations or a no-stop limit. <button type="button" className={styles.infoButton} aria-label="About gas volume" onClick={()=>setHelpTopic('Gas volume')}>ⓘ</button></p>
        <div className={styles.editorCylinderList}>{(draft.depthSegments??[]).map((segment,index)=><fieldset key={segment.id}><legend>Segment {index+1}</legend><label>Depth (m)<input type="number" min="0" step="0.5" value={segment.depthM??''} onChange={event=>updateSegment(segment.id,{depthM:event.target.value?Number(event.target.value):null})}/></label><label>Time (min)<input type="number" min="0" value={segment.minutes??''} onChange={event=>updateSegment(segment.id,{minutes:event.target.value?Number(event.target.value):null})}/></label><label>Gas / cylinder<select value={segment.gasCylinderId??''} onChange={event=>updateSegment(segment.id,{gasCylinderId:event.target.value||null})}><option value="">Unassigned (all-gas estimate)</option>{draft.cylinders.map((row,i)=><option key={row.id} value={row.id}>{row.role} · cylinder {i+1}</option>)}</select></label><label>Segment note<input value={segment.note??''} onChange={event=>updateSegment(segment.id,{note:event.target.value})}/></label><button className="focus-secondary danger" onClick={()=>update({depthSegments:(draft.depthSegments??[]).filter(row=>row.id!==segment.id)})}>Remove segment</button></fieldset>)}</div>

        <p className={styles.provenance}>T12.6R calculates no-stop limits only. It does not create or edit decompression schedules. Legacy manual-stop notes remain stored on older Gas Plans.</p>

        <p className={styles.safetyWarning}>{GAS_PLANNING_CAUTION}</p>

        {error ? (
          <p role="alert" className="focus-notice danger">
            {error}
          </p>
        ) : null}
        <footer>
          <button className="focus-secondary" onClick={close}>
            Cancel
          </button>
          <button
            className="focus-primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : 'Save gas plan'}
          </button>
        </footer>
      </AccessibleDialog>
      {draftWarningsOpen ? <AccessibleDialog label="Draft Gas Plan warnings" close={() => setDraftWarningsOpen(false)} className="focus-modal"><header><h2>Draft Gas Plan warnings</h2><button type="button" className="focus-icon" data-dialog-close aria-label="Close draft warnings" onClick={() => setDraftWarningsOpen(false)}><X /></button></header><ul className={styles.warningList}>{draftWarnings.map(warning => <li key={warning}><AlertTriangle size={16} aria-hidden="true" /> {warning}</li>)}</ul><footer><button type="button" className="focus-secondary" data-dialog-close onClick={() => setDraftWarningsOpen(false)}>Close</button></footer></AccessibleDialog> : null}
      {saveAsCylinderId ? <AccessibleDialog label="Confirm Save as cylinder" close={() => setSaveAsCylinderId(null)} className="focus-modal"><header><div><span className="focus-eyebrow">EXPLICIT CONVERSION</span><h2>Save rental snapshot as an owned cylinder?</h2></div><button type="button" className="focus-icon" data-dialog-close aria-label="Cancel Save as cylinder" onClick={() => setSaveAsCylinderId(null)}><X /></button></header><p>This creates one canonical record in Cylinders &amp; Gas. The Gas Plan remains a rental/temporary snapshot and retains its original operator and analysis evidence.</p><p>No owned cylinder, fill or analysis record is created until you confirm.</p><footer><button type="button" className="focus-secondary" data-dialog-close onClick={() => setSaveAsCylinderId(null)}>Cancel</button><button type="button" className="focus-primary" disabled={conversionBusy} onClick={() => void confirmSaveAsCylinder()}>{conversionBusy ? 'Saving…' : 'Confirm Save as cylinder'}</button></footer></AccessibleDialog> : null}
      {detailsSlot?.sourceMode === 'rental' && detailsSlot.rentalSnapshot && detailsProjection ? (
        <AccessibleDialog
          label={`${detailsSlot.rentalSnapshot.label || 'Rental cylinder'} snapshot details`}
          close={() => setDetailsCylinderId(null)}
          className="focus-modal"
        >
          <header>
            <div>
              <span className="focus-eyebrow">RENTAL / TEMPORARY CYLINDER</span>
              <h2>{detailsSlot.rentalSnapshot.label || 'Unlabelled rental cylinder'}</h2>
              <p>Saved inside this Gas Plan. No canonical cylinder ID is required.</p>
            </div>
            <button type="button" className="focus-icon" data-dialog-close aria-label="Close rental cylinder details" onClick={() => setDetailsCylinderId(null)}><X /></button>
          </header>
          <dl className={styles.evidenceGrid}>
            <div><dt>Material / type</dt><dd>{detailsSlot.rentalSnapshot.cylinderType}</dd></div>
            <div><dt>Water volume</dt><dd>{detailsSlot.rentalSnapshot.waterVolumeL == null ? 'Not recorded' : `${detailsSlot.rentalSnapshot.waterVolumeL} L`}</dd></div>
            <div><dt>Working / current pressure</dt><dd>{detailsSlot.rentalSnapshot.workingPressureBar ?? '—'} / {detailsProjection.startPressureEvidence.pressureBar ?? '—'} bar</dd></div>
            <div><dt>Valve</dt><dd>{detailsSlot.rentalSnapshot.valveType}</dd></div>
            <div><dt>Gas</dt><dd>{detailsProjection.mix ? fractionLabel(detailsProjection.mix.oxygenFraction, detailsProjection.mix.heliumFraction) : 'Unknown'}</dd></div>
            <div><dt>Analysis</dt><dd>{detailsSlot.rentalSnapshot.analysisStatus} · {detailsSlot.rentalSnapshot.analysisSource} · {detailsSlot.rentalSnapshot.analysedAt ?? 'date not recorded'}</dd></div>
            <div><dt>Fill/operator source</dt><dd>{detailsSlot.rentalSnapshot.fillSource}</dd></div>
            <div><dt>Owned copy</dt><dd>{detailsSlot.rentalSnapshot.savedCylinderId ?? 'Not created'}</dd></div>
          </dl>
          <p>Rental cylinder — service history not recorded in ZeusTek. Verify with operator.</p>
          {detailsProjection.warnings.length ? <><h3>Readiness warnings</h3><ul className={styles.warningList}>{detailsProjection.warnings.map((warning) => <li key={warning}><AlertTriangle size={16} aria-hidden="true" /> {warning}</li>)}</ul></> : null}
          <footer><button type="button" className="focus-secondary" data-dialog-close onClick={() => setDetailsCylinderId(null)}>Close</button></footer>
        </AccessibleDialog>
      ) : null}
      {detailsSlot && detailsItem && detailsProjection ? (
        <AccessibleDialog
          label={`${detailsItem.name} cylinder details and provenance`}
          close={() => setDetailsCylinderId(null)}
          className="focus-modal"
        >
          <header>
            <div>
              <span className="focus-eyebrow">CYLINDER READINESS</span>
              <h2>{detailsItem.name}</h2>
              <p>
                Cyl {detailsItem.cylinderNumber || detailsItem.entityId} · S/N{' '}
                {detailsItem.serialNumber || 'not recorded'}
              </p>
            </div>
            <button
              type="button"
              className="focus-icon"
              data-dialog-close
              aria-label="Close cylinder details"
              onClick={() => setDetailsCylinderId(null)}
            >
              <X />
            </button>
          </header>
          <dl className={styles.evidenceGrid}>
            <div><dt>Cylinder ID</dt><dd>{detailsItem.cylinderNumber || detailsItem.entityId}</dd></div>
            <div><dt>Manufacturer / serial</dt><dd>{detailsItem.manufacturer || 'Not recorded'} · {detailsItem.serialNumber || 'Not recorded'}</dd></div>
            <div><dt>Water volume</dt><dd>{detailsItem.waterVolumeLiters == null ? 'Not recorded' : `${detailsItem.waterVolumeLiters} L`}</dd></div>
            <div><dt>Valve</dt><dd>{detailsItem.valveType || 'Unknown'}{detailsSlot.requiredValveType ? ` · required ${detailsSlot.requiredValveType}` : ''}</dd></div>
            <div><dt>Hydro</dt><dd>{detailsItem.hydroTestAt || detailsSchedule?.latestHydro || 'Not recorded'} · due {detailsItem.hydroDueAt || detailsSchedule?.hydroDueAt || 'unknown'}</dd></div>
            <div><dt>Visual</dt><dd>{detailsItem.visualTestAt || detailsSchedule?.latestVisualQualifyingTest || 'Not recorded'} · due {detailsItem.visualDueAt || detailsSchedule?.visualDueAt || 'unknown'}</dd></div>
            <div><dt>O₂ clean</dt><dd>{detailsItem.oxygenClean ? `Current until ${detailsItem.oxygenCleanUntil || 'unknown'}` : 'Not recorded/current'}</dd></div>
            <div><dt>Current pressure event</dt><dd>{detailsCurrentEvent ? `${detailsCurrentEvent.entityId} · ${detailsCurrentEvent.pressureBar ?? '—'} bar · ${detailsCurrentEvent.eventType || 'fill'}` : 'None'}</dd></div>
            <div><dt>Root fill</dt><dd>{detailsRootFill ? `${detailsRootFill.entityId} · ${detailsRootFill.filledAt} · ${detailsRootFill.location || detailsRootFill.provider || 'location not recorded'} · ${detailsRootFill.source}` : 'None'}</dd></div>
            <div><dt>Analysis</dt><dd>{detailsAnalysis ? `${detailsAnalysis.entityId} · ${gasMixLabel(detailsAnalysis.oxygenFraction, detailsAnalysis.heliumFraction)} · ${detailsAnalysis.analysedAt} · analyser ${detailsAnalysis.analysedByPersonId || 'not recorded'} · ${detailsAnalysis.source || 'recorded'}` : 'No valid current analysis'}</dd></div>
            <div><dt>Start pressure source</dt><dd>{detailsProjection.startPressureEvidence.label} · {detailsProjection.startPressureEvidence.pressureBar ?? '—'} bar</dd></div>
            <div><dt>Analysis state</dt><dd>{detailsProjection.analysisState === 'current' ? 'Analysis current for this fill' : detailsProjection.analysisState}</dd></div>
          </dl>
          <h3>Fill and pressure lineage</h3>
          {detailsProjection.provenanceChain.length ? (
            <ol className={styles.provenanceChain}>
              {detailsProjection.provenanceChain.map((entry) => <li key={entry}>{entry}</li>)}
            </ol>
          ) : <p>No fill provenance recorded.</p>}
          {detailsProjection.warnings.length ? (
            <><h3>Readiness warnings</h3><ul className={styles.warningList}>{detailsProjection.warnings.map((warning) => <li key={warning}><AlertTriangle size={16} aria-hidden="true" /> {warning}</li>)}</ul></>
          ) : <p>Recorded cylinder evidence has no current readiness warnings.</p>}
          <footer><button type="button" className="focus-secondary" data-dialog-close onClick={() => setDetailsCylinderId(null)}>Close</button></footer>
        </AccessibleDialog>
      ) : null}
      {helpTopic ? <AccessibleDialog label={`${helpTopic} help`} close={()=>setHelpTopic(null)} className="focus-modal"><header><h2>{helpTopic}</h2><button className="focus-icon" aria-label="Close help" data-dialog-close onClick={()=>setHelpTopic(null)}><X/></button></header><p>{helpTopic==='PPO₂ / MOD'?'PPO₂ is oxygen fraction × absolute pressure. MOD is the depth where the selected target PPO₂ is reached. The target is a planning input, not a guarantee of safety.':helpTopic==='EAD'?'Equivalent Air Depth compares nitrogen exposure using FN₂/0.79. It is not a decompression schedule.':helpTopic==='Gas volume'?GAS_FORMULA_PROVENANCE:helpTopic==='Depth limits'?'Site, owner-entered user and team limits are separate. The lowest known limit applies, and unknown capability is not a pass. Verify training evidence independently.':helpTopic==='Bühlmann reference'?'ZeusTek calculates a recreational no-stop limit at the selected depth using the chosen ZH-L16B or ZH-L16C model and gradient factors. The model, assumptions and result are saved with the Gas Plan. This is a planning aid, not a validated dive computer or a decompression schedule.':'Record the exact table family and edition with your own transcribed values. Never interchange pressure groups across PADI air, PADI EANx32, SSI or Navy tables. No table dataset is bundled; a table is lookup backup only and does not drive the calculated NDL.'}</p><p>{GAS_PLANNING_CAUTION}</p><footer><button className="focus-secondary" data-dialog-close onClick={()=>setHelpTopic(null)}>Close</button></footer></AccessibleDialog> : null}
    </div>
  );
}
