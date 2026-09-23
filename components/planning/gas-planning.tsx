'use client';
import {saveAllocationNotesToDivePlan} from '../../lib/gas-allocation/plan-readiness';
import {reviewAllocationEvidence} from '../../lib/gas-allocation/evidence-review';
import {T14GasPlanEditor} from './t14-gas-plan-editor';
import {readPlanningSources} from '../../lib/planning/read-planning-sources';
import {AllocationResults} from './gas-allocation-panel';
import {allocationReadiness,type AllocatedGasPlan} from '../../lib/gas-allocation/integration';


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
  type CylinderEquipmentRecord,
  type CylinderFillRecord,
  type GasAnalysisRecord,
} from '../../lib/offline/loadouts-gas';
import {
  deleteGasPlan,
  fractionLabel,

  projectGasCylinder,
  saveGasPlanNotesToDivePlan,
  warnGasPlan,
  type GasPlanCylinder,
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
} from '../../lib/offline/gas-planning-foundation';
import styles from './planning-pages.module.css';

type Props = { go?: (route: string) => void };

const GAS_HELP = {
  'Depth limits': 'Site, owner-entered user and team depth limits are separate. The lowest known limit applies, and unknown capability is not a pass. Verify training evidence independently.',
  'Gas aggregation': 'Overall gas needed is Unknown when multiple cylinders have no explicit segment assignments; show per-cylinder values instead.',
  'Gas needed': 'This gas estimate uses recorded RMV, depth and minutes. Missing inputs remain Unknown; ascent, stops and contingencies require separate planning.',
  'PPO₂ / MOD': 'PPO₂ is oxygen fraction multiplied by absolute pressure. MOD is the depth where the selected target PPO₂ is reached.',
  Reserve: 'Usable gas deducts the recorded reserve pressure. Missing size or pressure evidence remains Unknown.',
} as const;

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
      readPlanningSources(),
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
    if (openedDeepLink.current) return;
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
  const metadata=(selected as AllocatedGasPlan|null)?.allocationV1;
  const allocationResult=selected&&metadata&&selected.recGasPlan101?allocationReadiness(selected.recGasPlan101,selected.recGasPlan101,reviewAllocationEvidence(metadata,selected,equipment,fills,analyses,selectedDivePlan?.startDate??new Date().toISOString())):null;
  const warnings = selected ? warnGasPlan(selected, fills, equipment, analyses) : [];
  const projections = selected ? selected.cylinders.map(cylinder => projectGasCylinder(cylinder, selected, fills, analyses, equipment)) : [];
  const availableValues = projections.map(projection => projection.volume?.usableLitres ?? null);
  const gasAvailable = availableValues.length && availableValues.every((value): value is number => value !== null) ? availableValues.reduce((sum, value) => sum + value, 0) : null;
  const gasNeeded = projections.length === 1 ? projections[0]?.requiredLitres ?? null : null;
  const multiCylinderReason = selected && selected.cylinders.length > 1
    ? 'Overall gas needed is Unknown for multiple cylinders without explicit depth/time segment assignments. Per-cylinder requirements are shown below; cylinders are not interchangeable.'
    : null;
  const detailedWarnings = [...new Set([
    ...(allocationResult?[...allocationResult.allocation.reasons,...allocationResult.physiologicalReasons,...allocationResult.allocation.cylinders.flatMap(row=>row.reasons)]:warnings),
    ...(!allocationResult?selected?.recGasPlan101?.warnings??[]:[]),
    ...(!allocationResult?projections.flatMap(projection => projection.warnings):[]),
    ...(previousDive?.warning ? [previousDive.warning] : []),
    ...(flight?.warning ? [flight.warning] : []),
    ...(selected?.manualStops?.length ? ['Gas-needed estimates exclude manually recorded stops, ascent and contingency gas; verify the full profile independently.'] : []),
  ])];

  if (editing !== undefined) return <T14GasPlanEditor
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
        />;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroTitle}>
          <ZeusTekIcon id="gas-mix" size="hero" />
          <div>
            <span className="focus-eyebrow">PLANNING</span>
            <h1>Gas Planning</h1>
            <p>
              Plan recreational no-stop gas, NDL, reserves and route
              checkpoints from current cylinder evidence. This does not
              generate decompression schedules.
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
            <li>Compare NDL and gas time as separate limits</li>
            <li>Review emergency and route/checkpoint reserves</li>
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
            onClick={() => go?.('Cylinders & Gas')}
          >
            Open Cylinders &amp; Gas
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
                {allocationResult?<AllocationResults result={allocationResult}/>:null}
                <div className={styles.summaryGrid}>
                  {selected.recGasPlan101 ? <>
                    <span><small>{(selected as AllocatedGasPlan).allocationV1?'Frozen single-supply reference':'Readiness'}</small><b>{selected.recGasPlan101.readiness}</b></span>
                    <span><small>Selected gas NDL</small><b>{selected.recGasPlan101.gasCandidates.find(row => row.selected)?.ndl.minutes ?? '—'} min</b></span>
                    <span><small>Gas-limited time</small><b>{selected.recGasPlan101.gasCandidates.find(row => row.selected)?.gasLimitedTimeMin?.toFixed(1) ?? '—'} min</b></span>
                    <span><small>Emergency reserve</small><b>{selected.recGasPlan101.reserve.selectedLitres?.toFixed(0) ?? '—'} L</b></span>
                    <span><small>Limiting factor</small><b>{selected.recGasPlan101.limitingFactor}</b></span>
                    <span><small>Planned working time</small><b>{selected.recGasPlan101.plannedWorkingTimeMin ?? '—'} min</b></span>
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
                    <small title={GAS_HELP['Gas needed']}>{allocationResult?'Sum of individual normal obligations (informational)':'Segment gas needed'}</small>
                    <b>{allocationResult?allocationResult.allocation.cylinders.reduce((total,row)=>total+row.requiredLitres,0).toFixed(1):gasNeeded??'—'} L</b>
                  </span>
                  <span>
                    <small>Gas available (informational total)</small>
                    <b>{allocationResult?allocationResult.allocation.informationalTotalLitres.toFixed(1):gasAvailable??'—'} L</b>
                  </span>
                </div>
                {!allocationResult&&<>
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
                </>}
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
                  if(allocationResult)await saveAllocationNotesToDivePlan(selectedDivePlan,selected,allocationResult);else await saveGasPlanNotesToDivePlan(selectedDivePlan, selected);
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
          <Save size={14} /> Send summary to Dive Planning Centre
        </button>
        <button className="focus-secondary danger" onClick={remove}>
          <Trash2 size={14} /> Delete gas plan
        </button>
      </div>
      {status ? <output>{status}</output> : null}
    </section>
  );
}
