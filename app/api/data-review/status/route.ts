import {sharingJson,sharingOwner} from '@/lib/server/sharing-access';
export const dynamic='force-dynamic';
/** Permission only. Does not load, seed, repair or synchronise records. */
export async function GET(){const access=await sharingOwner();return access.error??sharingJson({allowed:true});}
