/** Explicit canonical planning references only; no text/name inference. */
export const PLANNING_LINK_FIELDS = [
 {kind:'trip',field:'tripId',targetKind:'dive-trip'},
 {kind:'trip',field:'linkedTripId',targetKind:'dive-trip'},
 {kind:'trip',field:'linkedDivePlanId',targetKind:'trip'},
 {kind:'trip',field:'linkedGasPlanId',targetKind:'gas-plan'},
 {kind:'trip',field:'linkedTrainingId',targetKind:'training-progress'},
 {kind:'trip',field:'linkedCertificationId',targetKind:'certification'},
 {kind:'trip',field:'gasPlanLinks',targetKind:'gas-plan',itemField:'gasPlanId'},
 {kind:'trip',field:'linkedDiveIds',targetKind:'dive',array:true},
 {kind:'dive-trip',field:'originCalendarBookingId',targetKind:'trip'},
 {kind:'dive-trip',field:'planIds',targetKind:'trip',array:true},
 {kind:'dive-trip',field:'calendarBookingIds',targetKind:'trip',array:true},
 {kind:'dive-trip',field:'itinerary',targetKind:'trip',itemField:'calendarBookingId',retainItem:true},
 {kind:'dive-trip',field:'linkedDiveIds',targetKind:'dive',array:true},
 {kind:'gas-plan',field:'divePlanId',targetKind:'trip'},
 {kind:'dive',field:'originatingPlanId',targetKind:'trip'},
 {kind:'skill_evidence',field:'planId',targetKind:'trip'},
] as const satisfies ReadonlyArray<{kind:string;field:string;targetKind:string;array?:boolean;itemField?:string;retainItem?:boolean}>;
export type PlanningLinkField={kind:string;field:string;targetKind:string;array?:boolean;itemField?:string;retainItem?:boolean};
export function planningFieldTargets(data:Record<string,unknown>,spec:PlanningLinkField):string[]{
 const value=data[spec.field];
 const candidates=spec.array||spec.itemField?Array.isArray(value)?value.map(item=>spec.itemField&&item&&typeof item==='object'?(item as Record<string,unknown>)[spec.itemField]:item):[]:[value];
 return [...new Set(candidates.filter((id):id is string=>typeof id==='string'&&id.trim().length>0))];
}
export function removePlanningFieldTarget(data:Record<string,unknown>,spec:PlanningLinkField,id:string){
 const value=data[spec.field];
 if(spec.itemField&&Array.isArray(value))return {...data,[spec.field]:spec.retainItem?value.map(item=>item&&typeof item==='object'&&(item as Record<string,unknown>)[spec.itemField!]===id?{...item,[spec.itemField!]:null}:item):value.filter(item=>!item||typeof item!=='object'||(item as Record<string,unknown>)[spec.itemField!]!==id)};
 if(spec.array&&Array.isArray(value))return {...data,[spec.field]:value.filter(item=>item!==id)};
 return value===id?{...data,[spec.field]:null}:data;
}
