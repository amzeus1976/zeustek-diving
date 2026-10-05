import type {EnrichedDivePlanExtension} from '../../lib/offline/dive-planning-centre';
import type {PlanWeatherField} from '../../lib/plan-weather';
import {depthLabel} from '../../lib/weather/conditions-model';
import styles from './plan-condition-fields.module.css';

export function PlanConditionFields({draft,change,changeWeather}:{draft:EnrichedDivePlanExtension;change:(patch:Partial<EnrichedDivePlanExtension>)=>void;changeWeather:(field:PlanWeatherField,value:number|string|null)=>void}){
 const c=draft.conditions;
 const tag=(field:PlanWeatherField)=>{const reading=c?.weatherFieldSources?.[field];return reading?<small className={styles.source} title={`${reading.label} · ${reading.classification} · ${reading.validAt??reading.observedAt??'Source time not supplied'} · retrieved ${reading.retrievedAt}`}>Weather{field==='waterTemperatureC'?` · ${depthLabel(reading.depth)}`:''}{field==='currentStrength'?' · m/s':''}</small>:null;};
 return <div className={styles.fields}>
  <h3>Water conditions</h3>
  <label>Water temperature (°C)<input type="number" step="0.1" value={c?.waterTemperatureC??''} onChange={e=>changeWeather('waterTemperatureC',e.target.value?Number(e.target.value):null)}/>{tag('waterTemperatureC')}</label>
  <label>Visibility (m)<input type="number" min="0" step="0.1" value={c?.visibilityM??''} onChange={e=>changeWeather('visibilityM',e.target.value?Number(e.target.value):null)}/>{tag('visibilityM')}</label>
  <label>Minimum visibility (m)<input type="number" min="0" step="0.1" value={draft.minimumVisibilityM??''} onChange={e=>change({minimumVisibilityM:e.target.value?Number(e.target.value):null})}/><small>Your planning limit</small></label>
  <label>Current<input value={c?.currentStrength??''} onChange={e=>changeWeather('currentStrength',e.target.value)}/>{tag('currentStrength')}</label>
  <label className={styles.wide}>Unacceptable current<input value={draft.unacceptableCurrent??''} onChange={e=>change({unacceptableCurrent:e.target.value})}/><small>Your planning limit</small></label>
  <h3>Surface conditions</h3>
  <label>Wave height (m)<input type="number" min="0" step="0.1" value={c?.waveHeightM??''} onChange={e=>changeWeather('waveHeightM',e.target.value?Number(e.target.value):null)}/>{tag('waveHeightM')}</label>
  <label>Maximum waves (m)<input type="number" min="0" step="0.1" value={draft.maximumWaveHeightM??''} onChange={e=>change({maximumWaveHeightM:e.target.value?Number(e.target.value):null})}/><small>Your planning limit</small></label>
  <label>Swell (m)<input type="number" min="0" step="0.1" value={c?.swellHeightM??''} onChange={e=>changeWeather('swellHeightM',e.target.value?Number(e.target.value):null)}/>{tag('swellHeightM')}</label>
  <label>Maximum swell (m)<input type="number" min="0" step="0.1" value={draft.maximumSwellHeightM??''} onChange={e=>change({maximumSwellHeightM:e.target.value?Number(e.target.value):null})}/><small>Your planning limit</small></label>
  <h3>Access & logistics</h3>
  <label><input type="checkbox" checked={Boolean(draft.permitRequired)} onChange={e=>change({permitRequired:e.target.checked})}/> Access permit required</label>
  <label><input type="checkbox" checked={Boolean(draft.permitConfirmed)} onChange={e=>change({permitConfirmed:e.target.checked})}/> Permit confirmed</label>
  <label>Entry cost<input value={draft.entryCost??''} onChange={e=>change({entryCost:e.target.value})}/></label>
  <h3>Notes</h3><label className={styles.wide}>Conditions notes<textarea value={c?.notes??''} onChange={e=>change({conditions:{...c,notes:e.target.value}})}/></label>
  <p className={styles.wide}>Get Weather fills empty measurement fields only. Underwater visibility needs an actual underwater source. Planning limits, permits, costs and notes stay under your control. Surface temperature does not establish the temperature at dive depth.</p>
 </div>;
}
