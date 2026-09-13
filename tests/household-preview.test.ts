import { afterEach, describe, expect, it, vi } from 'vitest';
import { allowedHouseholdUser, householdUserIds, registerHouseholdUser } from '../lib/server/household';
import type { HouseholdEnv } from '../lib/server/household';

const preview = { userId: 'local_seedy', email: 'seedy@sites.test', displayName: 'Preview', fullName: null };
afterEach(() => vi.unstubAllEnvs());

describe('local preview household access', () => {
  it('accepts only the exact Sites development identity', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(allowedHouseholdUser(preview)).toBe(true);
    expect(allowedHouseholdUser({ ...preview, userId: 'other' })).toBe(false);
    expect(allowedHouseholdUser({ ...preview, email: 'other@sites.test' })).toBe(false);
  });
  it('rejects the preview identity in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(allowedHouseholdUser(preview)).toBe(false);
    await expect(registerHouseholdUser({} as HouseholdEnv, preview)).rejects.toThrow('not invited');
  });
  it('keeps preview data separate without registering real household membership', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(await householdUserIds({} as HouseholdEnv, preview)).toEqual(['local_seedy']);
  });
});
