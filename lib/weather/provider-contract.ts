import type { PlannedWeatherResponse } from '../plan-weather';
export type WeatherProviderId =
  | 'open-meteo'
  | 'met-office'
  | 'auto'
  | 'xweather'
  | 'tomorrow'
  | 'wwo'
  | 'met-norway'
  | 'copernicus'
  | 'swellcloud';
export interface WeatherRequest {
  mode: string;
  provider: string;
  siteId: string;
  date: string;
  time: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  marine?: boolean;
  siteName?: string;
  siteType?: 'inland' | 'coastal' | 'unknown';
  plannedDepthM?: number | undefined;
  disabledProviders?: import('./conditions-model').ConditionsProvider[];
}
export interface WeatherProviderStatus {
  id: WeatherProviderId;
  label: string;
  enabled: boolean;
  reason?: string;
  configured?: boolean;
  status?: string;
  lastCheckedAt?: string;
}
export interface WeatherProviderAdapter {
  id: WeatherProviderId;
  forecast(
    request: WeatherRequest,
    signal?: AbortSignal,
  ): Promise<PlannedWeatherResponse>;
}
export const DEFAULT_WEATHER_PROVIDER: WeatherProviderId = 'open-meteo';
export function weatherRequestIdentity(request: WeatherRequest) {
  return JSON.stringify([
    request.mode,
    request.provider,
    request.siteId,
    request.date,
    request.time,
    request.latitude,
    request.longitude,
    Boolean(request.marine),
    request.siteName ?? '',
    request.siteType ?? '',
    request.plannedDepthM ?? null,
    request.disabledProviders ?? [],
  ]);
}
/** Transport abort and identity are both required: an ignored abort cannot overwrite newer input. */
export class LatestWeatherRequest {
  private active: { key: string; controller: AbortController } | null = null;
  begin(key: string) {
    this.invalidate();
    const controller = new AbortController();
    this.active = { key, controller };
    return { key, signal: controller.signal };
  }
  accepts(request: { key: string; signal: AbortSignal }, currentKey: string) {
    return (
      !request.signal.aborted &&
      this.active?.controller.signal === request.signal &&
      request.key === currentKey
    );
  }
  invalidate() {
    this.active?.controller.abort();
    this.active = null;
  }
}
