/** Session-only evidence. Contains no records, credentials or persisted metadata. */
let owner='',generation=0,verifiedAt=0;
const active=new Set<string>(),failures=new Set<string>();
export function resetCloudSyncEvidence(account:string){owner=account;generation++;verifiedAt=0;active.clear();failures.clear();}
export function beginCloudSyncEvidence(account:string,key:string){
 const token={owner:account,generation,key};
 if(owner===account){active.add(key);notify();}
 return token;
}
export function finishCloudSyncEvidence(token:ReturnType<typeof beginCloudSyncEvidence>,success:boolean){
 if(token.owner!==owner||token.generation!==generation)return;
 active.delete(token.key);
 if(success){verifiedAt=Date.now();failures.delete(token.key);}else failures.add(token.key);
 notify();
}
export function cancelCloudSyncEvidence(token:ReturnType<typeof beginCloudSyncEvidence>){
 if(token.owner!==owner||token.generation!==generation)return;
 active.delete(token.key);notify();
}
export function cloudSyncEvidence(account:string,pendingIds:readonly string[]){
 if(owner!==account)return{verified:false,error:false};
 // A reviewed cloud-version choice can remove a rejected write from the queue.
 // Its absence clears that write's error; it never establishes verification.
 const error=[...failures].some(key=>!key.startsWith('write:')||pendingIds.includes(key.slice(6)));
 return{verified:verifiedAt>0&&Date.now()-verifiedAt<120_000&&active.size===0,error};
}
function notify(){if(typeof window!=='undefined')window.dispatchEvent(new Event('zeustek-cloud-sync'));}
