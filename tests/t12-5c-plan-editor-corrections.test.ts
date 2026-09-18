import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ownerConditionMode, planWeatherMode, plannedWeatherSnapshot, planningWeatherRegime, weatherFailureFallback } from '../lib/plan-weather';

vi.mock('../app/chatgpt-auth', () => ({ getChatGPTUser: async () => ({ id: 'test' }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('T12.5C Plan editor corrections', () => {
  it('uses the seven-day API horizon and keeps seasonal context distinct from forecasts', () => {
    expect(planningWeatherRegime('2026-09-17', '2026-09-17')).toBe('forecast');
    expect(planningWeatherRegime('2026-09-23', '2026-09-17')).toBe('forecast');
    expect(planningWeatherRegime('2026-09-24', '2026-09-17')).toBe('seasonal');
    expect(planningWeatherRegime('2026-09-16', '2026-09-17')).toBe('past');
    expect(planningWeatherRegime('not-a-date', '2026-09-17')).toBe('invalid');
    const snapshot = plannedWeatherSnapshot({ provider: 'Open-Meteo archive', resolution: 'regional', logConditions: { weatherSummary: 'Historical reference', airTemperatureC: 14, waveHeightM: 3, surfaceTemperatureC: 11 } }, 'seasonal', 'site-one', '2026-10-01', '2026-09-17T12:00:00Z');
    expect(snapshot).toMatchObject({ provenance: 'seasonal', sourceSiteId: 'site-one', sourceDate: '2026-10-01', weather: 'Historical reference', airTemperatureC: 14, waterTemperatureC: null, waveHeightM: null, visibilityM: null });
    expect(() => plannedWeatherSnapshot({}, 'forecast', 'site-one', '2026-09-20', 'now')).toThrow('No usable weather data');
  });
  it('exposes Site facts, search-first team/skills, and preserves typed spaces until save', () => {
    const source = readFileSync(resolve(process.cwd(), 'components/dive-planning-centre.tsx'), 'utf8');
    const css = readFileSync(resolve(process.cwd(), 'components/dive-planning-centre.module.css'), 'utf8');
    expect(source).toContain('Canonical Site facts');
    expect(source).toContain('Site maximum depth');
    expect(source).toContain('Water type');
    expect(source).toContain('Matching People');
    expect(source).toContain('Selected Dive team');
    expect(source).toContain('Matching Dive Skills');
    expect(source).toContain('Selected planned Skills');
    expect(source).not.toContain('e.target.value.split(\'\\n\').map(value=>value.trim()).filter(Boolean)');
    expect(css).toContain('.editorGrid label>.infoButton');
    expect(css).toContain('justify-self:start');
  });
  it('keeps weather optional, preserves owner entries, and labels failed forecasts as unavailable', () => {
    const manual = { provenance: 'recorded' as const, weather: 'Cloudy', notes: 'Check at harbour' };
    expect(planWeatherMode()).toBe('unavailable');
    expect(planWeatherMode(manual)).toBe('manual');
    expect(ownerConditionMode(manual, 'seasonal')).toMatchObject({ provenance: 'seasonal', weather: 'Cloudy', notes: 'Check at harbour' });
    expect(weatherFailureFallback(manual, true)).toMatchObject({ provenance: 'recorded', weather: 'Cloudy', notes: 'Check at harbour', weatherAvailability: 'rate-limited' });
    expect(ownerConditionMode({ provenance: 'forecast', weather: 'Sunny', waveHeightM: 2 }, 'seasonal')).toMatchObject({ provenance: 'seasonal', weather: null, waveHeightM: null });
    expect(weatherFailureFallback(undefined, true)).toMatchObject({ provenance: 'unavailable', weatherAvailability: 'rate-limited' });
    const source = readFileSync(resolve(process.cwd(), 'components/dive-planning-centre.tsx'), 'utf8');
    expect(source).toContain("onClick={()=>void getWeather()}");
    expect(source).toContain('use manual or seasonal conditions. Existing entries retained.');
    expect(source).toContain("role={weatherError?'alert':'status'}");
    expect(source).toContain("<option value=\"seasonal\">Seasonal / typical conditions (owner-entered)</option>");
  });
  it('returns dated regional seasonal observations without inventing dive-day marine values', async () => {
    const daily = { temperature_2m_mean: Array(15).fill(12), precipitation_sum: Array(15).fill(0) };
    const fetcher = vi.fn(async () => Response.json({ daily }));
    vi.stubGlobal('fetch', fetcher);
    const { GET } = await import('../app/api/site-weather/route');
    const response = await GET(new Request('https://example.test/api/site-weather?latitude=51&longitude=-2&date=2030-08-12&planning=seasonal'));
    expect(response.status).toBe(200);
    const value = await response.json() as { resolution: string; logConditions: Record<string, unknown> };
    expect(value.resolution).toBe('regional seasonal reference');
    expect(value.logConditions.weatherSummary).toContain('Not a dive-day forecast');
    expect(value.logConditions).not.toHaveProperty('waveHeightM');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('does not let a forecast rate limit block the separate historical archive', async () => {
    vi.resetModules();
    const daily = { temperature_2m_mean: Array(15).fill(12), precipitation_sum: Array(15).fill(0) };
    const href = (input: RequestInfo | URL) => typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => href(input).includes('archive-api.open-meteo.com')
      ? Response.json({ daily })
      : new Response('', { status: 429, headers: { 'retry-after': '60' } }));
    vi.stubGlobal('fetch', fetcher);
    const { GET } = await import('../app/api/site-weather/route');
    expect((await GET(new Request('https://example.test/api/site-weather?points=51,-2'))).status).toBe(502);
    const seasonal = await GET(new Request('https://example.test/api/site-weather?latitude=51&longitude=-2&date=2030-08-12&planning=seasonal'));
    expect(seasonal.status).toBe(200);
    expect(fetcher.mock.calls.some(([url]) => href(url).includes('archive-api.open-meteo.com'))).toBe(true);
  });
});
