import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {fetchConditions} from '../lib/weather/conditions-client';
import {
  readConditionsCache,
  saveConditionsCache,
  conditionsCacheDb,
  conditionsCacheKey,
  readOperatorHistory,
} from '../lib/weather/conditions-cache';
import {retainPartialConditions} from '../lib/weather/conditions-retention';
import {
  conditionReading,
  type ConditionsSnapshot,
} from '../lib/weather/conditions-model';
const reading = conditionReading('water-temperature', 18, '°C', {
  provider: 'operator',
  label: 'Operator',
  kind: 'operator',
  classification: 'observed',
  url: 'https://example.com/',
  resolution: 'site observation',
  latitude: 54,
  longitude: -2,
  retrievedAt: '2026-09-23T12:00:00Z',
  observedAt: null,
})!;
const snapshot: ConditionsSnapshot = {
  version: 1,
  request: {
    latitude: 54,
    longitude: -2,
    siteId: 'a',
    siteName: 'Quarry',
    siteType: 'inland',
    provider: 'open-meteo',
    date: '2026-09-23',
    time: '12:00',
    mode: 'forecast',
    marine: false,
  },
  retrievedAt: '2026-09-23T12:00:00Z',
  readings: [reading],
  diagnostics: [],
};
afterEach(async () => {
  vi.unstubAllGlobals();
  await conditionsCacheDb.snapshots.clear();
  await conditionsCacheDb.history.clear();
});
describe('T14 last successful conditions cache', () => {
  it('returns the successful local snapshot offline but never substitutes it for an aborted request',async()=>{
    await saveConditionsCache('owner',snapshot);
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('Offline');}));
    const result=await fetchConditions('owner',snapshot.request);
    expect(result.offline).toBe(true);expect(result.readings).toEqual(snapshot.readings);expect(result.retrievedAt).toBe(snapshot.retrievedAt);
    const controller=new AbortController();controller.abort();
    await expect(fetchConditions('owner',snapshot.request,controller.signal)).rejects.toThrow();
  });
  it('retains earlier successful metrics after a partial failure with original timestamps, but never across different requests',()=>{
    const partial:ConditionsSnapshot={...snapshot,readings:[],diagnostics:[{provider:'operator',status:'unavailable',message:'Unavailable',retrievedAt:'2026-09-24T12:00:00Z'}]};
    expect(retainPartialConditions(partial,snapshot).readings[0]?.retrievedAt).toBe(reading.retrievedAt);
    expect(retainPartialConditions({...partial,request:{...partial.request,siteId:'other'}},snapshot).readings).toEqual([]);
    expect(retainPartialConditions({...partial,diagnostics:[]},snapshot).readings).toEqual([]);
  });
  it('partitions by account and input identity, retains the last success after empty failures', async () => {
    await saveConditionsCache('owner', snapshot);
    await saveConditionsCache('owner', {
      ...snapshot,
      readings: [],
      diagnostics: [
        {
          provider: 'open-meteo',
          status: 'unavailable',
          message: 'Unavailable',
          retrievedAt: snapshot.retrievedAt,
        },
      ],
    });
    expect(
      (await readConditionsCache('owner', snapshot.request))?.readings[0]
        ?.value,
    ).toBe(18);
    expect(await readConditionsCache('other', snapshot.request)).toBeNull();
    expect(conditionsCacheKey(snapshot.request)).not.toBe(
      conditionsCacheKey({ ...snapshot.request, siteId: 'b' }),
    );
    expect(conditionsCacheKey(snapshot.request)).not.toBe(
      conditionsCacheKey({ ...snapshot.request, provider: 'auto' }),
    );
  });
  it('deduplicates operator history, preserves observation time absence and excludes actual Dive records', async () => {
    await saveConditionsCache('owner', snapshot);
    await saveConditionsCache('owner', snapshot);
    await saveConditionsCache('owner', {
      ...snapshot,
      readings: [
        {
          ...reading,
          id: 'private-dive',
          provider: 'zeustek',
          kind: 'dive',
          sourceRecordId: 'd1',
        },
      ],
    });
    const history = await readOperatorHistory('owner', 'a');
    expect(history).toHaveLength(1);
    expect(history[0]?.observedAt).toBeNull();
    expect(history[0]?.sourceRecordId).toBeUndefined();
  });
});
