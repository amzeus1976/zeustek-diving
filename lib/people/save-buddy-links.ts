import {zeustekDb} from '../offline/db';
import {currentDiveAccount,refreshDiveRecords} from '../offline/dive-store';
import {buddyLinkRequest} from './buddy-links';
export async function saveBuddyLinks(personId:string,ids:string[],dives:Array<{entityId:string;modifiedAt:string}>){
  if(!navigator.onLine)throw Error('Reconnect before linking historical Dives. Your selection is retained.');
  const request=buddyLinkRequest(personId,ids,dives),recordModule='dive:'+currentDiveAccount();
  for(const {id} of request.dives){
    if(await zeustekDb.settings.get(`pending:${recordModule}:${id}`))throw Error('A selected Dive has an unsynchronised change. Resolve its sync status before linking.');
  }
  let response:Response;
  try{response=await fetch('/api/people/dive-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(20_000)});}
  catch{await refreshDiveRecords('dive',true);throw Error('The result could not be confirmed. Review refreshed shared Dives before retrying; this request was not retried automatically.');}
  const result=await response.json() as {error?:string;linked?:number};
  if(!response.ok){await refreshDiveRecords('dive',true);throw Error(result.error||'No links were saved. Refresh and review the selection.');}
  await refreshDiveRecords('dive',true);
  return result.linked??0;
}

