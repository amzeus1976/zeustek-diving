import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {ATOMIC_BUDDY_LINK_SQL} from '../../../../lib/people/buddy-links';
export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in to link historical Dives.'},{status:401});
  let body:unknown;try{body=await request.json();}catch{return Response.json({error:'Invalid link request.'},{status:400});}
  const candidate=body as {personId?:unknown;dives?:unknown};
  if(!candidate||typeof candidate.personId!=='string'||!candidate.personId||candidate.personId.length>200||!Array.isArray(candidate.dives)||!candidate.dives.length||candidate.dives.length>200)
    return Response.json({error:'Select a saved Person and between 1 and 200 Dives.'},{status:400});
  const dives=candidate.dives as Array<{id?:unknown;revision?:unknown}>;
  if(dives.some(row=>!row||typeof row.id!=='string'||!row.id||row.id.length>200||typeof row.revision!=='number'||!Number.isSafeInteger(row.revision)||row.revision<0)||new Set(dives.map(row=>row.id)).size!==dives.length)
    return Response.json({error:'Invalid or duplicate Dive selection.'},{status:400});
  const stamp=Math.max(Date.now(),...dives.map(row=>(row.revision as number)+1));
  const result=await env.DB.prepare(ATOMIC_BUDDY_LINK_SQL).bind(JSON.stringify(dives),user.userId,candidate.personId,stamp,dives.length).run();
  if(result.meta.changes!==dives.length)return Response.json({error:'Nothing was changed. A selected Dive or Person changed, is unavailable, or has incompatible team data. Refresh and review the selection again.'},{status:409});
  return Response.json({linked:result.meta.changes,modifiedAt:new Date(stamp).toISOString()});
}
