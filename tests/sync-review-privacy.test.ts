import { describe, expect, it } from 'vitest';
import { reviewRecordSnapshot, conflictExportPayload, syncReviewSummary } from '../lib/offline/sync-review';
describe('private connection-safe sync review', () => {
  it('retains ordinary record data while recursively excluding secrets from comparison and download', () => {
    const value = { title: 'Ordinary service', notes: 'Keep these notes', nested: { encryptedRefreshToken: 'dummy-ciphertext', access_token: 'dummy-token', safe: ['Kept', { clientSecret: 'dummy-secret', text: 'Kept too' }] } };
    const before = JSON.stringify(value);
    const pending = { id: 'event-id', kind: 'equipment-event', record: value, token: 'dummy-pending-token', error: 'PRIVATE DIAGNOSTIC', state: 'conflict' };
    const json = JSON.stringify(conflictExportPayload(pending));
    expect(reviewRecordSnapshot(value)).toEqual({ title: 'Ordinary service', notes: 'Keep these notes', nested: { safe: ['Kept', { text: 'Kept too' }] } });
    expect(json).toContain('Ordinary service'); expect(json).toContain('Keep these notes');
    for (const value of ['dummy-ciphertext', 'dummy-token', 'dummy-secret', 'dummy-pending-token', 'PRIVATE DIAGNOSTIC']) expect(json).not.toContain(value);
    expect(JSON.stringify(pending.record)).toBe(before);
  });
  it('does not export unknown/server connection kinds or show arbitrary error text', () => {
    expect(() => conflictExportPayload({ kind: 'gmail-connection-secret', record: { encryptedRefreshToken: 'dummy' } })).toThrow(/connection|export/i);
    const summary = syncReviewSummary({ kind: 'equipment-event', record: { title: 'Service at fixture shop' }, error: 'Shared equipment access required for this history.' });
    expect(summary).toMatchObject({ title: 'Service at fixture shop', kind: 'Equipment history' });
    expect(summary.message).toMatch(/shared equipment access/i);
    expect(syncReviewSummary({ kind: 'operator', record: { name: 'Fixture centre' }, error: 'refresh_token=dummy' }).message).not.toContain('dummy');
  });
  it('distinguishes deletion and untitled records without guessing identity from names', () => {
    expect(syncReviewSummary({ kind: 'dive', record: null })).toMatchObject({ kind: 'Dive', title: 'Pending deletion' });
    expect(syncReviewSummary({ kind: 'equipment', record: {} }).title).toBe('Untitled Equipment record');
  });
});
