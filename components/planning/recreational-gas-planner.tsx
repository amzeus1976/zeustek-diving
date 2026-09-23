'use client';
import {GasInputHelp as Help} from './gas-input-help';

import type {ReactNode} from 'react';
import {newRouteLeg,updateRouteLeg} from '../../lib/gas-allocation/route-editor';
import type { RecreationalGasInput, RecreationalGasSnapshot } from '../../lib/offline/recreational-gas-planner';
import type { RouteSegment } from '../../lib/offline/recreational-gas-reserve';
import styles from './recreational-gas-planner.module.css';

type Props = { input: RecreationalGasInput; snapshot: RecreationalGasSnapshot | null; error: string | null; change: (patch: Partial<RecreationalGasInput>) => void; allocationMode?:boolean; supplyChoices?:Array<{id:string;label:string}>; supplyContent?:ReactNode };
const numeric = (value: string) => value === '' ? null : Number(value);
const display = (value: number | null | undefined, places = 1) => value == null || !Number.isFinite(value) ? '—' : value.toFixed(places);
const sourceLabel: Record<string, string> = {
  preset: 'Preset comparison', 'analysed-fill': 'Analysed gas', custom: 'Manual selected mix',
  'owned-cylinder': 'Owned cylinder', 'rental-snapshot': 'Rental snapshot', 'operator-supplied': 'Operator supplied',
  'calculated-best': 'Calculated best mix', 'calculated-conservative': 'Calculated conservative mix',
};

export function RecreationalGasPlanner({ input, snapshot, error, change, allocationMode=false,supplyChoices=[],supplyContent }: Props) {
  const selected = snapshot?.gasCandidates.find(row => row.selected);
  const reserve = snapshot?.reserve;
  const sourceLocked = input.cylinderSourceMode === 'owned' || input.cylinderSourceMode === 'rental';
  const updateSegment = (id: string, patch: Partial<RouteSegment>) => change({
    routeSegments: updateRouteLeg(input.routeSegments,id,patch),
  });
  return <section className={styles.planner} aria-label="Recreational gas planner">
    <header><span className="focus-eyebrow">T12.6R · RECREATIONAL NO-STOP</span><h3>Gas planner</h3><p>NDL is the no-decompression limit at depth. Gas-limited time, owner duration and planned working time are separate.</p></header>

    <details open><summary>− Mode &amp; NDL engine</summary><div className={styles.controls}>
      <div className={styles.field}><label>Mode<select value={input.mode} onChange={event => change({ mode: event.target.value as RecreationalGasInput['mode'] })}><option value="direct-ascent">Direct ascent</option><option value="out-and-back">Out-and-back / return to exit</option><option value="reef-return">Reef / wall return</option><option value="shore-return">Shore return</option><option value="wreck-route">Wreck route</option><option value="multilevel">Recreational multilevel</option></select></label><Help label="Mode"/></div>
      <div className={styles.field}><label>Bühlmann model<select value={input.selectedBuhlmannModel} onChange={event => change({ selectedBuhlmannModel: event.target.value as RecreationalGasInput['selectedBuhlmannModel'] })}><option value="ZH-L16B">ZH-L16B + GF</option><option value="ZH-L16C">ZH-L16C + GF</option></select></label><Help label="Bühlmann model"/></div>
      <div className={styles.field}><label>GF Low (%)<input type="number" min="1" max="100" value={input.gfLow} onChange={event => change({ gfLow: Number(event.target.value) })}/></label><Help label="GF Low (%)"/></div>
      <div className={styles.field}><label>GF High (%)<input type="number" min="1" max="100" value={input.gfHigh} onChange={event => change({ gfHigh: Number(event.target.value) })}/></label><Help label="GF High (%)"/></div>
      <div className={styles.field}><label className={styles.check}><input type="checkbox" checked={input.compareOtherModel} onChange={event => change({ compareOtherModel: event.target.checked })}/> Compare the other model</label><Help label="Compare the other model"/></div>
      <div className={styles.sourceFacts}>
        <span><small>Engine version</small><strong>{selected?.ndl.engineVersion ?? 'Pending valid calculation'}</strong></span>
        <span><small>Rested tissue assumption</small><strong>{selected?.ndl.restedOrResidual === 'same-dive-levels' ? 'Same-dive carried levels' : 'Rested surface-air tissues'}</strong></span>
        <span><small>Table backup</small><strong>{selected?.tableBackup.reason ?? (selected?.tableBackup.provider ? `${selected.tableBackup.provider} ${selected.tableBackup.version ?? ''}` : 'No backup table configured.')}</strong></span>
      </div>
      <p className={styles.note}>GF High controls the no-stop surfacing check. GF Low is stored and displayed for future compatibility; this release never generates decompression stops.</p>
    </div></details>

    {!allocationMode&&<details open><summary>− Cylinder source &amp; gas evidence</summary><div className={styles.controls}>
      <div className={styles.sourceFacts}>
        <span><small>Cylinder source</small><strong>{input.cylinderSourceMode === 'owned' ? 'Owned canonical cylinder' : input.cylinderSourceMode === 'rental' ? 'Rental / temporary snapshot' : 'Manual planning input'}</strong></span>
        <span><small>Source label</small><strong>{input.cylinderSourceLabel || 'Not selected'}</strong></span>
        <span><small>Pressure source</small><strong>{input.pressureSource || 'Not recorded'}</strong></span>
        <span><small>Analysis provenance</small><strong>{input.analysisProvenance || 'Not recorded'}</strong></span>
      </div>
      {!!input.fillProvenance?.length && <p className={styles.note}><strong>Fill lineage:</strong> {input.fillProvenance.join(' → ')}</p>}
      <div className={styles.field}><label>Cylinder water volume (L)<input type="number" min="1" step="0.1" disabled={sourceLocked} value={input.cylinderWaterVolumeL ?? ''} onChange={event => change({ cylinderWaterVolumeL: numeric(event.target.value) })}/></label><Help label="Cylinder water volume (L)"/></div>
      <div className={styles.field}><label>Start pressure (bar)<input type="number" min="1" disabled={sourceLocked} value={input.startPressureBar ?? ''} onChange={event => change({ startPressureBar: numeric(event.target.value) })}/></label><Help label="Start pressure (bar)"/></div>
      {sourceLocked && <p className={styles.note}>Volume and pressure are supplied by the selected cylinder evidence below. Change them in that source card; the canonical cylinder is never silently overwritten.</p>}
    </div></details>}

    <details open><summary>− Depth / water / gas</summary><div className={styles.controls}>
      <div className={styles.field}><label>Water<select value={input.waterType} onChange={event => change({ waterType: event.target.value as RecreationalGasInput['waterType'] })}><option value="salt">Salt water · 10 m/bar</option><option value="fresh">Fresh water · 10.3 m/bar</option></select></label><Help label="Water"/></div>
      <div className={styles.field}><label>Surface pressure (bar)<input type="number" min="0.7" max="1.3" step="0.01" value={input.surfacePressureBar} onChange={event => change({ surfacePressureBar: Number(event.target.value) })}/></label><Help label="Surface pressure (bar)"/></div>
      <div className={styles.field}><label>Planned depth (m)<input type="number" min="1" max="60" step="0.5" value={input.plannedDepthM} onChange={event => change({ plannedDepthM: Number(event.target.value) })}/></label><Help label="Planned depth (m)"/></div>
      <div className={styles.field}><label>Conservatism depth (m)<input type="number" min="0" step="0.5" value={input.conservatismM} onChange={event => change({ conservatismM: Number(event.target.value) })}/></label><Help label="Conservatism depth (m)"/></div>
      <div className={styles.field}><label>Maximum PPO₂ (bar)<input type="number" min="0.5" max="1.6" step="0.05" value={input.maxPpo2} onChange={event => change({ maxPpo2: Number(event.target.value) })}/></label><Help label="Maximum PPO₂ (bar)"/></div>
      <div className={styles.field}><label>Selected / actual gas<select value={input.selectedGasLabel} disabled={sourceLocked} onChange={event => change({ selectedGasLabel: event.target.value })}>{!input.selectedGasLabel && <option value="">No valid current gas evidence</option>}{snapshot?.gasCandidates.filter(row => row.source !== 'calculated-best' && row.source !== 'calculated-conservative').map(row => <option key={row.label} value={row.label}>{row.label}</option>) ?? <option value="Air / EAN21">Air / EAN21</option>}</select></label><Help label="Selected / actual gas"/></div>
      <div className={styles.field}><label>Custom nitrox O₂ (%)<input type="number" min="16" max="99" step="0.1" disabled={sourceLocked} value={input.customGas ? input.customGas.oxygenFraction * 100 : ''} onChange={event => { const percent = numeric(event.target.value); const customGas = percent == null ? null : { label: `Custom EAN${percent}`, oxygenFraction: percent / 100, source: 'custom' as const, analysed: false }; change({ customGas, ...(input.selectedGasLabel === input.customGas?.label ? { selectedGasLabel: customGas?.label ?? 'Air / EAN21' } : {}) }); }}/></label><Help label="Custom nitrox O₂ (%)"/></div>
      <p className={styles.note}>Best mix {display(snapshot?.bestOxygenFraction == null ? null : snapshot.bestOxygenFraction * 100)}% O₂ · conservative mix {display(snapshot?.conservativeOxygenFraction == null ? null : snapshot.conservativeOxygenFraction * 100)}% O₂. A lower-O₂ gas remains allowed.</p>
      {snapshot && <p className={styles.note}>{snapshot.selectedGasAssessment.summary}</p>}
      <div className={styles.sourceFacts}><span>NDL at planned depth<strong>{selected?.ndl.state==='available'?`${selected.ndl.minutes} min`:'Unavailable'}</strong></span><span>MOD ceiling<strong>{display(selected?.modM)} m</strong></span><span>PPO₂ at planned / conservative depth<strong>{display(selected?.ppo2AtPlannedDepth,2)} / {display(selected?.ppo2AtConservativeDepth,2)} bar</strong></span></div>
    </div></details>

    <details open><summary>− Gas time &amp; emergency reserve</summary><div className={styles.controls}>
      <div className={styles.field}><label>Own RMV (L/min)<input type="number" min="1" step="0.1" value={input.ownRmvLMin ?? ''} onChange={event => change({ ownRmvLMin: numeric(event.target.value), ownRmvSource: 'owner-entered' })}/><small>Source: {input.ownRmvSource ?? 'unknown'}</small></label><Help label="Own RMV (L/min)"/></div>
      <div className={styles.field}><label>Buddy RMV (L/min)<input type="number" min="1" step="0.1" value={input.buddyRmvLMin ?? ''} onChange={event => change({ buddyRmvLMin: numeric(event.target.value), buddyRmvSource: event.target.value ? 'owner-entered' : 'owner-fallback' })}/><small>Source: {input.buddyRmvSource ?? 'unknown'}</small></label><Help label="Buddy RMV (L/min)"/></div>
      <div className={styles.field}><label>Ascent rate (m/min)<input type="number" min="1" step="0.5" value={input.ascentRateMMin} onChange={event => change({ ascentRateMMin: Number(event.target.value) })}/></label><Help label="Ascent rate (m/min)"/></div>
      <div><label>Reserve strategy<select value={input.reserveStrategy} onChange={event => change({ reserveStrategy: event.target.value as RecreationalGasInput['reserveStrategy'] })}><option value="calculated">Calculated emergency reserve</option><option value="thirds">Rule of thirds</option><option value="most-conservative">Most conservative of both</option></select></label><Help label="Reserve strategy">The validated emergency phases already include both divers and their displayed multipliers. Most conservative selects the larger requirement. T14 also assesses an applicable thirds obligation separately for each accessible supply; independent cylinders are not pooled.</Help></div>
      <div><label>Owner maximum duration (min, optional)<input type="number" min="1" value={input.ownerMaxDurationMin ?? ''} onChange={event => change({ ownerMaxDurationMin: numeric(event.target.value) })}/></label><Help label="Owner maximum duration">An optional personal cap, separate from NDL and gas availability. It cannot extend either limit.</Help></div>
      <div><label>Planned working time (min)<input type="number" min="1" value={input.plannedWorkingTimeMin ?? ''} onChange={event => change({ plannedWorkingTimeMin: numeric(event.target.value) })}/></label><Help label="Planned working time">Your planned time at depth. All route intervals must fit within this declared time. Emergency ascent and reserve are assessed separately.</Help></div>
    </div><div className={styles.metrics}><span>Total gas <strong>{display(snapshot?.totalGasLitres, 0)} L</strong></span><span>Emergency reserve <strong>{display(reserve?.totalLitres, 0)} L</strong></span><span>Thirds reserve <strong>{display(reserve?.thirdsLitres, 0)} L</strong></span><span>Reserve requirement <strong>{display(reserve?.selectedLitres, 0)} L · {display(reserve?.selectedBar, 0)} bar</strong></span></div>
      {reserve?.buddyFallback && <p role="alert" className={styles.warning}>Buddy RMV unknown — using owner RMV fallback for emergency reserve.</p>}
      {reserve?.state === 'unavailable' && <output>{reserve.reason}</output>}
      {!!reserve?.phases.length && <div className={styles.scroll}><table><thead><tr><th>Phase</th><th>Depth</th><th>Min</th><th>Both divers</th><th>Gas</th></tr></thead><tbody>{reserve.phases.map(phase => <tr key={phase.label}><td data-label="Phase">{phase.label}</td><td data-label="Depth">{display(phase.depthM)} m</td><td data-label="Minutes">{phase.minutes}</td><td data-label="Both divers">{phase.multiplier * 100}%</td><td data-label="Gas">{display(phase.litres, 0)} L</td></tr>)}</tbody></table></div>}
    </details>

    <details open><summary>− {allocationMode?'Frozen single-supply reference':'Limit summary'}</summary>
      {allocationMode&&<><p className={styles.note}>This reference comparison does not establish overall readiness. Use the individual supply and physiological assessments below.</p><div className={styles.controls}><div className={styles.field}><label>Reference water volume (L)<input type="number" min="1" disabled={Boolean(input.cylinderSourceId)} value={input.cylinderWaterVolumeL??''} onChange={event=>change({cylinderWaterVolumeL:numeric(event.target.value)})}/></label><Help label="Reference water volume (L)"/></div><div className={styles.field}><label>Reference pressure (bar)<input type="number" min="1" disabled={Boolean(input.cylinderSourceId)} value={input.startPressureBar??''} onChange={event=>change({startPressureBar:numeric(event.target.value)})}/></label><Help label="Reference pressure (bar)"/></div></div></>}
      <div className={styles.metrics}>
        <span>Planned depth <strong>{display(input.plannedDepthM)} m</strong></span><span>Gas mix <strong>{selected?.label ?? '—'}</strong></span>
        <span>MOD <strong>{display(selected?.modM)} m</strong></span><span>PPO₂ at planned depth <strong>{display(selected?.ppo2AtPlannedDepth, 2)} bar</strong></span>
        <span>PPO₂ at conservative depth <strong>{display(selected?.ppo2AtConservativeDepth, 2)} bar</strong></span><span>NDL at planned depth <strong>{selected?.ndl.state === 'available' ? `${selected.ndl.minutes} min` : selected?.ndl.unavailableReason ?? '—'}</strong></span>
        <span>Gas-limited time <strong>{display(selected?.gasLimitedTimeMin)} min</strong></span><span>Reserve requirement <strong>{display(reserve?.selectedLitres, 0)} L</strong></span>
        <span>Owner max duration <strong>{display(input.ownerMaxDurationMin, 0)} min</strong></span><span>Planned working time <strong>{display(input.plannedWorkingTimeMin, 0)} min</strong></span>
        <span>Available working time <strong>{display(snapshot?.availableWorkingTimeMin)} min</strong></span><span>Limiting factor <strong>{snapshot?.limitingFactor ?? 'missing-data'}</strong></span>
        <span className={snapshot?.readiness === 'Blocked' ? styles.blocked : snapshot?.readiness === 'Caution' ? styles.caution : styles.ready}>Readiness <strong>{snapshot?.readiness ?? 'Blocked'}</strong></span>
      </div>
    </details>

    <details open><summary>− Gas comparison</summary>
      <div className={styles.scroll}><table><thead><tr><th>Gas / source</th><th>O₂ / N₂</th><th>MOD</th><th>PPO₂ planned / conservative</th><th>EAD</th><th>{input.selectedBuhlmannModel} NDL</th>{input.compareOtherModel && <th>Other model NDL</th>}<th>Table backup</th><th>Gas time</th><th>Warnings</th></tr></thead><tbody>{snapshot?.gasCandidates.map(row => <tr key={row.label} aria-selected={row.selected}><td data-label="Gas / source"><strong>{row.label}</strong><small>{sourceLabel[row.source] ?? row.source}{row.selected ? ' · actual' : ''}{row.analysed ? ` · ${row.analysedEvidence ?? 'analysed evidence'}` : ''}</small></td><td data-label="O₂ / N₂">{display(row.oxygenFraction * 100, 0)}% / {display(row.nitrogenFraction * 100, 0)}%</td><td data-label="MOD">{display(row.modM)} m</td><td data-label="PPO₂ planned / conservative">{display(row.ppo2AtPlannedDepth, 2)} / {display(row.ppo2AtConservativeDepth, 2)}</td><td data-label="EAD">{display(row.eadM)} m</td><td data-label="Selected-model NDL">{row.ndl.state === 'available' ? `${row.ndl.minutes} min` : row.ndl.unavailableReason ?? row.ndl.state}</td>{input.compareOtherModel && <td data-label="Other-model NDL">{row.otherModelNdl?.state === 'available' ? `${row.otherModelNdl.minutes} min` : row.otherModelNdl?.unavailableReason ?? '—'}</td>}<td data-label="Table backup">{row.tableBackup.state === 'not-configured' ? 'No backup table configured.' : row.tableBackup.state === 'available' ? `${row.tableBackup.provider} ${row.tableBackup.version ?? ''} · ${row.tableBackup.minutes} min` : `${row.tableBackup.provider ?? ''} ${row.tableBackup.version ?? ''} · ${row.tableBackup.reason}`}</td><td data-label="Gas time">{display(row.gasLimitedTimeMin)} min</td><td data-label="Warnings">{row.warnings.join(' ') || 'OK'}</td></tr>)}</tbody></table></div>
    </details>

    {supplyContent}
    <details open><summary>− Route / checkpoint reserve</summary>
      {input.mode !== 'direct-ascent' && <><p className={styles.note}>Enter ordered route legs, including the return. Required gas at each checkpoint includes every remaining leg plus final reserve.</p>{input.routeSegments.map(segment => <fieldset className={styles.routeRow} key={segment.id}><legend>{segment.label || 'Route segment'}</legend>
        <div className={styles.field}><label>Checkpoint<input value={segment.label} onChange={event => updateSegment(segment.id, { label: event.target.value })}/></label><Help label="Checkpoint"/></div>
        <div className={styles.field}><label>Checkpoint type<select value={segment.checkpointKind ?? 'custom'} onChange={event => updateSegment(segment.id, { checkpointKind: event.target.value as NonNullable<RouteSegment['checkpointKind']> })}><option value="farthest">Farthest point</option><option value="deepest">Deepest point</option><option value="turn">Turn point</option><option value="return">Return to exit</option><option value="shallow">Shallow reef / shoulder</option><option value="safety-stop">Safety stop</option><option value="surface">Surface</option><option value="custom">Custom</option></select></label><Help label="Checkpoint type"/></div>
        <div className={styles.field}><label>Start depth (m)<input type="number" min="0" value={segment.startDepthM ?? ''} onChange={event => updateSegment(segment.id, { startDepthM: numeric(event.target.value) })}/></label><Help label="Start depth (m)"/></div>
        <div className={styles.field}><label>End depth (m)<input type="number" min="0" value={segment.endDepthM ?? ''} onChange={event => updateSegment(segment.id, { endDepthM: numeric(event.target.value) })}/></label><Help label="End depth (m)"/></div>
        <div className={styles.field}><label>Average depth (m)<input type="number" min="0" value={segment.averageDepthM ?? segment.depthM ?? ''} onChange={event => updateSegment(segment.id, { averageDepthM: numeric(event.target.value), depthM: null })}/></label><Help label="Average depth (m)"/></div>
        <div className={styles.field}><label>Duration (min)<input type="number" min="1" value={segment.durationMin ?? segment.minutes ?? ''} onChange={event => updateSegment(segment.id, { durationMin: numeric(event.target.value), minutes: null })}/></label><Help label="Duration (min)"/></div>
        <div className={styles.field}><label>Cylinder / gas<select value={segment.cylinderId??''} onChange={event=>updateSegment(segment.id,{cylinderId:event.target.value||null})}><option value="">Assign an accessible supply</option>{segment.cylinderId&&!supplyChoices.some(row=>row.id===segment.cylinderId)&&<option value={segment.cylinderId}>Unavailable saved supply · {segment.cylinderId}</option>}{supplyChoices.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label><Help label="Cylinder / gas"/></div>
        <div><label>Stress factor<input type="number" min="1" step="0.05" value={segment.stressFactor ?? 1} onChange={event => updateSegment(segment.id, { stressFactor: numeric(event.target.value) })}/></label><Help label="Stress factor">An explicit multiplier for this route interval only. Editing replaces the previous factor. The emergency reserve already includes its own displayed phase multipliers; this factor does not multiply that reserve.</Help></div>
        <div className={styles.field}><label className={styles.check}><input type="checkbox" checked={Boolean(segment.buddySharing)} onChange={event => updateSegment(segment.id, { buddySharing: event.target.checked })}/> Buddy sharing</label><Help label="Buddy sharing"/></div>
        <div className={styles.field}><label className={styles.check}><input type="checkbox" checked={segment.directAscentPossible !== false} onChange={event => updateSegment(segment.id, { directAscentPossible: event.target.checked })}/> Direct ascent possible</label><Help label="Direct ascent possible"/></div>
        <div className={styles.routeNotes}><label className={styles.routeNotes}>Route notes<input value={segment.notes ?? ''} onChange={event => updateSegment(segment.id, { notes: event.target.value })}/></label><Help label="Route notes"/></div>
        <button type="button" className="focus-secondary" onClick={() => change({ routeSegments: input.routeSegments.filter(row => row.id !== segment.id) })}>Remove</button>
      </fieldset>)}<button type="button" className="focus-secondary" onClick={() => change({ routeSegments: [...input.routeSegments,newRouteLeg(input.routeSegments)] })}>+ Add route leg / checkpoint</button></>}
      {allocationMode&&<p className={styles.note}>The table below is the frozen single-supply reference. Independent cylinder checkpoints and selected contingency failures are assessed in the allocation results.</p>}
      {snapshot?.routeCheckpoints.state === 'unavailable' ? <output>{snapshot.routeCheckpoints.reason}</output> : <div className={styles.scroll}><table><thead><tr><th>Checkpoint</th><th>Required remaining</th><th>Expected remaining</th><th>Required pressure</th><th>Expected pressure</th><th>Status</th><th>Reason</th></tr></thead><tbody>{snapshot?.routeCheckpoints.checkpoints.map((row, index) => <tr key={`${row.label}-${index}`}><td data-label="Checkpoint">{row.label}</td><td data-label="Required remaining">{display(row.requiredLitres, 0)} L</td><td data-label="Expected remaining">{display(row.expectedLitres, 0)} L</td><td data-label="Required pressure">{display(row.requiredPressureBar, 0)} bar</td><td data-label="Expected pressure">{display(row.expectedPressureBar, 0)} bar</td><td data-label="Status">{row.status}</td><td data-label="Reason">{row.reason}</td></tr>)}</tbody></table></div>}
    </details>

    <details open><summary>− Warnings &amp; save snapshot</summary>{error && <p role="alert" className={styles.warning}>{error}</p>}{snapshot?.readinessReasons.length ? <ul>{snapshot.readinessReasons.map((warning, i) => <li key={`${warning}-${i}`}>{warning}</li>)}</ul> : <p>No current calculation warnings.</p>}<p className={styles.note}>Save engine/model, source evidence, gas comparison, reserve phases, route checkpoints, warnings and readiness to this existing Gas Plan. No Dive or cylinder record is changed.</p></details>
  </section>;
}
