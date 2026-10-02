import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from './chatgpt-auth';
import { redirect } from 'next/navigation';
import { env } from 'cloudflare:workers';
import { allowedHouseholdUser } from '@/lib/server/household';
import { visitorSnapshot } from '@/lib/server/public-profile';
import { PublicProfileView } from '@/components/sharing/public-profile-view';

export const dynamic = 'force-dynamic';

export default async function Page({searchParams}: {searchParams?:Promise<Record<string,string|string[]|undefined>>}) {
  const user = await getChatGPTUser();
  if (user && allowedHouseholdUser(user)) {
    const {default: DiveApp} = await import('./dashboard-client');
    return <DiveApp userId={user.userId} />;
  }
  const query = new URLSearchParams();
  for (const [key,value] of Object.entries(await searchParams ?? {})) {
    if (Array.isArray(value)) value.forEach(item=>query.append(key,item));
    else if (value !== undefined) query.set(key,value);
  }
  const privateDestination = [...query.keys()].some(key=>key!=='source'&&!key.startsWith('utm_'));
  if (!user && privateDestination) redirect(chatGPTSignInPath(`/?${query}`));
  let snapshot = null;
  try { snapshot = await visitorSnapshot(env.DB); } catch { /* Disabled/unavailable publication uses the generic welcome. */ }
  if (user) {
    return (
      <><PublicProfileView snapshot={snapshot}/><aside className="household-access-denied">
        <p>This account has not been invited to ZeusTek Diving.</p>
        <a href={chatGPTSignOutPath(query.size?`/?${query}`:'/')}>Use a different account</a>
      </aside></>
    );
  }
  return <PublicProfileView snapshot={snapshot}/>;
}
