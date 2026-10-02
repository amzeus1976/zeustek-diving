import {env} from 'cloudflare:workers';
import {visitorSnapshot} from '@/lib/server/public-profile';
import {sharingJson} from '@/lib/server/sharing-access';
export async function GET(){try {const snapshot=await visitorSnapshot(env.DB);return snapshot?sharingJson(snapshot):sharingJson({error:'Public profile unavailable.'},404);}catch{return sharingJson({error:'Public profile unavailable.'},503);}}
