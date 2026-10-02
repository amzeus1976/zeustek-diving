type CylinderIdentity={entityId:string};
type HistoryIdentity={entityId:string;cylinderEquipmentId:string};
export type CylinderReview<T extends CylinderIdentity>=
 | {state:'none'|'unavailable'}
 | {state:'found';cylinder:T;fillId?:string;analysisId?:string;historyUnavailable:boolean};

/** Exact read-only source selection; a history row never authorises a different parent. */
export function resolveCylinderReview<T extends CylinderIdentity>(query:URLSearchParams,cylinders:ReadonlyArray<T>,fills:ReadonlyArray<HistoryIdentity>,analyses:ReadonlyArray<HistoryIdentity>):CylinderReview<T>{
 const requested=query.get('cylinderId')??query.get('recordId')??'';
 const fillId=query.get('fillId')??'',analysisId=query.get('analysisId')??'';
 if(!requested&&!fillId&&!analysisId)return {state:'none'};
 const fill=fillId?fills.find(row=>row.entityId===fillId):undefined;
 const analysis=analysisId?analyses.find(row=>row.entityId===analysisId):undefined;
 const parent=requested||fill?.cylinderEquipmentId||analysis?.cylinderEquipmentId;
 if(!parent||!requested&&(fillId&&!fill||analysisId&&!analysis))return {state:'unavailable'};
 const cylinder=cylinders.find(row=>row.entityId===parent);
 if(!cylinder)return {state:'unavailable'};
 const validFill=Boolean(fill&&fill.cylinderEquipmentId===parent),validAnalysis=Boolean(analysis&&analysis.cylinderEquipmentId===parent);
 return {state:'found',cylinder,...(validFill?{fillId}:{}),...(validAnalysis?{analysisId}:{}),historyUnavailable:Boolean(fillId&&!validFill||analysisId&&!validAnalysis)};
}
