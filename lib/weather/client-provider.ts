import {
  type WeatherProviderAdapter,
  type WeatherProviderId,
  type WeatherRequest,
} from './provider-contract';
import type { PlannedWeatherResponse } from '../plan-weather';
import { fetchConditions } from './conditions-client';
import { selectConditions, type ConditionsRequest } from './conditions-model';
import { currentDiveAccount } from '../offline/dive-store';
/** The provider adapter calls the authenticated server boundary; it never receives credentials. */
export function weatherProvider(id: WeatherProviderId): WeatherProviderAdapter {
  return {
    id,
    async forecast(request: WeatherRequest, signal?: AbortSignal) {
      if (request.latitude == null || request.longitude == null)
        throw new Error('Site coordinates are required.');
      const input: ConditionsRequest = {
        latitude: request.latitude,
        longitude: request.longitude,
        siteId: request.siteId,
        siteName: request.siteName ?? '',
        siteType: request.siteType ?? (request.marine ? 'coastal' : 'inland'),
        provider: id,
        date: request.date,
        time: request.time,
        mode:
          request.mode === 'seasonal'
            ? 'seasonal'
            : request.mode === 'historical'
              ? 'historical'
              : 'forecast',
        marine: Boolean(request.marine),
        ...(request.plannedDepthM !== undefined
          ? { plannedDepthM: request.plannedDepthM }
          : {}),
        ...(request.disabledProviders
          ? { disabledProviders: request.disabledProviders }
          : {}),
      };
      const conditions = await fetchConditions(
        currentDiveAccount(),
        input,
        signal,
      );
      const selected = selectConditions(
        conditions.readings,
        conditions.request,
        new Date().toISOString(),
      );
      const air = selected.find((row) => row.metric === 'air-temperature');
      const weather = selected.find((row) => row.metric === 'weather');
      const wave = selected.find((row) => row.metric === 'wave-height');
      const surface = selected.find(
        (row) =>
          row.metric === 'water-temperature' && row.depth.kind === 'surface',
      );
      const primary = air ?? weather ?? surface;
      const data: PlannedWeatherResponse = {
        conditionsV1: conditions,
        providerId: id,
        provider: primary?.label ?? 'ZeusTek Conditions',
        resolution: primary?.resolution ?? 'source-specific',
        sourceCoordinates: {
          latitude: primary?.latitude ?? request.latitude,
          longitude: primary?.longitude ?? request.longitude,
        },
        ...(primary?.validAt || primary?.observedAt
          ? { sourceTime: primary.validAt ?? primary.observedAt! }
          : {}),
        attribution: [
          ...new Set(selected.map((row) => row.attribution).filter(Boolean)),
        ].join(' · '),
        logConditions: {
          weatherSummary:
            typeof weather?.value === 'string'
              ? weather.value
              : air
                ? 'Atmospheric forecast'
                : surface
                  ? 'Water conditions'
                  : 'Conditions retrieved',
          airTemperatureC: typeof air?.value === 'number' ? air.value : null,
          waveHeightM: typeof wave?.value === 'number' ? wave.value : null,
          surfaceTemperatureC:
            typeof surface?.value === 'number' ? surface.value : null,
        },
      };
      return data;
    },
  };
}
