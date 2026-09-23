import {
  listDashboardSettings,
  saveDashboardSettings,
  type DashboardSettingsRecord,
  type Stored,
} from '../offline/dive-planning';
import type {
  ConditionsProvider,
  ConditionsSelection,
} from './conditions-model';
export interface WeatherConditionsSettings {
  version: 1;
  defaultProvider: ConditionsSelection;
  disabledProviders: ConditionsProvider[];
  includeSiteReferences: boolean;
}
export const DEFAULT_CONDITIONS_SETTINGS: WeatherConditionsSettings = {
  version: 1,
  defaultProvider: 'open-meteo',
  disabledProviders: [],
  includeSiteReferences: false,
};
export function mergeConditionsSettings(
  current: Stored<DashboardSettingsRecord> | undefined,
  value: WeatherConditionsSettings,
) {
  return {
    ...(current ?? { selectedAwards: [], maxAwards: 8 }),
    weatherConditions: {
      ...value,
      version: 1 as const,
      defaultProvider: value.disabledProviders.includes(
        value.defaultProvider as ConditionsProvider,
      )
        ? ('open-meteo' as const)
        : value.defaultProvider,
      disabledProviders: [...new Set(value.disabledProviders)].filter(
        (id) => id !== 'open-meteo',
      ),
    },
  };
}
export async function readConditionsSettings() {
  const current = (await listDashboardSettings())[0];
  return current?.weatherConditions?.version === 1
    ? current.weatherConditions
    : DEFAULT_CONDITIONS_SETTINGS;
}
export async function saveConditionsSettings(value: WeatherConditionsSettings) {
  const current = (await listDashboardSettings())[0];
  return saveDashboardSettings(mergeConditionsSettings(current, value));
}
