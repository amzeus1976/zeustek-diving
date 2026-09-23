import {retainPartialConditions} from './conditions-retention';
import {
  conditionsCacheKey,
  readConditionsCache,
  saveConditionsCache,
} from './conditions-cache';
import type { ConditionsRequest, ConditionsSnapshot } from './conditions-model';
/** Explicit refresh only. Consumers own request cancellation and recheck identity before displaying a result. */
export async function fetchConditions(
  account: string,
  request: ConditionsRequest,
  signal?: AbortSignal,
  enrichment = false,
): Promise<ConditionsSnapshot> {
  const params = new URLSearchParams({
    latitude: String(request.latitude),
    longitude: String(request.longitude),
    siteId: request.siteId,
    siteName: request.siteName,
    siteType: request.siteType,
    provider: request.provider,
    date: request.date,
    time: request.time,
    mode: request.mode,
    marine: String(request.marine),
  });
  if (request.operatorId) params.set('operatorId', request.operatorId);
  if (request.plannedDepthM !== undefined)
    params.set('depth', String(request.plannedDepthM));
  if (request.disabledProviders?.length)
    params.set('disabled', request.disabledProviders.join(','));
  if (enrichment) params.set('enrichment', 'true');
  try {
    const response = await fetch(`/api/conditions?${params}`, {
      cache: 'no-store',
      ...(signal ? { signal } : {}),
    });
    const data = (await response.json()) as ConditionsSnapshot & {
      error?: string;
    };
    if (!response.ok || data.version !== 1 || !Array.isArray(data.readings))
      throw new Error(data.error ?? 'Conditions could not be refreshed.');
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!data.readings.length)
      throw new Error(
        data.diagnostics.map((row) => row.message).join(' ') ||
          'No conditions were returned.',
      );
    const previous=await readConditionsCache(account,request).catch(()=>null);
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    const retained=retainPartialConditions(data,previous);
    await saveConditionsCache(account, retained).catch(() => {});
    return retained;
  } catch (error) {
    if (signal?.aborted) throw error;
    const cached = await readConditionsCache(account, request).catch(
      () => null,
    );
    if (cached)
      return {
        ...cached,
        offline: true,
        diagnostics: [
          ...cached.diagnostics,
          {
            provider: 'cache',
            status: 'unavailable',
            message:
              'Refresh unavailable. Showing the last successful local snapshot with its original timestamps.',
            retrievedAt: new Date().toISOString(),
          },
        ],
      };
    throw error;
  }
}
export { conditionsCacheKey };
