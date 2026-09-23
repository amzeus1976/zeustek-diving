'use client';
import { GasInputHelp as Help } from './gas-input-help';
import { useState } from 'react';
import type { Stored } from '../../lib/offline/dive-planning';
import type {
  CylinderEquipmentRecord,
  CylinderFillRecord,
  GasAnalysisRecord,
} from '../../lib/offline/loadouts-gas';
import type { GasPlanRecord } from '../../lib/offline/planning-pages';
import type {
  RecreationalGasInput,
  RecreationalGasSnapshot,
} from '../../lib/offline/recreational-gas-planner';
import {
  accessibleSupplies,
  allocationContext,
  allocationSegments,
  type AllocationMetadata,
  type allocationReadiness,
} from '../../lib/gas-allocation/integration';
import type {
  AllocationCylinder,
  AllocationScenario,
  ReserveAssignment,
  SupplyMode,
  SupplyRole,
} from '../../lib/gas-allocation/model';
import {
  captureOwnedCylinder,
  newAllocationCylinder,
} from '../../lib/gas-allocation/editor-input';
import styles from './gas-allocation-panel.module.css';

const numeric = (value: string) => (value === '' ? null : Number(value));
const modes: Record<SupplyMode, string> = {
  'own-empty': 'Own empty / fill required',
  'own-full': 'Own full',
  hire: 'Hire',
  temporary: 'Temporary / manual',
};
const roles: Record<SupplyRole, string> = {
  main: 'Main / backgas',
  'sidemount-left': 'Sidemount left',
  'sidemount-right': 'Sidemount right',
  pony: 'Pony / bailout',
  stage: 'Stage',
};
type Props = {
  value: AllocationMetadata;
  change: (value: AllocationMetadata) => void;
  draft: GasPlanRecord;
  input: RecreationalGasInput;
  snapshot: RecreationalGasSnapshot | null;
  equipment: Stored<CylinderEquipmentRecord>[];
  fills: Stored<CylinderFillRecord>[];
  analyses: Stored<GasAnalysisRecord>[];
};
export function GasAllocationPanel({
  value,
  change,
  draft,
  input,
  snapshot,
  equipment,
  fills,
  analyses,
}: Props) {
  const [newMode, setNewMode] = useState<SupplyMode>('own-empty');
  const segments = allocationSegments(input, value),
    points = [
      { id: 'start', label: 'Start' },
      ...segments.map((row) => ({ id: row.id, label: row.label || row.id })),
    ],
    choices = accessibleSupplies(value).map((row) => ({
      id: row.id,
      label: row.label,
    }));
  const selectedGas = snapshot?.gasCandidates.find((row) => row.selected);
  const patch = (next: Partial<AllocationMetadata>) =>
    change({ ...value, ...next });
  const update = (id: string, next: Partial<AllocationCylinder>) =>
    patch({
      cylinders: value.cylinders.map((row) =>
        row.id === id
          ? {
              ...row,
              ...next,
              snapshotId: crypto.randomUUID(),
              capturedAt: new Date().toISOString(),
            }
          : row,
      ),
    });
  const scenario = (id: string, next: Partial<AllocationScenario>) =>
    patch({
      scenarios: value.scenarios.map((row) =>
        row.id === id ? { ...row, ...next } : row,
      ),
    });
  function suggestReserves() {
    const context = allocationContext(input, snapshot, value);
    const available = accessibleSupplies(value);
    const rows = available.map((supply) => ({
      id: crypto.randomUUID(),
      supplyId: supply.id,
      litres:
        context.reserveFloors.find((row) => row.supplyId === supply.id)
          ?.litres ?? 0,
      from: supply.members[0]?.availableFrom ?? 'start',
      through: points.at(-1)?.id ?? 'start',
    }));
    const reference = rows.find(
      (row) => row.supplyId === value.referenceSupplyId,
    );
    if (reference)
      reference.litres += Math.max(
        0,
        (context.reserveMinimumL ?? 0) -
          rows
            .filter((row) => row.from === 'start')
            .reduce((total, row) => total + row.litres, 0),
      );
    patch({ reserves: rows });
  }
  return (
    <section className={styles.panel} aria-label="Gas supply allocation">
      <header>
        <span className="focus-eyebrow">SUPPLY THE PLAN</span>
        <h3>Cylinders, access and reserve assignments</h3>
        <p>
          Matching gas does not make independent cylinders interchangeable.
          Planned fills and hire requests remain separate from current evidence.
        </p>
      </header>
      <div className={styles.field}>
        <label>
          Supply workflow
          <select
            value={value.mode}
            onChange={(event) =>
              patch({ mode: event.target.value as AllocationMetadata['mode'] })
            }
          >
            <option value="requirements-only">Requirements only</option>
            <option value="supplied">Choose and allocate supplies</option>
          </select>
        </label>
        <Help label="Supply workflow" />
      </div>
      {value.mode === 'requirements-only' ? (
        <p>
          Define depth, time, gas and reserve requirements first. Save a draft
          without creating a cylinder, fill or analysis. Choose supplies when
          ready to allocate the requirement.
        </p>
      ) : (
        <>
          <div className={styles.actions}>
            <div className={styles.field}>
              <label>
                New supply type
                <select
                  value={newMode}
                  onChange={(event) =>
                    setNewMode(event.target.value as SupplyMode)
                  }
                >
                  {Object.entries(modes).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Help label="New supply type" />
            </div>
            <button
              type="button"
              onClick={() => {
                const row = newAllocationCylinder(
                  newMode,
                  selectedGas?.oxygenFraction ?? null,
                );
                patch({
                  cylinders: [...value.cylinders, row],
                  ...(value.cylinders.length
                    ? {}
                    : { referenceSupplyId: row.id }),
                });
              }}
            >
              Add cylinder
            </button>
          </div>
          <div className={styles.cards}>
            {value.cylinders.map((row) => {
              const owned = row.mode === 'own-full' || row.mode === 'own-empty',
                full = row.mode === 'own-full';
              return (
                <fieldset key={row.id}>
                  <legend>
                    {row.label || 'Cylinder'} · {roles[row.role]}
                  </legend>
                  <div className={styles.fields}>
                    <div className={styles.field}>
                      <label>
                        Supply type
                        <select
                          value={row.mode}
                          onChange={(event) => {
                            const mode = event.target.value as SupplyMode;
                            update(row.id, {
                              mode,
                              canonicalId: null,
                              currentPressureBar: null,
                              fillId: null,
                              analysisId: null,
                              analysisConfirmed: false,
                              conditionConfirmed: false,
                            });
                          }}
                        >
                          {Object.entries(modes).map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Help label="Supply type" />
                    </div>
                    <div className={styles.field}>
                      <label>
                        Role
                        <select
                          value={row.role}
                          onChange={(event) =>
                            update(row.id, {
                              role: event.target.value as SupplyRole,
                            })
                          }
                        >
                          {Object.entries(roles).map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Help label="Role" />
                    </div>
                    {owned ? (
                      <>
                        <div className={styles.wide}>
                          <label className={styles.wide}>
                            Canonical cylinder
                            <select
                              value={row.canonicalId ?? ''}
                              onChange={(event) => {
                                const found = equipment.find(
                                  (item) =>
                                    item.entityId === event.target.value,
                                );
                                if (found)
                                  patch({
                                    cylinders: value.cylinders.map((item) =>
                                      item.id === row.id
                                        ? captureOwnedCylinder(
                                            row,
                                            found,
                                            draft,
                                            fills,
                                            analyses,
                                          )
                                        : item,
                                    ),
                                  });
                              }}
                            >
                              <option value="">Select an owned cylinder</option>
                              {equipment.map((item) => (
                                <option
                                  key={item.entityId}
                                  value={item.entityId}
                                >
                                  {item.cylinderNumber || 'ID not assigned'} ·{' '}
                                  {item.name} · {item.waterVolumeLiters ?? '?'}{' '}
                                  L / {item.workingPressureBar ?? '?'} bar
                                </option>
                              ))}
                            </select>
                          </label>
                          <Help label="Canonical cylinder" />
                        </div>
                        <button
                          type="button"
                          disabled={!row.canonicalId}
                          onClick={() => {
                            const found = equipment.find(
                              (item) => item.entityId === row.canonicalId,
                            );
                            if (found)
                              patch({
                                cylinders: value.cylinders.map((item) =>
                                  item.id === row.id
                                    ? captureOwnedCylinder(
                                        row,
                                        found,
                                        draft,
                                        fills,
                                        analyses,
                                      )
                                    : item,
                                ),
                              });
                          }}
                        >
                          Refresh source snapshot
                        </button>
                      </>
                    ) : (
                      <div className={styles.field}>
                        <label>
                          Label
                          <input
                            value={row.label}
                            onChange={(event) =>
                              update(row.id, { label: event.target.value })
                            }
                          />
                        </label>
                        <Help label="Label" />
                      </div>
                    )}
                    {row.mode === 'hire' && (
                      <div className={styles.field}>
                        <label>
                          Suggested request
                          <select
                            value=""
                            onChange={(event) => {
                              const [volume, pressure] = event.target.value
                                .split('/')
                                .map(Number);
                              if (volume && pressure)
                                update(row.id, {
                                  waterVolumeL: volume,
                                  plannedStartPressureBar: pressure,
                                  ratedPressureBar: pressure,
                                });
                            }}
                          >
                            <option value="">
                              Choose a request or enter values
                            </option>
                            {[12, 15].flatMap((volume) =>
                              [200, 230, 300].map((pressure) => (
                                <option
                                  key={`${volume}/${pressure}`}
                                  value={`${volume}/${pressure}`}
                                >
                                  {volume} L / {pressure} bar
                                </option>
                              )),
                            )}
                          </select>
                          <small>
                            Requests do not imply an operator stocks this
                            configuration.
                          </small>
                        </label>
                        <Help label="Suggested request" />
                      </div>
                    )}
                    <div className={styles.field}>
                      <label>
                        Water volume (L)
                        <input
                          type="number"
                          min="1"
                          step="0.1"
                          disabled={owned}
                          value={row.waterVolumeL ?? ''}
                          onChange={(event) =>
                            update(row.id, {
                              waterVolumeL: numeric(event.target.value),
                            })
                          }
                        />
                      </label>
                      <Help label="Water volume (L)" />
                    </div>
                    <div className={styles.field}>
                      <label>
                        Rated pressure (bar)
                        <input
                          type="number"
                          min="1"
                          disabled={owned}
                          value={row.ratedPressureBar ?? ''}
                          onChange={(event) =>
                            update(row.id, {
                              ratedPressureBar: numeric(event.target.value),
                            })
                          }
                        />
                      </label>
                      <Help label="Rated pressure (bar)" />
                    </div>
                    <div className={styles.field}>
                      <label>
                        Current pressure (bar)
                        <input
                          type="number"
                          min="0"
                          disabled={owned}
                          value={row.currentPressureBar ?? ''}
                          onChange={(event) =>
                            update(row.id, {
                              currentPressureBar: numeric(event.target.value),
                            })
                          }
                        />
                      </label>
                      <Help label="Current pressure (bar)" />
                    </div>
                    <div className={styles.field}>
                      <label>
                        Requested / planned start pressure (bar)
                        <input
                          type="number"
                          min="1"
                          value={row.plannedStartPressureBar ?? ''}
                          onChange={(event) =>
                            update(row.id, {
                              plannedStartPressureBar: numeric(
                                event.target.value,
                              ),
                            })
                          }
                        />
                      </label>
                      <Help label="Requested / planned start pressure (bar)" />
                    </div>
                    {full && (
                      <div className={styles.field}>
                        <label>
                          Allowed start-pressure tolerance (bar)
                          <input
                            type="number"
                            min="0"
                            value={row.pressureToleranceBar ?? 5}
                            onChange={(event) =>
                              update(row.id, {
                                pressureToleranceBar: Number(
                                  event.target.value,
                                ),
                              })
                            }
                          />
                          <small>
                            Eligibility is requested pressure minus this
                            tolerance. Accounting uses the lower of current and
                            planned pressure.
                          </small>
                        </label>
                        <Help label="Allowed start-pressure tolerance (bar)" />
                      </div>
                    )}
                    <div className={styles.field}>
                      <label>
                        Oxygen (%)
                        <input
                          type="number"
                          min="16"
                          max="99"
                          step=".1"
                          disabled={full}
                          value={
                            row.gas.oxygen == null ? '' : row.gas.oxygen * 100
                          }
                          onChange={(event) =>
                            update(row.id, {
                              gas: {
                                ...row.gas,
                                oxygen:
                                  event.target.value === ''
                                    ? null
                                    : Number(event.target.value) / 100,
                              },
                            })
                          }
                        />
                      </label>
                      <Help label="Oxygen (%)" />
                    </div>
                    <div className={styles.field}>
                      <label>
                        Helium (%)
                        <input
                          type="number"
                          min="0"
                          max="84"
                          step=".1"
                          disabled={full}
                          value={
                            row.gas.helium == null ? '' : row.gas.helium * 100
                          }
                          onChange={(event) =>
                            update(row.id, {
                              gas: {
                                ...row.gas,
                                helium:
                                  event.target.value === ''
                                    ? null
                                    : Number(event.target.value) / 100,
                              },
                            })
                          }
                        />
                        <small>
                          Helium physiology is unsupported by this recreational
                          no-stop workflow.
                        </small>
                      </label>
                      <Help label="Helium (%)" />
                    </div>
                    <div className={styles.field}>
                      <label>
                        Custom reserve pressure floor (bar)
                        <input
                          type="number"
                          min="0"
                          value={row.reserveFloorBar ?? ''}
                          onChange={(event) =>
                            update(row.id, {
                              reserveFloorBar: numeric(event.target.value),
                            })
                          }
                        />
                      </label>
                      <Help label="Custom reserve pressure floor">
                        An additional owner-selected minimum. It cannot reduce
                        the frozen reserve or thirds requirement. Assign
                        sufficient reserve litres explicitly; connected manifold
                        members share the highest pressure floor.
                      </Help>
                    </div>
                    <div className={styles.field}>
                      <label>
                        Recorded end pressure (bar)
                        <input
                          type="number"
                          min="0"
                          value={row.endPressureBar ?? ''}
                          onChange={(event) =>
                            update(row.id, {
                              endPressureBar: numeric(event.target.value),
                            })
                          }
                        />
                      </label>
                      <Help label="Recorded end pressure">
                        Retained observation for this Plan. It does not replace
                        current fill pressure or predict gas use.
                      </Help>
                    </div>
                    <div className={styles.field}>
                      <label>
                        Recorded turn pressure (bar)
                        <input
                          type="number"
                          min="0"
                          value={row.turnPressureBar ?? ''}
                          onChange={(event) =>
                            update(row.id, {
                              turnPressureBar: numeric(event.target.value),
                            })
                          }
                        />
                      </label>
                      <Help label="Recorded turn pressure">
                        An owner-recorded value. Required checkpoint pressures
                        and reserve obligations are assessed separately.
                      </Help>
                    </div>
                    <div className={styles.field}>
                      <label>
                        Valve
                        <input
                          disabled={owned}
                          value={row.valve ?? ''}
                          onChange={(event) =>
                            update(row.id, { valve: event.target.value })
                          }
                        />
                      </label>
                      <Help label="Valve" />
                    </div>
                    {!owned && (
                      <>
                        <div className={styles.field}>
                          <label>
                            Material / type
                            <select
                              value={row.cylinderType ?? 'unknown'}
                              onChange={(event) =>
                                update(row.id, {
                                  cylinderType: event.target
                                    .value as NonNullable<
                                    AllocationCylinder['cylinderType']
                                  >,
                                })
                              }
                            >
                              {['unknown', 'aluminium', 'steel', 'other'].map(
                                (option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <Help label="Material / type" />
                        </div>
                        <div className={styles.field}>
                          <label>
                            Analysis source
                            <select
                              value={row.analysisSource ?? 'unknown'}
                              onChange={(event) =>
                                update(row.id, {
                                  analysisSource: event.target
                                    .value as NonNullable<
                                    AllocationCylinder['analysisSource']
                                  >,
                                })
                              }
                            >
                              {[
                                'unknown',
                                'analysed-by-me',
                                'analysed-by-operator',
                                'label-only',
                              ].map((option) => (
                                <option key={option} value={option}>
                                  {option.replaceAll('-', ' ')}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Help label="Analysis source" />
                        </div>
                        <div className={styles.field}>
                          <label>
                            Analysis date/time
                            <input
                              type="datetime-local"
                              value={
                                row.analysedAt &&
                                Number.isFinite(Date.parse(row.analysedAt))
                                  ? new Date(
                                      new Date(row.analysedAt).getTime() -
                                        new Date(
                                          row.analysedAt,
                                        ).getTimezoneOffset() *
                                          60000,
                                    )
                                      .toISOString()
                                      .slice(0, 16)
                                  : ''
                              }
                              onChange={(event) =>
                                update(row.id, {
                                  analysedAt:
                                    event.target.value &&
                                    Number.isFinite(
                                      Date.parse(event.target.value),
                                    )
                                      ? new Date(
                                          event.target.value,
                                        ).toISOString()
                                      : null,
                                })
                              }
                              onBlur={(event) => {
                                const value = event.target.value;
                                if (
                                  value &&
                                  Number.isFinite(Date.parse(value))
                                ) {
                                  const timestamp = new Date(
                                    value,
                                  ).toISOString();
                                  if (timestamp !== row.analysedAt)
                                    update(row.id, { analysedAt: timestamp });
                                }
                              }}
                            />
                          </label>
                          <Help label="Analysis date/time" />
                        </div>
                        <div className={styles.field}>
                          <label>
                            Fill / operator source
                            <select
                              value={row.fillSource ?? 'unknown'}
                              onChange={(event) =>
                                update(row.id, {
                                  fillSource: event.target.value as NonNullable<
                                    AllocationCylinder['fillSource']
                                  >,
                                })
                              }
                            >
                              {[
                                'unknown',
                                'dive-centre',
                                'day-boat',
                                'liveaboard',
                                'resort',
                              ].map((option) => (
                                <option key={option} value={option}>
                                  {option.replaceAll('-', ' ')}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Help label="Fill / operator source" />
                        </div>
                      </>
                    )}
                    <div className={styles.field}>
                      <label>
                        Available from checkpoint
                        <select
                          value={row.availableFrom}
                          onChange={(event) =>
                            update(row.id, {
                              availableFrom: event.target.value,
                            })
                          }
                        >
                          {points.map((point) => (
                            <option key={point.id} value={point.id}>
                              {point.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Help label="Available from checkpoint" />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.check}>
                        <input
                          type="checkbox"
                          disabled={owned}
                          checked={row.analysisConfirmed}
                          onChange={(event) =>
                            update(row.id, {
                              analysisConfirmed: event.target.checked,
                            })
                          }
                        />{' '}
                        Actual analysis confirmed
                      </label>
                      <Help label="Actual analysis confirmed" />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.check}>
                        <input
                          type="checkbox"
                          disabled={owned}
                          checked={row.conditionConfirmed}
                          onChange={(event) =>
                            update(row.id, {
                              conditionConfirmed: event.target.checked,
                            })
                          }
                        />{' '}
                        Cylinder condition and configuration confirmed
                      </label>
                      <Help label="Cylinder condition and configuration confirmed" />
                    </div>
                    <div className={styles.wide}>
                      <label className={styles.wide}>
                        Supply notes
                        <textarea
                          value={row.notes ?? ''}
                          onChange={(event) =>
                            update(row.id, { notes: event.target.value })
                          }
                        />
                      </label>
                      <Help label="Supply notes" />
                    </div>
                  </div>
                  {row.mode === 'own-empty' && (
                    <p className={styles.notice}>
                      Fill order: {row.label || 'select cylinder'} ·{' '}
                      {row.gas.oxygen == null
                        ? 'gas required'
                        : `${(row.gas.oxygen * 100).toFixed(1)}% O₂`}{' '}
                      · requested {row.plannedStartPressureBar ?? '?'} bar ·{' '}
                      {row.waterVolumeL && row.plannedStartPressureBar
                        ? Math.max(
                            0,
                            row.plannedStartPressureBar -
                              (row.currentPressureBar ?? 0),
                          ) * row.waterVolumeL
                        : '?'}{' '}
                      L estimated top-up. Analyse after filling. A fill is not
                      recorded by this Plan.
                    </p>
                  )}
                  <details>
                    <summary>Snapshot and canonical evidence</summary>
                    <p>
                      Snapshot {row.snapshotId} · captured {row.capturedAt}
                    </p>
                    <p>
                      Canonical{' '}
                      {row.canonicalId ?? 'Temporary planning snapshot'} · fill{' '}
                      {row.fillId ?? 'not linked'} · analysis{' '}
                      {row.analysisId ?? 'not linked'}
                    </p>
                    <p>
                      Current {row.currentPressureBar ?? 'unknown'} bar; planned{' '}
                      {row.plannedStartPressureBar ?? 'unknown'} bar. Refresh
                      explicitly when canonical evidence changes.
                    </p>
                  </details>
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        cylinders: value.cylinders.filter(
                          (item) => item.id !== row.id,
                        ),
                      })
                    }
                  >
                    Remove this supply
                  </button>
                </fieldset>
              );
            })}
          </div>
          <fieldset>
            <legend>Accessibility configuration</legend>
            <p>
              Independent sidemount cylinders retain separate pressure and
              reserve. Pony/bailout remains reserved unless explicitly assigned
              to a route or scenario. A connected manifold requires both members
              and an open, verified operating configuration.
            </p>
            {value.manifolds.map((group) => (
              <div className={styles.fields} key={group.id}>
                <div className={styles.field}>
                  <label>
                    Manifold label
                    <input
                      value={group.label}
                      onChange={(event) =>
                        patch({
                          manifolds: value.manifolds.map((row) =>
                            row.id === group.id
                              ? { ...row, label: event.target.value }
                              : row,
                          ),
                        })
                      }
                    />
                  </label>
                  <Help label="Manifold label" />
                </div>
                {[0, 1].map((position) => (
                  <div key={position} className={styles.field}>
                    <label key={position}>
                      Member {position + 1}
                      <select
                        value={group.cylinderIds[position] ?? ''}
                        onChange={(event) =>
                          patch({
                            manifolds: value.manifolds.map((row) =>
                              row.id === group.id
                                ? {
                                    ...row,
                                    cylinderIds: [
                                      position === 0
                                        ? event.target.value
                                        : (row.cylinderIds[0] ?? ''),
                                      position === 1
                                        ? event.target.value
                                        : (row.cylinderIds[1] ?? ''),
                                    ],
                                  }
                                : row,
                            ),
                          })
                        }
                      >
                        <option value="">Select main cylinder</option>
                        {value.cylinders
                          .filter((row) => row.role === 'main')
                          .map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.label || row.id}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Help label="Manifold member" />
                  </div>
                ))}
                <div className={styles.field}>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={group.connected}
                      onChange={(event) =>
                        patch({
                          manifolds: value.manifolds.map((row) =>
                            row.id === group.id
                              ? { ...row, connected: event.target.checked }
                              : row,
                          ),
                        })
                      }
                    />{' '}
                    Connection and compatible configuration verified
                  </label>
                  <Help label="Connection and compatible configuration verified" />
                </div>
                <div className={styles.field}>
                  <label>
                    Operating state
                    <select
                      value={group.operatingState}
                      onChange={(event) =>
                        patch({
                          manifolds: value.manifolds.map((row) =>
                            row.id === group.id
                              ? {
                                  ...row,
                                  operatingState: event.target
                                    .value as typeof row.operatingState,
                                }
                              : row,
                          ),
                        })
                      }
                    >
                      <option value="unknown">Unknown</option>
                      <option value="open">Open connected supply</option>
                      <option value="closed">Closed / isolated</option>
                    </select>
                  </label>
                  <Help label="Operating state" />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      manifolds: value.manifolds.filter(
                        (row) => row.id !== group.id,
                      ),
                    })
                  }
                >
                  Remove manifold
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patch({
                  manifolds: [
                    ...value.manifolds,
                    {
                      id: crypto.randomUUID(),
                      label: 'Backmount manifold',
                      cylinderIds: [],
                      connected: false,
                      operatingState: 'unknown',
                    },
                  ],
                })
              }
            >
              Configure manifolded pair
            </button>
            <div className={styles.field}>
              <label>
                Owner-selected sidemount balance tolerance (bar, optional)
                <input
                  type="number"
                  min="1"
                  value={value.sidemountBalanceToleranceBar ?? ''}
                  onChange={(event) =>
                    patch({
                      sidemountBalanceToleranceBar: numeric(event.target.value),
                    })
                  }
                />
                <small>
                  No assumed equal split or automatic pressure balancing.
                </small>
              </label>
              <Help label="Owner-selected sidemount balance tolerance (bar, optional)" />
            </div>
          </fieldset>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label>
                Frozen-engine reference supply
                <select
                  value={value.referenceSupplyId ?? ''}
                  onChange={(event) =>
                    patch({ referenceSupplyId: event.target.value })
                  }
                >
                  <option value="">Unassigned / reference capacity only</option>
                  {choices.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </select>
                <small>
                  Single accessible supply for the frozen comparison.
                  Independent totals never feed this reference.
                </small>
              </label>
              <Help label="Frozen-engine reference supply" />
            </div>
            {input.mode === 'direct-ascent' && (
              <div className={styles.field}>
                <label>
                  Working-time supply
                  <select
                    value={value.workingSupplyId ?? ''}
                    onChange={(event) =>
                      patch({ workingSupplyId: event.target.value })
                    }
                  >
                    <option value="">Assign explicitly</option>
                    {choices.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Help label="Working-time supply" />
              </div>
            )}
          </div>
          <fieldset>
            <legend>Explicit gas switches</legend>
            <p>
              MOD is a ceiling. Choose the checkpoint where each different gas
              or stage becomes the planned supply. This gives no NDL or
              physiological credit.
            </p>
            {(value.switches ?? []).map((row, i) => (
              <div className={styles.fields} key={i}>
                <div className={styles.field}>
                  <label>
                    Switch checkpoint
                    <select
                      value={row.checkpointId}
                      onChange={(event) =>
                        patch({
                          switches: (value.switches ?? []).map((entry, j) =>
                            i === j
                              ? { ...entry, checkpointId: event.target.value }
                              : entry,
                          ),
                        })
                      }
                    >
                      {points.map((point) => (
                        <option key={point.id} value={point.id}>
                          {point.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Help label="Switch checkpoint" />
                </div>
                <div className={styles.field}>
                  <label>
                    Switch to
                    <select
                      value={row.supplyId}
                      onChange={(event) =>
                        patch({
                          switches: (value.switches ?? []).map((entry, j) =>
                            i === j
                              ? { ...entry, supplyId: event.target.value }
                              : entry,
                          ),
                        })
                      }
                    >
                      <option value="">Choose supply</option>
                      {choices.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Help label="Switch to" />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      switches: (value.switches ?? []).filter(
                        (_, j) => i !== j,
                      ),
                    })
                  }
                >
                  Remove switch
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patch({
                  switches: [
                    ...(value.switches ?? []),
                    { checkpointId: 'start', supplyId: '' },
                  ],
                })
              }
            >
              Add explicit switch
            </button>
          </fieldset>
          <fieldset>
            <legend>Normal-route reserve assignments</legend>
            <p>
              The selected frozen reserve is{' '}
              {snapshot?.reserve.selectedLitres?.toFixed(1) ??
                snapshot?.reserve.totalLitres?.toFixed(1) ??
                'unknown'}{' '}
              L. It already includes the displayed emergency phases and both
              divers’ RMV. Assign it explicitly; thirds floors also apply to
              each accessible supply where selected.
            </p>
            <button
              type="button"
              disabled={!value.referenceSupplyId || !snapshot}
              onClick={suggestReserves}
            >
              Replace with suggested explicit reserve assignments
            </button>
            <ReserveRows
              rows={value.reserves}
              change={(reserves) => patch({ reserves })}
              points={points}
              choices={choices}
            />
          </fieldset>
          <fieldset>
            <legend>Contingency / bailout scenarios</legend>
            <p>
              Each selected alternative is checked separately. Failure of a
              later switch can require an earlier supply to cover the remaining
              route; that is a contingency, not ordinary consumption.
            </p>
            {value.scenarios.map((row) => {
              const at = points.findIndex((point) => point.id === row.at);
              return (
                <fieldset key={row.id}>
                  <legend>{row.label || 'Contingency'}</legend>
                  <div className={styles.fields}>
                    <div className={styles.field}>
                      <label>
                        Assumption / scenario name
                        <input
                          value={row.label}
                          onChange={(event) =>
                            scenario(row.id, { label: event.target.value })
                          }
                        />
                      </label>
                      <Help label="Assumption / scenario name" />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.check}>
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(event) =>
                            scenario(row.id, { selected: event.target.checked })
                          }
                        />{' '}
                        Include in readiness
                      </label>
                      <Help label="Include in readiness" />
                    </div>
                    <div className={styles.field}>
                      <label>
                        Scenario starts at
                        <select
                          value={row.at}
                          onChange={(event) =>
                            scenario(row.id, {
                              at: event.target.value,
                              assignments: [],
                            })
                          }
                        >
                          {points.map((point) => (
                            <option key={point.id} value={point.id}>
                              {point.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Help label="Scenario starts at" />
                    </div>
                    <div className={styles.field}>
                      <label>
                        Unavailable supplies / failed switches
                        <select
                          multiple
                          value={row.failedSupplyIds}
                          onChange={(event) =>
                            scenario(row.id, {
                              failedSupplyIds: Array.from(
                                event.target.selectedOptions,
                                (option) => option.value,
                              ),
                            })
                          }
                        >
                          {choices.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Help label="Unavailable supplies / failed switches" />
                    </div>
                    {segments.slice(Math.max(0, at)).map((segment) => (
                      <div key={segment.id} className={styles.field}>
                        <label key={segment.id}>
                          Supply for {segment.label || segment.id}
                          <select
                            value={
                              row.assignments.find(
                                (entry) => entry.segmentId === segment.id,
                              )?.supplyId ?? ''
                            }
                            onChange={(event) =>
                              scenario(row.id, {
                                assignments: [
                                  ...row.assignments.filter(
                                    (entry) => entry.segmentId !== segment.id,
                                  ),
                                  {
                                    segmentId: segment.id,
                                    supplyId: event.target.value,
                                  },
                                ],
                              })
                            }
                          >
                            <option value="">Assign explicitly</option>
                            {choices.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Help label="Scenario route supply" />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      scenario(row.id, {
                        reserves: structuredClone(value.reserves),
                      })
                    }
                  >
                    Copy reviewed normal reserve assignments
                  </button>
                  <ReserveRows
                    rows={row.reserves}
                    change={(reserves) => scenario(row.id, { reserves })}
                    points={points}
                    choices={choices}
                  />
                  <details>
                    <summary>
                      Advanced owner-selected additional allowance
                    </summary>
                    <div className={styles.field}>
                      <label className={styles.check}>
                        <input
                          type="checkbox"
                          checked={row.advanced?.enabled ?? false}
                          onChange={(event) =>
                            scenario(row.id, {
                              advanced: {
                                version: 1,
                                enabled: event.target.checked,
                                factor: row.advanced?.factor ?? 1,
                                basis: 'route-consumption-excluding-reserve',
                                ownerSelectedAt: new Date().toISOString(),
                              },
                            })
                          }
                        />{' '}
                        Apply an additional factor to this scenario’s route
                        consumption
                      </label>
                      <Help label="Apply an additional factor to this scenario’s route consumption" />
                    </div>
                    {row.advanced?.enabled && (
                      <div className={styles.field}>
                        <label>
                          Additional scenario factor
                          <input
                            type="number"
                            min="1"
                            step=".05"
                            value={row.advanced.factor}
                            onChange={(event) =>
                              scenario(row.id, {
                                advanced: {
                                  ...row.advanced!,
                                  factor: Number(event.target.value),
                                  ownerSelectedAt: new Date().toISOString(),
                                },
                              })
                            }
                          />
                        </label>
                        <Help label="Additional scenario factor" />
                      </div>
                    )}
                    <p>
                      Version 1 · applied once after the displayed route
                      stress/buddy inputs. The frozen emergency reserve is never
                      multiplied. No universal 1.5× or 2× default is implied.
                    </p>
                  </details>
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        scenarios: value.scenarios.filter(
                          (entry) => entry.id !== row.id,
                        ),
                      })
                    }
                  >
                    Remove scenario
                  </button>
                </fieldset>
              );
            })}
            <button
              type="button"
              onClick={() =>
                patch({
                  scenarios: [
                    ...value.scenarios,
                    {
                      id: crypto.randomUUID(),
                      label: '',
                      selected: true,
                      at: 'start',
                      failedSupplyIds: [],
                      assignments: [],
                      reserves: [],
                    },
                  ],
                })
              }
            >
              Add contingency / bailout scenario
            </button>
          </fieldset>
        </>
      )}
    </section>
  );
}
function ReserveRows({
  rows,
  change,
  points,
  choices,
}: {
  rows: ReserveAssignment[];
  change: (rows: ReserveAssignment[]) => void;
  points: Array<{ id: string; label: string }>;
  choices: Array<{ id: string; label: string }>;
}) {
  const patch = (id: string, value: Partial<ReserveAssignment>) =>
    change(rows.map((row) => (row.id === id ? { ...row, ...value } : row)));
  return (
    <div className={styles.reserves}>
      {rows.map((row) => (
        <div className={styles.fields} key={row.id}>
          <div className={styles.field}>
            <label>
              Reserve supply
              <select
                value={row.supplyId}
                onChange={(event) =>
                  patch(row.id, { supplyId: event.target.value })
                }
              >
                <option value="">Assign supply</option>
                {choices.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Help label="Reserve supply" />
          </div>
          <div className={styles.field}>
            <label>
              Assigned reserve (L)
              <input
                type="number"
                min="0"
                step=".1"
                value={row.litres}
                onChange={(event) =>
                  patch(row.id, { litres: Number(event.target.value) })
                }
              />
            </label>
            <Help label="Assigned reserve (L)" />
          </div>
          <div className={styles.field}>
            <label>
              From checkpoint
              <select
                value={row.from}
                onChange={(event) =>
                  patch(row.id, { from: event.target.value })
                }
              >
                {points.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.label}
                  </option>
                ))}
              </select>
            </label>
            <Help label="From checkpoint" />
          </div>
          <div className={styles.field}>
            <label>
              Through checkpoint
              <select
                value={row.through}
                onChange={(event) =>
                  patch(row.id, { through: event.target.value })
                }
              >
                {points.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.label}
                  </option>
                ))}
              </select>
            </label>
            <Help label="Through checkpoint" />
          </div>
          <button
            type="button"
            onClick={() => change(rows.filter((entry) => entry.id !== row.id))}
          >
            Remove reserve assignment
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          change([
            ...rows,
            {
              id: crypto.randomUUID(),
              supplyId: '',
              litres: 0,
              from: 'start',
              through: points.at(-1)?.id ?? 'start',
            },
          ])
        }
      >
        Add reserve assignment
      </button>
    </div>
  );
}
export function AllocationResults({
  result,
}: {
  result: ReturnType<typeof allocationReadiness>;
}) {
  const allocation = result.allocation;
  return (
    <section className={styles.panel} aria-label="Per-cylinder readiness">
      <h3>Readiness: {result.status}</h3>
      <p>
        Allocation {allocation.status} · physiological validation{' '}
        {result.physiologicalStatus}. Totals are informational and cannot
        override any individual or selected-scenario failure.
      </p>
      {[...allocation.reasons, ...result.physiologicalReasons].length > 0 && (
        <ul>
          {[...allocation.reasons, ...result.physiologicalReasons].map(
            (reason) => (
              <li key={reason}>{reason}</li>
            ),
          )}
        </ul>
      )}
      <div className={styles.cards}>
        {allocation.cylinders.map((row) => (
          <article key={row.id} data-state={row.status}>
            <h4>
              {row.label || row.id} · {row.role} · {row.status}
            </h4>
            <dl>
              <div>
                <dt>Gas</dt>
                <dd>
                  {row.gas.oxygen == null
                    ? 'Unknown O₂'
                    : `${(row.gas.oxygen * 100).toFixed(1)}% O₂`}{' '}
                  ·{' '}
                  {row.gas.helium == null
                    ? 'Unknown He'
                    : `${(row.gas.helium * 100).toFixed(1)}% He`}
                </dd>
              </div>
              <div>
                <dt>Available from</dt>
                <dd>
                  {row.availableFrom === 'start'
                    ? 'Start'
                    : (row.checkpoints.find(
                        (point) => point.id === row.availableFrom,
                      )?.label ?? row.availableFrom)}
                </dd>
              </div>
              <div>
                <dt>Current / planned start</dt>
                <dd>
                  {row.currentPressureBar ?? '?'} /{' '}
                  {row.plannedStartPressureBar ?? '?'} bar
                </dd>
              </div>
              <div>
                <dt>Available</dt>
                <dd>{row.availableLitres.toFixed(1)} L</dd>
              </div>
              <div>
                <dt>Normal route + reserve required</dt>
                <dd>{row.requiredLitres.toFixed(1)} L</dd>
              </div>
              <div>
                <dt>Assigned reserve</dt>
                <dd>{row.reserveLitres.toFixed(1)} L</dd>
              </div>
              <div>
                <dt>Largest selected contingency requirement</dt>
                <dd>{row.contingencyRequiredLitres.toFixed(1)} L</dd>
              </div>
            </dl>
            <details>
              <summary>Supply identity</summary>
              <p>
                Canonical: {row.canonicalId ?? 'Temporary planning supply'} ·
                snapshot: {row.snapshotId}
              </p>
            </details>
            {row.reasons.length > 0 && (
              <ul>
                {row.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
            {row.remedies.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
            <details>
              <summary>Individual checkpoint pressure and obligations</summary>
              {row.checkpoints.map((point) => (
                <p key={point.id}>
                  <b>
                    {point.label}: {point.status}
                  </b>{' '}
                  · remaining {point.remainingLitres.toFixed(1)} L /{' '}
                  {point.remainingPressureBar?.toFixed(1) ?? '?'} bar · required{' '}
                  {point.requiredLitres.toFixed(1)} L, including{' '}
                  {point.reserveLitres.toFixed(1)} L reserve
                </p>
              ))}
            </details>
          </article>
        ))}
      </div>
      {allocation.balance.length > 0 && (
        <details>
          <summary>Sidemount balance at each checkpoint</summary>
          {allocation.balance.map((row) => (
            <p key={row.checkpointId}>
              {row.checkpointId}: {row.differenceBar.toFixed(1)} bar difference
              · {row.status}
            </p>
          ))}
        </details>
      )}
      {allocation.scenarios.map((scenario) => (
        <details key={scenario.id}>
          <summary>
            {scenario.label || 'Unnamed'} · contingency/bailout ·{' '}
            {scenario.selected ? 'selected' : 'not selected'} ·{' '}
            {scenario.status}
          </summary>
          <p>
            {scenario.basis} Additional factor {scenario.factor}×.
          </p>
          {scenario.reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
          {scenario.cylinders.map((row) => (
            <details key={row.id}>
              <summary>
                {row.label || row.id} · {row.role} · {row.status}
              </summary>
              <p>
                Required {row.requiredLitres.toFixed(1)} L ·{' '}
                {row.reasons.join(' ')}
              </p>
              {row.checkpoints.map((point) => (
                <p key={point.id}>
                  {point.label}: {point.status} · remaining{' '}
                  {point.remainingLitres.toFixed(1)} L /{' '}
                  {point.remainingPressureBar?.toFixed(1) ?? '?'} bar · required{' '}
                  {point.requiredLitres.toFixed(1)} L including{' '}
                  {point.reserveLitres.toFixed(1)} L reserve.
                </p>
              ))}
            </details>
          ))}
        </details>
      ))}
    </section>
  );
}
