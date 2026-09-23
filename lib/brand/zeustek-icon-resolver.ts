import {findZeusTekIcon,normaliseZeusTekIconKey} from './zeustek-icon-registry';
import {ZEUSTEK_COMPLETE_ICONS} from './zeustek-complete-icon-registry.generated';

export const ZEUSTEK_SEMANTIC_ICON_MAP:Record<string,string>={
  overview:'profile-graph',insights:'profile-graph',logbook:'dive-log-entry','dive-computer-imports':'imported-log',
  sites:'dive-site-marker','dive-location-map':'map-site-sketch',people:'buddy-pair','dive-centres':'dive-centre-operator',
  calendar:'travel-planning',trips:'travel-planning','bucket-list':'travel-planning','dive-planning':'dive-plan-slate',
  'gas-planning':'gas-plan',equipment:'equipment',cylinders:'steel-cylinder',certifications:'certification-card',
  'dive-skills':'dive-skills-training','technical-diving':'decompression-plan',weather:'weather',
  emergency:'emergency-action-plan','buddy-team':'buddy-pair',operator:'dive-centre-operator',
};
const complete=new Map<string,(typeof ZEUSTEK_COMPLETE_ICONS)[number]>(ZEUSTEK_COMPLETE_ICONS.map(icon=>[icon.key,icon]));
export function resolveZeusTekIcon(value:string|null|undefined){
  if(!value)return null;
  const curated=findZeusTekIcon(value);if(curated)return curated;
  const key=normaliseZeusTekIconKey(value.replace(/\.png$/i,''));
  return complete.get(ZEUSTEK_SEMANTIC_ICON_MAP[key]??key)??null;
}
