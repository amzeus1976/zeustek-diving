import {env} from 'cloudflare:workers';
import {sharingOwner,sharingJson} from '@/lib/server/sharing-access';
import {integrationRecordChoices} from '@/lib/server/readonly-api';
import {API_RESOURCES,type ApiResource} from '@/lib/sharing/readonly-api';
export async function GET(request:Request){const access=await sharingOwner();if(access.error)return access.error;const url=new URL(request.url),resource=url.searchParams.get('resource'),after=url.searchParams.get('after')??'',search=url.searchParams.get('q')??'';if(!API_RESOURCES.includes(resource as ApiResource)||after.length>180||search.length>100||[...url.searchParams.keys()].some(key=>!['resource','after','q'].includes(key)))return sharingJson({error:'Choose a supported record list.'},400);try {return sharingJson(await integrationRecordChoices(env.DB,access.user.userId,resource as ApiResource,after,search));}catch{return sharingJson({error:'Cloud record choices unavailable. Private records have not changed.'},503);}}
