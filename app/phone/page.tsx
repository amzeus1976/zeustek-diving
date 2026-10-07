import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getChatGPTUser, chatGPTSignInPath } from '../chatgpt-auth';
import { allowedHouseholdUser } from '../../lib/server/household';
import PhoneApp from '../../components/phone/phone-app';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'ZeusTek Diving — Dive day',
  manifest: '/phone/manifest.webmanifest',
};
export default async function PhonePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getChatGPTUser();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  if (!user)
    redirect(chatGPTSignInPath('/phone' + (query.size ? '?' + query : '')));
  if (!allowedHouseholdUser(user))
    return <p>This account has not been invited to ZeusTek Diving.</p>;
  return <PhoneApp userId={user.userId} verifiedOnline />;
}
