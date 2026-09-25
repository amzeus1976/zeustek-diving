'use client';

import type { DiveCylinder, DiveRecord } from '../../lib/offline/dives';
import { estimateWholeDiveOcrmv, isWholeDiveRmvEstimateCurrent } from '../../lib/whole-dive-oc-rmv';

type Props = {
  cylinders: DiveCylinder[];
  averageDepthM: number | null;
  elapsedMinutes: number | null;
  rmvRate: number | null;
  rmvEstimate: DiveRecord['rmvEstimate'];
  onParticipationChange: (index: number, value: 'used' | 'excluded' | null) => void;
  onApply: (estimate: NonNullable<DiveRecord['rmvEstimate']>) => void;
  onManualChange: (value: number | null) => void;
};

const unavailableCopy = {
  'invalid-dive-data': 'Enter a valid average depth and elapsed runtime.',
  'unreviewed-participation': 'Review every cylinder as used or excluded before estimating.',
  'unsupported-configuration': 'CCR or an unknown cylinder configuration cannot be included in this open-circuit estimate.',
  'duplicate-cylinder': 'Each cylinder needs a distinct saved identity.',
  'invalid-cylinder-data': 'Enter positive internal volume and valid start/end pressures for every used cylinder.',
  'fewer-than-two-used': 'Select at least two used open-circuit cylinders.',
} as const;

export function WholeDiveRmvControls(props: Props) {
  const estimate = estimateWholeDiveOcrmv({
    cylinders: props.cylinders,
    averageDepthM: props.averageDepthM,
    totalElapsedMin: props.elapsedMinutes,
  });
  const manualValue = props.rmvRate != null && !props.rmvEstimate;
  const provenanceCurrent = props.rmvEstimate ? isWholeDiveRmvEstimateCurrent({
    cylinders: props.cylinders,
    averageDepthM: props.averageDepthM,
    totalElapsedMin: props.elapsedMinutes,
    rmvRate: props.rmvRate,
    rmvEstimate: props.rmvEstimate,
  }) : false;
  return (
    <section className="whole-dive-rmv-controls" aria-label="Whole-dive open-circuit RMV">
      <h4>Whole-dive RMV estimate</h4>
      <p>Uses explicitly selected open-circuit cylinders, elapsed runtime and average depth with a seawater 10 m/atm approximation. This is not per-cylinder SAC, a gas reserve, or a decompression assessment.</p>
      <div className="field-grid field-grid-four">
        {props.cylinders.map((cylinder, index) => (
          <label key={cylinder.id || index}>
            {cylinder.name || `Cylinder ${index + 1}`} — whole-dive use
            <select value={cylinder.wholeDiveRmvParticipation ?? ''} onChange={event => props.onParticipationChange(index, event.target.value === 'used' || event.target.value === 'excluded' ? event.target.value : null)}>
              <option value="">Not reviewed</option>
              <option value="used">Used in this Dive</option>
              <option value="excluded">Not used / bailout</option>
            </select>
          </label>
        ))}
        <label>
          Whole-dive RMV (L/min, manual or applied estimate)
          <input type="number" min="0" step="any" value={props.rmvRate ?? ''} onChange={event => props.onManualChange(event.target.value === '' ? null : Number(event.target.value))} />
        </label>
      </div>
      {estimate.kind === 'estimate' ? (
        <output>{estimate.usedLitres.toLocaleString('en-GB')} L used over {estimate.elapsedMinutes} min at {estimate.averageDepthM} m average: <strong>{estimate.rmvLitresPerMinute.toFixed(2)} L/min</strong> whole-dive estimate from {estimate.includedCylinderIds.length} selected cylinders.</output>
      ) : <output>{unavailableCopy[estimate.reason]}</output>}
      {manualValue && <p>The manual or legacy value is preserved. Clear it before applying a new estimate.</p>}
      {props.rmvEstimate && <p>{provenanceCurrent ? `Applied ${props.rmvEstimate.version} estimate from ${props.rmvEstimate.includedCylinders.length} cylinders.` : 'The applied estimate no longer matches these inputs. Reapply it before saving.'}</p>}
      <button type="button" className="focus-secondary" disabled={estimate.kind !== 'estimate' || manualValue} onClick={() => {
        if (estimate.kind !== 'estimate') return;
        const {kind: _kind, includedCylinderIds: _ids, ...snapshot} = estimate;
        props.onApply(snapshot);
      }}>Apply estimate to this Dive draft</button>
    </section>
  );
}
