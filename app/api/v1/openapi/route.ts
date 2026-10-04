import {sharingJson,sharingHeaders} from '@/lib/server/sharing-access';
import {readonlyApiContract} from '@/lib/sharing/api-contract';
import {apiUsageGuide} from '@/lib/sharing/api-guide';
export async function GET(request?:Request){
  const url=request?new URL(request.url):null,format=url?.searchParams.get('format');
  if(url&&([...url.searchParams.keys()].some(key=>key!=='format')||url.searchParams.getAll('format').length>1||format&&format!=='json'))return sharingJson({error:'Use the guide or format=json.'},400);
  if(format!=='json'&&request?.headers.get('accept')?.includes('text/html'))return new Response(apiUsageGuide(),{headers:{...sharingHeaders,'content-type':'text/html; charset=utf-8',vary:'Accept','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}});
  const response=sharingJson(readonlyApiContract);response.headers.set('vary','Accept');return response;
}
