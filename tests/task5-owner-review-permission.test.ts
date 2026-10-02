import { describe, expect, it } from 'vitest';
import { ownerReviewAllowedForAccount } from '../components/admin/use-owner-data-review';

describe('owner-review grants belong to their verified account', () => {
  it('rejects the previous owner grant immediately when a different account renders', () => {
    const previousGrant = { accountId: 'previous-owner', allowed: true };
    expect(ownerReviewAllowedForAccount(previousGrant, 'previous-owner')).toBe(true);
    expect(ownerReviewAllowedForAccount(previousGrant, 'another-account')).toBe(false);
  });
  it('keeps signed-out, unverified and denied views closed', () => {
    expect(ownerReviewAllowedForAccount({ accountId: '', allowed: true }, '')).toBe(false);
    expect(ownerReviewAllowedForAccount(null, 'fixture-owner')).toBe(false);
    expect(ownerReviewAllowedForAccount({ accountId: 'fixture-owner', allowed: false }, 'fixture-owner')).toBe(false);
  });
});
