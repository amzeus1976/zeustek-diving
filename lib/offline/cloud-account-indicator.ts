export interface CloudIndicatorInput {account:boolean;online:boolean;loaded:boolean;pending:number;conflicts:number;error:boolean}
export function cloudAccountIndicator(input:CloudIndicatorInput):{state:'synced'|'pending'|'disabled';label:string} {
 if(!input.account)return{state:'disabled',label:'Cloud account · Sync disabled'};
 if(input.error)return{state:'pending',label:'Cloud account · Sync needs attention'};
 if(input.conflicts)return{state:'pending',label:`Cloud account · ${input.conflicts} changes need review`};
 if(input.pending)return{state:'pending',label:`Cloud account · ${input.pending} changes pending`};
 if(!input.online)return{state:'pending',label:'Cloud account · Offline; changes stay on this device'};
 if(!input.loaded)return{state:'pending',label:'Cloud account · Checking sync status'};
 return{state:'synced',label:'Cloud account · Synced'};
}
