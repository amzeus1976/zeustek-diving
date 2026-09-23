'use client';
import { useState } from 'react';
import { reviewAllocationEvidence } from '../../lib/gas-allocation/evidence-review';
import { RecordEditorWorkspace } from '../shared/record-editor-workspace';
import { AccessibleDialog } from '../accessible-dialog';
import { RecreationalGasPlanner } from './recreational-gas-planner';
import { GasAllocationPanel, AllocationResults } from './gas-allocation-panel';
import {
  buildRecreationalGasSnapshot,
  recreationalReadinessBlockers,
  type RecreationalGasInput,
} from '../../lib/offline/recreational-gas-planner';
import {
  saveGasPlan,
  saveRentalCylinderAsOwned,
  projectGasCylinder,
  ownedCylinderRecreationalInput,
  rentalCylinderRecreationalInput,
  type GasPlanRecord,
  type StoredGasPlanRecord,
  type RmvBaseline,
} from '../../lib/offline/planning-pages';
import type { Stored, DiveSiteRecord } from '../../lib/offline/dive-planning';
import type { StoredEnrichedDivePlan } from '../../lib/offline/dive-planning-centre';
import type {
  CylinderEquipmentRecord,
  CylinderFillRecord,
  GasAnalysisRecord,
} from '../../lib/offline/loadouts-gas';
import type { DiveRecord } from '../../lib/offline/dives';
import type { DiveExpeditionTripRecord } from '../../lib/offline/trips-expeditions';
import {
  flightProximity,
  previousDiveContext,
} from '../../lib/offline/plan-context-checks';
import {
  emptyAllocation,
  allocationEngineInput,
  allocationReadiness,
  gasPlanWithAllocation,
  accessibleSupplies,
  type AllocatedGasPlan,
  type AllocationMetadata,
} from '../../lib/gas-allocation/integration';
import {
  initialRecreationalInput,
  upgradeAllocation,
} from '../../lib/gas-allocation/editor-input';
import styles from './gas-allocation-panel.module.css';

type Props = {
  item: StoredGasPlanRecord | null;
  newGasPlanFor: string | null;
  divePlans: StoredEnrichedDivePlan[];
  equipment: Stored<CylinderEquipmentRecord>[];
  fills: Stored<CylinderFillRecord>[];
  analyses: Stored<GasAnalysisRecord>[];
  dives: Array<DiveRecord & { entityId: string }>;
  trips: Stored<DiveExpeditionTripRecord>[];
  sites: Stored<DiveSiteRecord>[];
  rmvBaseline: RmvBaseline;
  close: () => void;
  saved: () => void | Promise<void>;
};
function newDraft(
  linked: StoredEnrichedDivePlan | undefined,
  baseline: RmvBaseline,
): AllocatedGasPlan {
  const stamp = new Date().toISOString();
  return {
    name: linked ? `${linked.name} gas plan` : '',
    divePlanId: linked?.entityId ?? null,
    status: 'draft',
    plannedDepthM: linked?.plannedMaxDepthM ?? linked?.maxDepthM ?? null,
    plannedBottomTimeMin:
      linked?.plannedDurationMin ?? linked?.bottomTimeMin ?? null,
    multiLevel: linked?.multiLevel ?? false,
    cylinders: [],
    depthSegments: [],
    manualStops: [],
    rmvRateLitresMin: baseline.litresPerMinute,
    rmvSource: baseline.litresPerMinute == null ? null : 'logbook-average',
    rmvSourceDiveIds: baseline.diveIds,
    warnings: [],
    notes: '',
    createdAt: stamp,
    modifiedAt: stamp,
  };
}
export function T14GasPlanEditor({
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
}: Props) {
  const [draft, setDraft] = useState<AllocatedGasPlan>(() =>
    item
      ? structuredClone(item)
      : newDraft(
          divePlans.find((row) => row.entityId === newGasPlanFor),
          rmvBaseline,
        ),
  );
  const [input, setInput] = useState(() =>
    initialRecreationalInput(draft, rmvBaseline),
  );
  const [allocation, setAllocation] = useState<AllocationMetadata | null>(() =>
    (item as AllocatedGasPlan | null)?.allocationV1
      ? structuredClone((item as AllocatedGasPlan).allocationV1!)
      : item
        ? null
        : emptyAllocation(),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [convertId, setConvertId] = useState<string | null>(null),
    [conversionMessage, setConversionMessage] = useState('');
  const linked = divePlans.find((row) => row.entityId === draft.divePlanId),
    site = sites.find((row) => row.entityId === linked?.siteId),
    trip = trips.find((row) => row.entityId === linked?.tripId);
  const previous = linked ? previousDiveContext(linked, dives) : null,
    flight = linked ? flightProximity(linked, trip) : null;
  const projection = (() => {
    let effective: RecreationalGasInput = {
      ...input,
      repetitiveDive: Boolean(
        input.repetitiveDive ||
        (linked &&
          ((linked.diveNumberOfDay ?? 1) > 1 ||
            dives.some((row) => row.date === linked.startDate))),
      ),
    };
    if (allocation) effective = allocationEngineInput(effective, allocation);
    else {
      const row =
        draft.cylinders.find((value) => value.role === 'primary') ??
        draft.cylinders.find((value) => value.role === 'bottom') ??
        draft.cylinders[0];
      if (row) {
        const projected = projectGasCylinder(
          row,
          draft,
          fills,
          analyses,
          equipment,
        );
        effective =
          row.sourceMode === 'rental'
            ? rentalCylinderRecreationalInput(effective, row, projected)
            : ownedCylinderRecreationalInput(
                effective,
                row,
                projected,
                equipment.find(
                  (value) => value.entityId === row.cylinderEquipmentId,
                ),
              );
      }
    }
    try {
      return {
        input: effective,
        snapshot: buildRecreationalGasSnapshot(effective),
        error: null,
      };
    } catch (reason) {
      return {
        input: effective,
        snapshot: null,
        error:
          reason instanceof Error
            ? reason.message
            : 'Complete the planner inputs.',
      };
    }
  })();
  const reviewed = allocation
    ? reviewAllocationEvidence(
        allocation,
        draft,
        equipment,
        fills,
        analyses,
        linked?.startDate ?? new Date().toISOString(),
      )
    : null;
  const result = reviewed
    ? allocationReadiness(projection.input, projection.snapshot, reviewed)
    : null;
  const limits = [
    draft.userMaxDepthM,
    site?.maxDepthM,
    ...(linked?.planTeam ?? []).map((row) => row.certifiedDepthM),
  ].filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value > 0,
  );
  const depthConflict =
    limits.length > 0 && projection.input.plannedDepthM > Math.min(...limits)
      ? `Planned depth exceeds the lowest recorded owner/Site/team limit (${Math.min(...limits)} m).`
      : null;
  function patchInput(patch: Partial<RecreationalGasInput>) {
    setInput((current) => ({ ...current, ...patch }));
    setDraft((current) => ({
      ...current,
      ...('ownRmvLMin' in patch
        ? {
            rmvRateLitresMin: patch.ownRmvLMin,
            rmvSource: 'manual' as const,
            rmvSourceDiveIds: [],
          }
        : {}),
      ...('plannedDepthM' in patch
        ? { plannedDepthM: patch.plannedDepthM }
        : {}),
      ...('plannedWorkingTimeMin' in patch
        ? { plannedBottomTimeMin: patch.plannedWorkingTimeMin }
        : {}),
    }));
  }
  async function save() {
    if (!projection.snapshot)
      throw new Error(projection.error ?? 'Complete the recreational inputs.');
    if (depthConflict && draft.status === 'ready')
      throw new Error(depthConflict);
    setBusy(true);
    setError('');
    try {
      if (reviewed) {
        await saveGasPlan(
          gasPlanWithAllocation(
            draft,
            projection.input,
            projection.snapshot,
            reviewed,
          ),
        );
      } else {
        const blockers = recreationalReadinessBlockers(projection.snapshot);
        if (draft.status === 'ready' && blockers.length)
          throw new Error(blockers.join(' '));
        await saveGasPlan({
          ...draft,
          plannedDepthM: projection.input.plannedDepthM,
          plannedBottomTimeMin: projection.input.plannedWorkingTimeMin,
          rmvRateLitresMin: projection.input.ownRmvLMin,
          recGasPlan101: projection.snapshot,
        });
      }
      await saved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to save. Your draft is retained.',
      );
    } finally {
      setBusy(false);
    }
  }
  function upgrade() {
    setAllocation(upgradeAllocation(draft, fills, analyses, equipment));
    if (!input.routeSegments.length && draft.depthSegments?.length)
      patchInput({
        mode: 'multilevel',
        routeSegments: draft.depthSegments.map((row) => ({
          id: row.id,
          label: row.note || 'Retained legacy interval',
          depthM: row.depthM,
          minutes: row.minutes,
          startDepthM: row.depthM,
          endDepthM: row.depthM,
          cylinderId: row.gasCylinderId ?? null,
          stressFactor: 1,
        })),
      });
  }
  async function convert() {
    if (!allocation || !projection.snapshot || !convertId) return;
    setBusy(true);
    setConversionMessage('');
    try {
      const projected = gasPlanWithAllocation(
          { ...draft, status: 'draft' },
          projection.input,
          projection.snapshot,
          allocation,
        ),
        row = projected.cylinders.find((value) => value.id === convertId);
      if (!row?.rentalSnapshot)
        throw new Error(
          'Only a hire/manual snapshot can be copied into owned inventory.',
        );
      const result = await saveRentalCylinderAsOwned(row.rentalSnapshot, true);
      setAllocation((current) =>
        current
          ? {
              ...current,
              cylinders: current.cylinders.map((value) =>
                value.id === convertId
                  ? { ...value, ownedCopyId: result.id }
                  : value,
              ),
            }
          : current,
      );
      setConversionMessage(
        'Owned cylinder created explicitly. This Plan retains its original temporary snapshot.',
      );
      setConvertId(null);
    } catch (reason) {
      setConversionMessage(
        reason instanceof Error
          ? reason.message
          : 'Unable to create the owned cylinder.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <RecordEditorWorkspace
        label={item ? 'Edit gas plan' : 'New gas plan'}
        close={close}
        value={{ draft, input, allocation }}
        busy={busy}
        save={save}
        saveDisabled={!draft.name.trim()}
        saveLabel="Save gas plan"
      >
        <section className={styles.panel}>
          <div className={styles.fields}>
            <label>
              Name
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>
            <label>
              Status
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    status: event.target.value as GasPlanRecord['status'],
                  })
                }
              >
                {['draft', 'planned', 'ready', 'used', 'archived'].map(
                  (status) => (
                    <option key={status} value={status}>
                      {status[0]?.toUpperCase()}
                      {status.slice(1)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Linked Dive Plan
              <select
                value={draft.divePlanId ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, divePlanId: event.target.value || null })
                }
              >
                <option value="">Standalone</option>
                {divePlans.map((plan) => (
                  <option key={plan.entityId} value={plan.entityId}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Owner depth limit (m, optional)
              <input
                type="number"
                min="1"
                value={draft.userMaxDepthM ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    userMaxDepthM: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </label>
          </div>
          {linked && (
            <p>
              Linked Plan: {linked.name} · {linked.startDate} · Site{' '}
              {site?.name ?? linked.siteName} · Site maximum{' '}
              {site?.maxDepthM ?? 'unknown'} m. Recorded team limits are
              evidence to verify.
            </p>
          )}
          {depthConflict && <p role="alert">{depthConflict}</p>}
          {previous && (
            <p>
              Previous Dive: {previous.summary}. {previous.warning}
            </p>
          )}
          {flight && (
            <p>
              Flight context:{' '}
              {flight.warning ?? 'No proximity flag; verify independently.'}
            </p>
          )}
          {!allocation && (
            <div className={styles.notice}>
              <p>
                This saved Plan retains its original strategy, source evidence
                and legacy fields. Opening it does not migrate or save anything.
                Review an explicit upgrade to use T14 supply allocations.
              </p>
              <button type="button" onClick={upgrade}>
                Review T14 supply allocation
              </button>
            </div>
          )}
        </section>
        <RecreationalGasPlanner
          input={projection.input}
          snapshot={projection.snapshot}
          error={projection.error}
          change={patchInput}
          allocationMode={Boolean(allocation)}
          supplyChoices={
            allocation
              ? accessibleSupplies(allocation).map((row) => ({
                  id: row.id,
                  label: row.label,
                }))
              : draft.cylinders.map((row) => ({ id: row.id, label: row.role }))
          }
          supplyContent={
            allocation ? (
              <GasAllocationPanel
                value={allocation}
                change={setAllocation}
                draft={draft}
                input={projection.input}
                snapshot={projection.snapshot}
                equipment={equipment}
                fills={fills}
                analyses={analyses}
              />
            ) : undefined
          }
        />
        {result && <AllocationResults result={result} />}
        <section className={styles.panel}>
          <label>
            Planning notes
            <textarea
              value={draft.notes}
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
            />
          </label>
          <details>
            <summary>
              Additional record fields and retained legacy evidence
            </summary>
            <label>
              SAC (bar/min, optional)
              <input
                type="number"
                min="0"
                step=".01"
                value={draft.sacRateBarMin ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    sacRateBarMin: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </label>
            <p>
              SAC is recorded separately from the RMV used by this engine.
              Existing manual-stop notes and table transcriptions remain stored;
              they do not generate or validate a decompression schedule.
            </p>
            {draft.cylinders.map((row) => (
              <details key={row.id}>
                <summary>{row.role} · retained cylinder record</summary>
                <p>
                  Canonical {row.cylinderEquipmentId ?? 'temporary'} · fill{' '}
                  {row.fillId ?? 'none'} · analysis {row.analysisId ?? 'none'}
                </p>
                <p>
                  Recorded end pressure {row.endPressureBar ?? 'unknown'} bar;
                  turn pressure {row.turnPressureBar ?? 'unknown'} bar; legacy
                  reserve {row.reservePressureBar ?? 'unknown'} bar. T14
                  assigned litres are shown separately above.
                </p>
                <p>{row.notes}</p>
                {!allocation && (
                  <div className={styles.fields}>
                    {(
                      [
                        'endPressureBar',
                        'turnPressureBar',
                        'reservePressureBar',
                      ] as const
                    ).map((field) => (
                      <label key={field}>
                        {field === 'endPressureBar'
                          ? 'Recorded end pressure'
                          : field === 'turnPressureBar'
                            ? 'Recorded turn pressure'
                            : 'Legacy reserve pressure'}{' '}
                        (bar)
                        <input
                          type="number"
                          min="0"
                          value={row[field] ?? ''}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              cylinders: current.cylinders.map((value) =>
                                value.id === row.id
                                  ? {
                                      ...value,
                                      [field]:
                                        event.target.value === ''
                                          ? null
                                          : Number(event.target.value),
                                    }
                                  : value,
                              ),
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
              </details>
            ))}
            {draft.manualStops?.length ? (
              <p>
                {draft.manualStops.length} legacy manually recorded stop notes
                retained unchanged.
              </p>
            ) : null}
            {draft.tableReference && (
              <p>
                Existing agency-table transcription retained unchanged:{' '}
                {draft.tableReference.agency} · {draft.tableReference.edition} ·
                pressure group{' '}
                {draft.tableReference.pressureGroup || 'not recorded'} ·
                owner-transcribed NDL{' '}
                {draft.tableReference.ndlMinutes ?? 'not recorded'} min.{' '}
                {draft.tableReference.sourceNote}
              </p>
            )}
          </details>
          {allocation?.cylinders
            .filter((row) => row.mode === 'hire' || row.mode === 'temporary')
            .map((row) => (
              <button
                key={row.id}
                type="button"
                disabled={Boolean(row.ownedCopyId) || busy}
                onClick={() => setConvertId(row.id)}
              >
                {row.ownedCopyId
                  ? 'Owned copy already saved'
                  : `Save ${row.label || 'temporary snapshot'} as owned cylinder`}
              </button>
            ))}
          {conversionMessage && <output>{conversionMessage}</output>}
          <p>
            This is not decompression software. Recreational no-stop planning
            only. The frozen physiological model and the supply allocation are
            separate assessments. No gas switching credit or
            staged-decompression schedule is generated.
          </p>
        </section>
        {error && <p role="alert">{error}</p>}
      </RecordEditorWorkspace>
      {convertId && (
        <AccessibleDialog
          label="Confirm Save as cylinder"
          className="focus-modal"
          containDismiss
          close={() => {
            if (!busy) setConvertId(null);
          }}
        >
          <h2>Save rental snapshot as an owned cylinder?</h2>
          <p>
            This explicit action creates one owned cylinder. It creates no fill
            or analysis, and does not change the Plan’s snapshot into owned
            evidence.
          </p>
          <footer>
            <button disabled={busy} onClick={() => setConvertId(null)}>
              Cancel
            </button>
            <button disabled={busy} onClick={() => void convert()}>
              Confirm Save as cylinder
            </button>
          </footer>
        </AccessibleDialog>
      )}
    </>
  );
}
