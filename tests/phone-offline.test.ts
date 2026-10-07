import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import {
  configureDiveStore,
  saveLocalRecord,
  listLocalDiveRecords,
  pendingDiveChanges,
  flushDiveChanges,
} from '../lib/offline/dive-store';
import {
  savePhoneDraft,
  readPhoneDraft,
  commitPhoneDraft,
  reviewPhoneDraft,
  applyPhoneDraftReview,
  listPhoneDraftReviews,
  mergePhoneDraft,
  type PhoneDraft,
} from '../lib/phone/phone-drafts';
import {
  withRecordNetwork,
  recordNetworkAllowed,
  configureRecordNetwork,
} from '../lib/phone/network-policy';
import {
  rememberPhoneAccount,
  readPhoneAccount,
} from '../lib/phone/offline-access';
import {
  basicGasInput,
  preparePhoneRecord,
  phoneGasInput,
  updatePhoneTeam,
  updatePhoneSchedule,
} from '../lib/phone/planning';
import { buildRecreationalGasSnapshot } from '../lib/offline/recreational-gas-planner';
import { choosePhoneInterface } from '../lib/phone/interface-mode';
import {
  preparePhoneShell,
  phoneNavigation,
  clearPhoneOfflineIdentity,
  PHONE_SHELL_CACHE,
  PHONE_SHELL_PATH,
  PHONE_RSC_PATH,
  PHONE_ENTRY_PATH,
} from '../lib/phone/worker-access';
import {
  synchronizePhoneRecords,
  phoneDownloadStatus,
} from '../lib/phone/phone-data';

const account = 'phone-fixture';
it('keeps day-plan dates and times together while retaining multi-day ends', () => {
  const plan = {
    startDate: '2026-10-10',
    endDate: '2026-10-10',
    startAt: '2026-10-10T09:00',
  };
  expect(updatePhoneSchedule(plan, 'startDate', '2026-10-11')).toEqual({
    startDate: '2026-10-11',
    startAt: '2026-10-11T09:00',
    endDate: '2026-10-11',
  });
  expect(updatePhoneSchedule(plan, 'startAt', '2026-10-12T11:30')).toEqual({
    startAt: '2026-10-12T11:30',
    startDate: '2026-10-12',
    endDate: '2026-10-12',
  });
  expect(
    updatePhoneSchedule(
      { ...plan, endDate: '2026-10-20' },
      'startDate',
      '2026-10-11',
    ),
  ).toEqual({
    startDate: '2026-10-11',
    startAt: '2026-10-11T09:00',
  });
});
const newDraft = (
  kind: PhoneDraft['kind'],
  record: PhoneDraft['record'],
): PhoneDraft => ({
  id: crypto.randomUUID(),
  account,
  kind,
  record,
  baseModifiedAt: null,
  savedAt: new Date().toISOString(),
});
beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  configureDiveStore(account, 'manual');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});
afterEach(() => vi.unstubAllGlobals());
describe('phone canonical records and durable drafts', () => {
  it('creates a new offline Person before linking its stable ID to an offline Dive, without uploading or renumbering another Dive', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    const person = newDraft('person', {
      name: 'Dummy buddy',
      role: 'buddy',
      email: 'dummy@fixture.invalid',
      phone: '+440000000000',
      notes: 'Private details',
    });
    await savePhoneDraft(person);
    await commitPhoneDraft(person);
    await saveLocalRecord('dive', {
      entityId: 'existing',
      site: 'Existing',
      date: '2026-10-07',
      diveNumber: 67,
      source: 'manual',
    });
    const dive = newDraft('dive', {
      site: 'Dummy site',
      date: '2026-10-07',
      source: 'manual',
      maxDepthM: 12,
      bottomTimeMin: 25,
      buddyIds: [person.id],
    });
    await savePhoneDraft(dive);
    const recovered = await readPhoneDraft(dive.id);
    expect(recovered).toEqual(dive);
    await commitPhoneDraft(recovered!);
    const logs = await listLocalDiveRecords<Record<string, unknown>>('dive');
    expect(logs.find((item) => item.entityId === dive.id)?.buddyIds).toEqual([
      person.id,
    ]);
    expect(logs.find((item) => item.entityId === 'existing')?.diveNumber).toBe(
      67,
    );
    expect(await readPhoneDraft(dive.id)).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
    expect(await pendingDiveChanges()).toHaveLength(3);
  });
  it('updates a plan with its original identity and all hidden planning details, resetting readiness after editing', async () => {
    await saveLocalRecord('trip', {
      entityId: 'plan',
      name: 'Dummy plan',
      startDate: '2026-10-07',
      siteName: 'Dummy',
      emergency: { evacuation: 'Full saved instructions' },
      goals: ['Goal'],
      plannedMaxDepthM: 12,
      status: 'confirmed',
      lifecycleStatus: 'ready',
    });
    const [source] =
      await listLocalDiveRecords<
        Record<string, import('../lib/offline/types').JsonValue>
      >('trip');
    const draft = {
      ...newDraft('trip', { ...source!, name: 'Updated' }),
      entityId: 'plan',
      baseModifiedAt: source!.modifiedAt as string,
    };
    await savePhoneDraft(draft);
    await commitPhoneDraft(draft);
    const plans = await listLocalDiveRecords<Record<string, unknown>>('trip');
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      entityId: 'plan',
      name: 'Updated',
      emergency: { evacuation: 'Full saved instructions' },
      goals: ['Goal'],
      lifecycleStatus: 'draft',
    });
  });
  it('retains both the newer saved record and the draft on a changed or deleted local revision', async () => {
    await saveLocalRecord('person', { entityId: 'person', name: 'Original' });
    const [source] =
      await listLocalDiveRecords<
        Record<string, import('../lib/offline/types').JsonValue>
      >('person');
    const draft = {
      ...newDraft('person', { ...source!, name: 'Draft name' }),
      entityId: 'person',
      baseModifiedAt: source!.modifiedAt as string,
    };
    await savePhoneDraft(draft);
    await zeustekDb.entities.update(`dive:${account}:person`, {
      record: { ...source!, name: 'Newer name', modifiedAt: 'newer-revision' },
    });
    await expect(commitPhoneDraft(draft)).rejects.toThrow(/changed/);
    expect(await readPhoneDraft(draft.id)).toEqual(draft);
    expect(
      (await listLocalDiveRecords<Record<string, unknown>>('person'))[0]?.name,
    ).toBe('Newer name');
    await zeustekDb.entities.update(`dive:${account}:person`, { deleted: 1 });
    await expect(commitPhoneDraft(draft)).rejects.toThrow(/changed/);
    expect(await readPhoneDraft(draft.id)).toEqual(draft);
  });
  it('does not save an old account’s draft into a newly selected account', async () => {
    const draft = newDraft('person', { name: 'Private original account' });
    await savePhoneDraft(draft);
    configureDiveStore('other-owner', 'manual');
    await expect(savePhoneDraft(draft)).rejects.toThrow(/account changed/);
    await expect(commitPhoneDraft(draft)).rejects.toThrow(/account changed/);
    expect(await listLocalDiveRecords('person')).toHaveLength(0);
    configureDiveStore(account, 'manual');
    expect(await readPhoneDraft(draft.id)).toEqual(draft);
  });
  it('does not upload phone changes when another full-interface window attempts an automatic flush', async () => {
    await saveLocalRecord('person', {
      entityId: 'person',
      name: 'Offline buddy',
    });
    vi.stubGlobal('navigator', { onLine: true });
    const request = vi.fn(async (_url: string) =>
      Response.json({ uploaded: 0 }),
    );
    vi.stubGlobal('fetch', request);
    configureDiveStore(account, 'automatic');
    await flushDiveChanges();
    expect((await pendingDiveChanges())[0]?.value).toMatchObject({
      manualSync: true,
    });
    expect(
      request.mock.calls.filter((call) =>
        String(call[0]).includes('/api/dive-data'),
      ),
    ).toHaveLength(0);
  });
  it('uploads new Person, Dive Plan and Gas Plan references in order on explicit sync and preserves IDs on an idempotent retry', async () => {
    const people = newDraft('person', { name: 'New buddy' });
    await commitPhoneDraft(people);
    const plan = newDraft('trip', {
      name: 'Plan',
      startDate: '2026-10-07',
      siteName: 'Dummy',
      personIds: [people.id],
    });
    await commitPhoneDraft(plan);
    const gas = newDraft('gas-plan', {
      name: 'Gas',
      divePlanId: plan.id,
      cylinders: [],
      warnings: [],
      notes: '',
    });
    await commitPhoneDraft(gas);
    vi.stubGlobal('navigator', { onLine: true });
    const received: Array<{ kind: string; id: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options?: RequestInit) => {
        if (url === '/api/dive-data') {
          received.push(JSON.parse(options?.body as string));
          return Response.json({ updatedAt: Date.now() });
        }
        return Response.json({ uploaded: 0 });
      }),
    );
    await withRecordNetwork(account, () => flushDiveChanges(true));
    expect(received.map((row) => row.kind)).toEqual([
      'person',
      'trip',
      'gas-plan',
    ]);
    expect(received.map((row) => row.id)).toEqual([people.id, plan.id, gas.id]);
    expect(await pendingDiveChanges()).toHaveLength(0);
    await withRecordNetwork(account, () => flushDiveChanges(true));
    expect(received).toHaveLength(3);
  });
  it('retains pending versions when explicit sync loses its connection', async () => {
    const draft = newDraft('person', { name: 'Retained buddy' });
    await commitPhoneDraft(draft);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(
      withRecordNetwork(account, () => flushDiveChanges(true)),
    ).rejects.toThrow();
    expect(await pendingDiveChanges()).toHaveLength(1);
    expect(
      (await listLocalDiveRecords<Record<string, unknown>>('person'))[0]
        ?.entityId,
    ).toBe(draft.id);
  });
});
describe('scope and protected gas calculations', () => {
  it('retains existing member roles and seeds legacy gas inputs from saved values', () => {
    expect(
      updatePhoneTeam(
        {
          planTeam: [
            {
              personId: 'instructor',
              role: 'instructor',
              isLeader: true,
              notes: 'Do not drop this',
            },
          ],
        },
        ['instructor', 'owner'],
        ['owner'],
      ),
    ).toEqual([
      {
        personId: 'instructor',
        role: 'instructor',
        isLeader: true,
        notes: 'Do not drop this',
      },
      { personId: 'owner', role: 'self' },
    ]);
    expect(
      phoneGasInput({
        plannedDepthM: 18,
        plannedBottomTimeMin: 22,
        rmvRateLitresMin: 16,
      }),
    ).toMatchObject({
      plannedDepthM: 18,
      plannedWorkingTimeMin: 22,
      ownRmvLMin: 16,
    });
  });
  it('reviews concurrent changes by field, retains latest untouched details and archives both versions before rebasing', async () => {
    await saveLocalRecord('person', {
      entityId: 'review-person',
      name: 'Original',
      phone: '123',
      notes: 'Original notes',
    });
    const [source] = await listLocalDiveRecords<PhoneDraft['record']>('person');
    const draft = {
      ...newDraft('person', { ...source!, name: 'Draft name' }),
      entityId: 'review-person',
      baseRecord: source!,
      baseModifiedAt: source!.modifiedAt as string,
    };
    await savePhoneDraft(draft);
    await zeustekDb.entities.update(`dive:${account}:review-person`, {
      record: {
        ...source!,
        name: 'Cloud name',
        phone: '456',
        modifiedAt: 'new-revision',
      },
    });
    const review = await reviewPhoneDraft(draft);
    expect(review.conflicts).toEqual(['name']);
    expect(review.merged.phone).toBe('456');
    expect(review.merged.name).toBe('Draft name');
    const rebased = await applyPhoneDraftReview(draft, review);
    expect(await listPhoneDraftReviews()).toHaveLength(1);
    await commitPhoneDraft(rebased);
    expect(
      (await listLocalDiveRecords<Record<string, unknown>>('person'))[0],
    ).toMatchObject({ name: 'Draft name', phone: '456' });
    expect(
      mergePhoneDraft(
        { safety: { a: 'old', b: 'old' } },
        { safety: { a: 'draft', b: 'old' } },
        { safety: { a: 'old', b: 'new' } },
      ),
    ).toEqual({ merged: { safety: { a: 'draft', b: 'new' } }, conflicts: [] });
  });
  it('does not upload cached-owner changes when the current signed-in account differs', async () => {
    await commitPhoneDraft(newDraft('person', { name: 'Retained' }));
    vi.stubGlobal('navigator', { onLine: true });
    const request = vi.fn(async () =>
      Response.json({ current: { userId: 'different' } }),
    );
    vi.stubGlobal('fetch', request);
    await expect(synchronizePhoneRecords()).rejects.toThrow(/account changed/);
    expect(request).toHaveBeenCalledTimes(1);
    expect(await pendingDiveChanges()).toHaveLength(1);
    expect(await phoneDownloadStatus(account)).toBeUndefined();
  });
  it('does not mark a partial download complete and retains local records when device storage fails', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/household'
          ? Response.json({ current: { userId: account } })
          : url.includes('kind=person')
            ? new Response('Unavailable', { status: 503 })
            : Response.json({ items: [] }),
      ),
    );
    await expect(synchronizePhoneRecords()).rejects.toThrow(/unavailable/);
    expect(await phoneDownloadStatus(account)).toBeUndefined();
    const draft = newDraft('person', { name: 'Storage failure' });
    await savePhoneDraft(draft);
    const writer = vi
      .spyOn(zeustekDb.entities, 'put')
      .mockRejectedValueOnce(
        new DOMException('Quota full', 'QuotaExceededError'),
      );
    await expect(commitPhoneDraft(draft)).rejects.toThrow();
    writer.mockRestore();
    expect(await readPhoneDraft(draft.id)).toEqual(draft);
  });
  it('keeps ultrawide and portrait desktops in the full interface, with phone auto detection still gated', () => {
    expect(choosePhoneInterface('auto', 1440, false, true)).toBe(false);
    expect(choosePhoneInterface('auto', 1080, true, true)).toBe(false);
    expect(choosePhoneInterface('auto', 390, true)).toBe(false);
    expect(choosePhoneInterface('phone', 1080, false)).toBe(true);
    expect(choosePhoneInterface('full', 390, true, true)).toBe(false);
  });
  it('revokes an in-flight network permission when account or interface policy changes', async () => {
    let release: () => void = () => {};
    const work = withRecordNetwork(
      account,
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    expect(recordNetworkAllowed()).toBe(true);
    configureRecordNetwork('new-owner', 'manual');
    release();
    await expect(work).rejects.toThrow(/account changed/);
    expect(recordNetworkAllowed()).toBe(false);
  });
  it('uses the desktop engine for basic plans and keeps missing data and repetitive-dive NDL unavailable', () => {
    const input = {
      ...basicGasInput(),
      plannedDepthM: 20,
      plannedWorkingTimeMin: 20,
      cylinderWaterVolumeL: 12,
      startPressureBar: 200,
      ownRmvLMin: 15,
    };
    const result = buildRecreationalGasSnapshot(input, '2026-10-07T00:00:00Z');
    expect(result.version).toBe('zeustek-rec-gas-102/1.1');
    expect(result.reserve.totalLitres).toBeGreaterThan(0);
    expect(
      buildRecreationalGasSnapshot({ ...input, repetitiveDive: true })
        .readiness,
    ).toBe('Blocked');
    const missing = buildRecreationalGasSnapshot({
      ...input,
      ownRmvLMin: null,
    });
    expect(missing.readiness).toBe('Blocked');
    expect(
      missing.gasCandidates.find((row) => row.selected)?.gasLimitedTimeMin,
    ).toBeNull();
    const saved = preparePhoneRecord('gas-plan', {
      name: 'Gas',
      phoneGasInput:
        input as unknown as import('../lib/offline/types').JsonValue,
      recGasPlan101:
        result as unknown as import('../lib/offline/types').JsonValue,
    });
    expect(saved).not.toHaveProperty('phoneGasInput');
    expect(saved.recGasPlan101).toEqual(result);
  });
});
describe('public offline shell and sign-out', () => {
  const entries = new Map<string, Response>();
  beforeEach(() => {
    entries.clear();
    vi.stubGlobal('caches', {
      open: async (name: string) => {
        expect(name).toBe(PHONE_SHELL_CACHE);
        return {
          match: async (key: string) => entries.get(key)?.clone(),
          put: async (key: string, response: Response) => {
            entries.set(key, response);
          },
          delete: async (key: string) => entries.delete(key),
        };
      },
    });
  });
  it('caches only an anonymous shell; authenticated HTML and HTTP auth failures are never replayed', async () => {
    const request = vi.fn(
      async (_url: string, options?: RequestInit) =>
        new Response(
          options?.headers
            ? 'Anonymous component payload'
            : '<html>Anonymous bootstrap</html>',
          {
            headers: {
              'content-type': options?.headers
                ? 'text/x-component'
                : 'text/html',
            },
          },
        ),
    );
    vi.stubGlobal('fetch', request);
    await preparePhoneShell();
    expect(request).toHaveBeenCalledWith(PHONE_SHELL_PATH, {
      cache: 'no-store',
      credentials: 'omit',
    });
    expect([...entries.keys()]).toEqual([
      PHONE_SHELL_PATH,
      PHONE_RSC_PATH,
      PHONE_ENTRY_PATH,
    ]);
    expect(request).toHaveBeenCalledWith(PHONE_SHELL_PATH, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { RSC: '1' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Sign in', { status: 401 })),
    );
    expect(
      (await phoneNavigation(new Request('https://fixture.invalid/phone')))
        .status,
    ).toBe(401);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    expect(
      await (
        await phoneNavigation(
          new Request('https://fixture.invalid/phone?tab=plans'),
        )
      ).text(),
    ).toContain('Anonymous bootstrap');
    expect(
      await (
        await phoneNavigation(
          new Request('https://fixture.invalid/phone?_rsc=fixture', {
            headers: { RSC: '1' },
          }),
        )
      ).text(),
    ).toBe('Anonymous component payload');
    await expect(
      phoneNavigation(new Request('https://fixture.invalid/')),
    ).rejects.toThrow();
    expect(
      await (
        await phoneNavigation(
          new Request('https://fixture.invalid/?source=pwa'),
        )
      ).text(),
    ).toContain('Anonymous bootstrap');
  });
  it('clears offline account access on sign-out while retaining the owner’s unsent records', async () => {
    await rememberPhoneAccount(account);
    await saveLocalRecord('person', {
      entityId: 'saved',
      name: 'Unsent buddy',
    });
    expect((await readPhoneAccount())?.account).toBe(account);
    await clearPhoneOfflineIdentity();
    expect(await readPhoneAccount()).toBeNull();
    expect(await pendingDiveChanges()).toHaveLength(1);
    expect(await listLocalDiveRecords('person')).toHaveLength(1);
  });
});
