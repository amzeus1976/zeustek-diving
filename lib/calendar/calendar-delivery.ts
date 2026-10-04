import {zeustekDb} from '../offline/db';
import {currentDiveAccount} from '../offline/dive-store';
import {validateCalendarManifest,type CalendarRevisionManifest} from './calendar-revisions';
function assertAccount(account:string){if(!account||account!==currentDiveAccount())throw new Error('The account changed. Reopen the calendar download.');}
const key=(account:string)=>`calendar-delivery:${account}`;
export async function readCalendarDelivery(account:string){assertAccount(account);const row=await zeustekDb.settings.get(key(account));assertAccount(account);return validateCalendarManifest(row?.value);}
/** Only explicit download calls this. No record, event, outbox or cloud writes. */
export async function saveCalendarDelivery(account:string,manifest:CalendarRevisionManifest,expected:CalendarRevisionManifest){
 assertAccount(account);const next=validateCalendarManifest(manifest),prior=validateCalendarManifest(expected);
 await zeustekDb.transaction('rw',zeustekDb.settings,async()=>{
  const current=validateCalendarManifest((await zeustekDb.settings.get(key(account)))?.value);assertAccount(account);
  if(JSON.stringify(current)!==JSON.stringify(prior))throw new Error('Calendar download history changed in another view. Inspect again before downloading.');
  const entries=Object.fromEntries(Object.entries(next.entries).map(([uid,entry])=>[uid,{digest:entry.digest,sequence:entry.sequence}]));
  await zeustekDb.settings.put({key:key(account),value:{version:1,entries}});assertAccount(account);
 });
}
