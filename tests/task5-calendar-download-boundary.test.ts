import { describe, expect, it, vi } from 'vitest';
import { calendarDeliverySourceMatches, deliverCurrentCalendar } from '../lib/calendar/calendar-download-boundary';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function fixture() {
  const source = { privateTitle: 'DUMMY PRIVATE TITLE' };
  const state = { account: 'fixture-owner', source, version: 0, mounted: true };
  const persistence = deferred();
  const persist = vi.fn(() => persistence.promise);
  const deliver = vi.fn();
  const start = () => deliverCurrentCalendar({
    accountId: 'fixture-owner', currentAccount: () => state.account,
    isCurrent: () => state.mounted && state.version === 0 && state.source === source,
    persist, deliver,
  });
  return { state, persistence, persist, deliver, start };
}

describe('calendar file delivery after asynchronous metadata persistence', () => {
  it('allows the expected own manifest transition without relaxing prepared source and selection identity', () => {
    const source = { snapshot: {}, options: {}, selection: ['fixture-event'], priorManifest: {} };
    const attempt = { ...source, manifest: {} };
    expect(calendarDeliverySourceMatches(attempt, source)).toBe(true);
    expect(calendarDeliverySourceMatches(attempt, { ...source, priorManifest: attempt.manifest })).toBe(true);
    for (const changed of [{ snapshot: {} }, { options: {} }, { selection: ['fixture-event'] }, { priorManifest: {} }]) {
      expect(calendarDeliverySourceMatches(attempt, { ...source, ...changed })).toBe(false);
    }
  });

  it('delivers the exact prepared file only after persistence succeeds in the unchanged owner view', async () => {
    const test = fixture();
    const pending = test.start();
    expect(test.persist).toHaveBeenCalledTimes(1);
    expect(test.deliver).not.toHaveBeenCalled();
    test.persistence.resolve();
    expect(await pending).toBe(true);
    expect(test.deliver).toHaveBeenCalledTimes(1);
  });

  it('does not begin persistence or delivery when the account already changed', async () => {
    const test = fixture();
    test.state.account = 'another-owner';
    expect(await test.start()).toBe(false);
    expect(test.persist).not.toHaveBeenCalled();
    expect(test.deliver).not.toHaveBeenCalled();
  });

  it('does not deliver an opted-in private file when the account changes during persistence', async () => {
    const test = fixture();
    const pending = test.start();
    test.state.account = 'another-owner';
    test.persistence.resolve();
    expect(await pending).toBe(false);
    expect(test.deliver).not.toHaveBeenCalled();
  });

  it.each(['source-change', 'records-updated', 'cancel', 'unmount'] as const)(
    'suppresses delivery after %s while metadata persistence is pending', async reason => {
      const test = fixture();
      const pending = test.start();
      if (reason === 'source-change') test.state.source = { privateTitle: 'CHANGED PRIVATE TITLE' };
      else if (reason === 'unmount') test.state.mounted = false;
      else test.state.version++;
      test.persistence.resolve();
      expect(await pending).toBe(false);
      expect(test.deliver).not.toHaveBeenCalled();
    },
  );

  it('does not deliver on persistence failure and preserves the failure for the review UI', async () => {
    const deliver = vi.fn();
    await expect(deliverCurrentCalendar({
      accountId: 'fixture-owner', currentAccount: () => 'fixture-owner', isCurrent: () => true,
      persist: async () => { throw new Error('Fixture persistence unavailable'); }, deliver,
    })).rejects.toThrow('Fixture persistence unavailable');
    expect(deliver).not.toHaveBeenCalled();
  });
});
