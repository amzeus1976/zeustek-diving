import { zeustekDb } from '../offline/db';

export const PHONE_ACCOUNT_KEY = 'phone:verified-account';
export interface PhoneOfflineAccount {
  account: string;
  verifiedAt: string;
}
export async function rememberPhoneAccount(account: string) {
  if (!account) throw new Error('Sign in before preparing this phone.');
  await zeustekDb.settings.put({
    key: PHONE_ACCOUNT_KEY,
    value: { account, verifiedAt: new Date().toISOString() },
  });
}
export async function readPhoneAccount(): Promise<PhoneOfflineAccount | null> {
  const row = await zeustekDb.settings.get(PHONE_ACCOUNT_KEY);
  const value = row?.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return typeof value.account === 'string' &&
    value.account &&
    typeof value.verifiedAt === 'string'
    ? { account: value.account, verifiedAt: value.verifiedAt }
    : null;
}
export async function forgetPhoneAccount() {
  await zeustekDb.settings.delete(PHONE_ACCOUNT_KEY);
}
