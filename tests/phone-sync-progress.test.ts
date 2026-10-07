import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneSyncCard } from '../components/phone/phone-sync-card';
import { phoneReloadRequired, phoneSyncProgress } from '../lib/phone/sync-progress';
import { phoneWorkerMessage } from '../lib/phone/offline-shell';
import { loadPhoneData, phoneDownloadStatus, synchronizePhoneRecords } from '../lib/phone/phone-data';
import { configureDiveStore, pendingDiveChanges, saveLocalRecord } from '../lib/offline/dive-store';
import { zeustekDb } from '../lib/offline/db';

const account = 'phone-sync-fixture';
beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: true });
  configureDiveStore(account, 'manual');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function cloud(failKind?: string) {
  const downloads: string[] = [];
  const records: Record<string, unknown[]> = {
    person: [{ id: 'known-person', name: 'Known buddy', phone: 'Dummy telephone', role: 'buddy' }],
    operator: [{ id: 'known-centre', name: 'Known Centre', operatorType: 'dive-centre', phone: 'Dummy centre telephone', bookingNotes: 'Complete contact details' }],
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/household') return Response.json({ current: { userId: account } });
    if (url === '/api/dive-data' && options?.method === 'POST') return Response.json({ error: 'Review required' }, { status: 409 });
    const kind = new URL(url, 'https://fixture.invalid').searchParams.get('kind');
    if (kind) downloads.push(kind);
    if (kind === failKind) return new Response('Unavailable', { status: 503 });
    return Response.json({ items: records[kind || ''] || [] });
  }));
  return downloads;
}
it('downloads full known contacts first and reports completed groups before marking the download complete', async () => {
  const downloads = cloud();
  const progress: Array<{ completed: number; total: number }> = [];
  await synchronizePhoneRecords((_label, completed, total) => progress.push({ completed, total }));
  expect(downloads.slice(0, 2)).toEqual(['person', 'operator']);
  const data = await loadPhoneData();
  expect(data.people[0]).toMatchObject({ entityId: 'known-person', name: 'Known buddy', phone: 'Dummy telephone' });
  expect(data.operators[0]).toMatchObject({ entityId: 'known-centre', bookingNotes: 'Complete contact details' });
  expect(progress.at(-1)).toEqual({ completed: 21, total: 21 });
  expect(progress.every((item, index) => index === 0 || item.completed >= progress[index - 1]!.completed)).toBe(true);
  expect((await phoneDownloadStatus(account))?.downloadedAt).toBeTruthy();
});
it('still downloads known contacts and other available groups when an unrelated group fails, retaining the pending Dive', async () => {
  await saveLocalRecord('dive', { entityId: 'pending-dive', site: 'Dummy site', notes: 'Retain this unsent Dive' });
  const downloads = cloud('site');
  await expect(synchronizePhoneRecords()).rejects.toThrow(/Download incomplete/);
  expect(downloads).toHaveLength(21);
  const data = await loadPhoneData();
  expect(data.people).toHaveLength(1);
  expect(data.operators).toHaveLength(1);
  expect(data.dives.find(item => item.entityId === 'pending-dive')).toMatchObject({ notes: 'Retain this unsent Dive' });
  expect(await pendingDiveChanges()).toHaveLength(1);
  expect(await phoneDownloadStatus(account)).toBeUndefined();
});
it('uses one retry action for a failed sync, with no contradictory second editing banner', () => {
  const html = renderToStaticMarkup(createElement(PhoneSyncCard, { online: true, busy: false, ready: false, pauseEdits: true, error: 'Connection interrupted; records retained.', message: 'Old preparation message', progress: null, people: 3, centres: 2, onSync: () => {} }));
  expect(html.match(/<button/g)).toHaveLength(1);
  expect(html).toContain('Retry sync &amp; download');
  expect(html).not.toContain('Old preparation message');
  expect(html).not.toContain('Sync before editing');
  expect(html).toContain('3 People · 2 Dive Centres');
});
it('shows an accessible measured progress bar instead of another sync button while busy', () => {
  const html = renderToStaticMarkup(createElement(PhoneSyncCard, { online: true, busy: true, ready: false, pauseEdits: true, error: 'Old error', message: '', progress: { percent: 67, label: 'Preparing offline app: 22 of 50 files saved…' }, people: 3, centres: 2, onSync: () => {} }));
  expect(html).toContain('<progress aria-label="Phone download progress" max="100" value="67"');
  expect(html).toContain('67%');
  expect(html).not.toContain('<button');
  expect(html).not.toContain('Old error');
});
it('never reports 100% until records and the app are confirmed complete, and reloads a newer app at most once', () => {
  const percentages = [phoneSyncProgress('records', 0, 21), phoneSyncProgress('records', 21, 21), phoneSyncProgress('install', 20, 50), phoneSyncProgress('install', 50, 50), phoneSyncProgress('shell', 2, 2), phoneSyncProgress('complete')].map(item => item.percent);
  expect(percentages).toEqual([0, 45, 65, 95, 99, 100]);
  expect(phoneReloadRequired('1', '2')).toBe(true);
  expect(phoneReloadRequired('1', '2', '2')).toBe(false);
  expect(phoneReloadRequired('2', '2')).toBe(false);
  expect(phoneReloadRequired('1')).toBe(false);
});

/** A deterministic MessageChannel model, not a timer-based fake percentage. */
function workerFixture() {
  class Channel {
    port1 = { onmessage: null as ((event: { data: unknown }) => void) | null, close: () => {} };
    port2 = { postMessage: (data: unknown) => queueMicrotask(() => this.port1.onmessage?.({ data })) };
  }
  vi.stubGlobal('MessageChannel', Channel);
  let completed = 0;
  const worker = {
    state: 'installing',
    postMessage: ({ type }: { type: string }, ports?: Array<{ postMessage: (data: unknown) => void }>) => {
      if (type === 'PHONE_INSTALL_PROGRESS') ports?.[0]?.postMessage({ stage: 'install', completed, total: 50 });
      if (type === 'PREPARE_PHONE_OFFLINE') {
        ports?.[0]?.postMessage({ stage: 'shell', completed: 1, total: 2 });
        ports?.[0]?.postMessage({ ready: true, appVersion: 'fixture-2' });
      }
    },
  };
  const registration = { installing: worker as typeof worker | null, waiting: null, active: null as typeof worker | null, update: vi.fn() };
  vi.stubGlobal('navigator', { onLine: true, serviceWorker: { getRegistration: async () => registration, register: vi.fn(), get ready() { throw new Error('Must not wait for ready before reporting progress'); } } });
  return { registration, worker, advance: () => { completed++; }, activate: () => { registration.installing = null; registration.active = worker; worker.state = 'activated'; } };
}
it('waits through a slow first installation past the old 20-second limit while reporting real app file counts', async () => {
  vi.useFakeTimers();
  const fixture = workerFixture();
  const progress = vi.fn(), versions = vi.fn();
  const result = phoneWorkerMessage('PREPARE_PHONE_OFFLINE', { onProgress: progress, onVersion: versions });
  for (let second = 0; second < 26; second++) { fixture.advance(); await vi.advanceTimersByTimeAsync(1000); }
  fixture.activate();
  await vi.advanceTimersByTimeAsync(1000);
  expect(await result).toBe(true);
  expect(progress).toHaveBeenCalledWith({ stage: 'install', completed: 22, total: 50 });
  expect(progress).toHaveBeenCalledWith({ stage: 'shell', completed: 1, total: 2 });
  expect(versions).toHaveBeenCalledWith('fixture-2');
  expect(vi.getTimerCount()).toBe(0);
});
it('returns an unavailable initial status immediately while installation continues', async () => {
  workerFixture();
  expect(await phoneWorkerMessage('PHONE_OFFLINE_STATUS')).toBe(false);
});
