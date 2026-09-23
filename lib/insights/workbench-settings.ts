import {listDashboardSettings,saveDashboardSettings,type DashboardSettingsRecord,type Stored} from '../offline/dive-planning';
import {validateAnalysisCards,type AnalysisCardConfig} from './analysis-card-registry';
export function mergeWorkbenchSettings(current:Stored<DashboardSettingsRecord>|undefined,cards:AnalysisCardConfig[]){
  const errors=validateAnalysisCards(cards);if(errors.length)throw new Error(errors.join(' '));
  return {...(current??{selectedAwards:[],maxAwards:8}),analysisWorkbench:{version:1 as const,cards:structuredClone(cards)}};
}
export async function saveWorkbenchSettings(cards:AnalysisCardConfig[]){
  const settings=(await listDashboardSettings())[0];await saveDashboardSettings(mergeWorkbenchSettings(settings,cards));
}
