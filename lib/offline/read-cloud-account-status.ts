import {currentDiveAccount,pendingDiveChanges} from './dive-store';
import type {CloudIndicatorInput} from './cloud-account-indicator';
import {cloudSyncEvidence} from './cloud-sync-evidence';
export async function readCloudAccountStatus():Promise<CloudIndicatorInput>{
 const account=currentDiveAccount();
 if(!account)return{account:false,online:navigator.onLine,loaded:true,pending:0,conflicts:0,error:false};
 const rows=await pendingDiveChanges();
 const evidence=cloudSyncEvidence(account,rows.map(row=>(row.value as {id?:string})?.id??''));
 return{account:true,online:navigator.onLine,loaded:evidence.verified,pending:rows.length,conflicts:rows.filter(row=>(row.value as {state?:string})?.state==='conflict').length,error:evidence.error};
}
