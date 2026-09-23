import type {ConditionsRequest,ConditionsSnapshot} from './conditions-model';
export function conditionsIdentity(request:ConditionsRequest){
 return JSON.stringify([request.siteId,request.latitude,request.longitude,request.provider,request.date,request.time,request.mode,request.marine,request.operatorId??'',request.plannedDepthM??null,[...(request.disabledProviders??[])].sort()]);
}
/** Partial provider failure retains usable prior evidence, without refreshing its timestamps. */
export function retainPartialConditions(next:ConditionsSnapshot,previous?:ConditionsSnapshot|null):ConditionsSnapshot{
 if(!previous||conditionsIdentity(previous.request)!==conditionsIdentity(next.request)||!next.diagnostics.some(d=>['unavailable','rate-limited','denied','empty','unsupported'].includes(d.status)))return next;
 const ids=new Set(next.readings.map(r=>r.id));
 const retained=previous.readings.filter(r=>!ids.has(r.id));
 if(!retained.length)return next;
 return {...next,readings:[...next.readings,...retained].slice(0,6000),diagnostics:[...next.diagnostics,{provider:'cache',status:'unavailable',message:'Earlier successful readings are retained with their original source times after a partial provider failure.',retrievedAt:next.retrievedAt}]};
}
