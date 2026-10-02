import {env} from 'cloudflare:workers';
import {PublicProfileView} from '@/components/sharing/public-profile-view';
import {visitorSnapshot} from '@/lib/server/public-profile';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function PublicProfilePage(){let snapshot=null;try {snapshot=await visitorSnapshot(env.DB);}catch {/* The generic welcome is safe when publication is disabled or unavailable. */}return <PublicProfileView snapshot={snapshot}/>;}
