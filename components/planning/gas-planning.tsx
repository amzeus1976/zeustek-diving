'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { listEquipment, type Stored } from '../../lib/offline/dive-planning';
import type { StoredEnrichedDivePlan } from '../../lib/offline/dive-planning-centre';
import type {
  CylinderEquipmentRecord,
  CylinderFillRecord,
  GasAnalysisRecord,
} from '../../lib/offline/loadouts-gas';
import {
  deleteGasPlan,
  fractionLabel,
  gasAvailableLitres,
  gasNeededLitres,
  planningPageSources,
  saveGasPlan,
  saveGasPlanNotesToDivePlan,
  warnGasPlan,
  type GasPlanCylinder,
  type GasPlanRecord,
  type RmvBaseline,
  type StoredGasPlanRecord,
} from '../../lib/offline/planning-pages';
import styles from './planning-pages.module.css';

type Props = { go?: (route: string) => void };
type GasPlanDraft = GasPlanRecord & { entityId?: string };

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
) {
  if (cylinder.analysisId)
    return analyses.find((item) => item.entityId === cylinder.analysisId);
  return [...analyses]
    .filter(
      (item) =>
        (cylinder.fillId && item.fillId === cylinder.fillId) ||
        (!cylinder.fillId &&
          item.cylinderEquipmentId === cylinder.cylinderEquipmentId),
    )
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
  const [rmvBaseline, setRmvBaseline] = useState<RmvBaseline>({
    litresPerMinute: null,
    observationCount: 0,
    diveIds: [],
  });
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState<
    StoredGasPlanRecord | null | undefined
  >(undefined);
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    const [sources, allEquipment] = await Promise.all([
      planningPageSources(),
      listEquipment(),
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
    setEquipment(
      allEquipment.filter((item) =>
        /cylinder|tank/i.test(`${item.category} ${item.name}`),
      ) as Array<Stored<CylinderEquipmentRecord>>,
    );
  }, []);
  useRecordRefresh(refresh);

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
  const warnings = selected ? warnGasPlan(selected, fills, equipment) : [];
  const gasNeeded = selected
    ? gasNeededLitres(
        selected.plannedDepthM,
        selected.plannedBottomTimeMin,
        selected.rmvRateLitresMin,
      )
    : null;
  const gasAvailable = selected
    ? selected.cylinders.reduce((total, cylinder) => {
        const fill = fillFor(cylinder, fills);
        const equipmentItem = equipment.find(
          (item) => item.entityId === cylinder.cylinderEquipmentId,
        );
        return (
          total +
          (gasAvailableLitres(
            equipmentItem?.waterVolumeLiters,
            cylinder.startPressureBar ?? fill?.pressureBar,
            cylinder.reservePressureBar,
          ) ?? 0)
        );
      }, 0)
    : 0;

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
            <li>Select canonical cylinders, fills and gas analyses</li>
            <li>Use a Logbook RMV baseline or enter a manual override</li>
            <li>Compare basic gas needed with available usable gas</li>
            <li>Keep reserve, turn, end-pressure and team notes together</li>
          </ul>
          <h3>Evidence source</h3>
          <p>
            Cylinders, fills and analyses come from Loadouts &amp; Cylinder Gas.
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
                status={selectedDivePlan?.name ?? 'Standalone'}
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
                        const analysis = analysisFor(cylinder, analyses);
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
                                {equipmentItem?.name ?? `Cylinder ${index + 1}`}
                              </b>
                              <small>
                                {cylinder.role} ·{' '}
                                {fractionLabel(
                                  analysis?.oxygenFraction ??
                                    fill?.oxygenFraction,
                                  analysis?.heliumFraction ??
                                    fill?.heliumFraction,
                                )}
                              </small>
                            </span>
                            <em>
                              {cylinder.startPressureBar ??
                                fill?.pressureBar ??
                                '—'}{' '}
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
                status={
                  warnings.length
                    ? `${warnings.length} warning(s)`
                    : 'Ready to review'
                }
              >
                <div className={styles.summaryGrid}>
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
                    <small>Gas needed</small>
                    <b>{gasNeeded ?? '—'} L</b>
                  </span>
                  <span>
                    <small>Gas available</small>
                    <b>{gasAvailable || '—'} L</b>
                  </span>
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
                {warnings.length ? (
                  <ul className={styles.warningList}>
                    {warnings.map((warning) => (
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
          divePlans={divePlans}
          equipment={equipment}
          fills={fills}
          analyses={analyses}
          rmvBaseline={rmvBaseline}
          close={() => setEditing(undefined)}
          saved={async () => {
            setEditing(undefined);
            await refresh();
          }}
        />
      ) : null}
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
  divePlans,
  equipment,
  fills,
  analyses,
  rmvBaseline,
  close,
  saved,
}: {
  item: StoredGasPlanRecord | null;
  divePlans: StoredEnrichedDivePlan[];
  equipment: Array<Stored<CylinderEquipmentRecord>>;
  fills: Array<Stored<CylinderFillRecord>>;
  analyses: Array<Stored<GasAnalysisRecord>>;
  rmvBaseline: RmvBaseline;
  close: () => void;
  saved: () => void;
}) {
  const [draft, setDraft] = useState<GasPlanDraft>(() =>
    item
      ? { ...item, cylinders: item.cylinders.map((row) => ({ ...row })) }
      : emptyPlan(divePlans[0], rmvBaseline),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
  function addCylinder() {
    update({
      cylinders: [
        ...draft.cylinders,
        {
          id: crypto.randomUUID(),
          role: 'primary',
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
    });
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const warnings = warnGasPlan(draft, fills, equipment);
      await saveGasPlan({ ...draft, warnings });
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
                  <option value="deco">Deco</option>
                  <option value="suit">Suit</option>
                  <option value="other">Other</option>
                </select>
              </label>
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
                      {item.name}
                    </option>
                  ))}
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
                        !cylinder.cylinderEquipmentId ||
                        analysis.cylinderEquipmentId ===
                          cylinder.cylinderEquipmentId,
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
                    })
                  }
                />
              </label>
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
    </div>
  );
}
