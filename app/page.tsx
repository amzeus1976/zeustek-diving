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
    const destination=await searchParams;
    if(destination?.interface==='phone'){
      const query=new URLSearchParams();for(const [key,value] of Object.entries(destination)){if(key==='interface')continue;if(Array.isArray(value))value.forEach(item=>query.append(key,item));else if(value!==undefined)query.set(key,value);}
      redirect('/phone'+(query.size?'?'+query:''));
    }
    const {default: DiveApp} = await import('./dashboard-client');
    const {default: AppExperience} = await import('../components/phone/app-experience');
    return <AppExperience><DiveApp userId={user.userId}/></AppExperience>;
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
