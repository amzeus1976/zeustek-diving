type CylinderIdentity={entityId:string};
type HistoryIdentity={entityId:string;cylinderEquipmentId:string};
export type CylinderReview<T extends CylinderIdentity>=
 | {state:'none'|'unavailable'}
 | {state:'found';cylinder:T;fillId?:string;analysisId?:string;historyUnavailable:boolean};
export interface CylinderReviewAttemptState {openedKey:string|null;handledKey:string|null}

/** Exact read-only source selection; a history row never authorises a different parent. */
export function resolveCylinderReview<T extends CylinderIdentity>(query:URLSearchParams,cylinders:ReadonlyArray<T>,fills:ReadonlyArray<HistoryIdentity>,analyses:ReadonlyArray<HistoryIdentity>):CylinderReview<T>{
 const requested=query.get('cylinderId')??query.get('recordId');
 const fillId=query.get('fillId')??'',analysisId=query.get('analysisId')??'';
 if(requested==='')return {state:'unavailable'};
 if(requested===null&&!fillId&&!analysisId)return {state:'none'};
 const fill=fillId?fills.find(row=>row.entityId===fillId):undefined;
 const analysis=analysisId?analyses.find(row=>row.entityId===analysisId):undefined;
 const parent=requested??fill?.cylinderEquipmentId??analysis?.cylinderEquipmentId;
 if(!parent||requested===null&&(fillId&&!fill||analysisId&&!analysis))return {state:'unavailable'};
 const cylinder=cylinders.find(row=>row.entityId===parent);
 if(!cylinder)return {state:'unavailable'};
 const validFill=Boolean(fill&&fill.cylinderEquipmentId===parent),validAnalysis=Boolean(analysis&&analysis.cylinderEquipmentId===parent);
 return {state:'found',cylinder,...(validFill?{fillId}:{}),...(validAnalysis?{analysisId}:{}),historyUnavailable:Boolean(fillId&&!validFill||analysisId&&!validAnalysis)};
}

/** Retry missing source data, while an already viewed parent stays closed after an ordinary refresh. */
export function resolveCylinderReviewAttempt<T extends CylinderIdentity>(query:URLSearchParams,cylinders:ReadonlyArray<T>,fills:ReadonlyArray<HistoryIdentity>,analyses:ReadonlyArray<HistoryIdentity>,previous:CylinderReviewAttemptState){
 const key=JSON.stringify(['cylinderId','recordId','fillId','analysisId'].map(field=>query.get(field)));
 if(previous.handledKey===key)return null;
 const review=resolveCylinderReview(query,cylinders,fills,analyses);
 const nextState:CylinderReviewAttemptState={
  openedKey:review.state==='found'?key:previous.openedKey,
  handledKey:review.state==='none'||review.state==='found'&&!review.historyUnavailable?key:previous.handledKey,
 };
 return {review,nextState,openCylinder:review.state==='found'&&previous.openedKey!==key};
}
