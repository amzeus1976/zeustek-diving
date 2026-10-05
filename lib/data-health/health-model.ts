import {diveCompleteness} from '../dive-record-details';
import type {DiveRecord} from '../offline/dives';
import {validCalendarDay,calendarMonthRange} from '../calendar/calendar-dates';
import {csvCell} from '../exports/diver-summary';
import type {WorkflowDestination} from '../workflow/workflow-destination';
import {DATA_REVIEW_KINDS,type OwnerDataSnapshot} from './read-owner-snapshot';
import type {CalendarSourceRecord} from '../calendar/calendar-model';

type CheckId='coverage'|'dates'|'references'|'imports'|'images'|'completeness';
type Severity='warning'|'unknown'|'info';
const rules={
 'coverage-unknown':['coverage','unknown','Some record kinds have incomplete coverage on this device. Uninspected records remain Unknown.','Open the relevant workspace to review its existing snapshot, then explicitly inspect again.'],
 'missing-date':['dates','warning','A source record has no required saved date.','Open its canonical editor and decide whether to record a date.'],
 'invalid-date':['dates','warning','A saved date is not a supported Gregorian day, month or timestamp.','Review the exact source date without guessing a replacement.'],
 'reversed-date':['dates','warning','A saved end precedes its start.','Review the source range in its editor.'],
 'conflicting-date':['dates','warning','A saved day and wall-clock timestamp describe different days.','Review both source fields; no date has been selected automatically.'],
 'date-order-unverified':['dates','unknown','The range mixes an unzoned wall-clock time and an offset-qualified instant. Its order is unverified.','Review the intended timezone in the source. No device timezone was assumed.'],
 'missing-reference':['references','warning','A declared endpoint is absent from the last complete cached snapshot of its record kind.','Review the source and endpoint in their canonical workspaces. This is not a fresh cloud deletion check.'],
 'reference-unverified':['references','unknown','A declared endpoint is unavailable in an incomplete device snapshot.','Check its canonical workspace before concluding that the link is broken.'],
 'unresolved-import':['imports','warning','A staged computer profile is explicitly unlinked.','Open the exact profile and review linking or exclusion.'],
 'image-unverified':['images','unknown','A declared image has no verified local availability. Remote availability was not queried.','Use the source image preview or export to inspect it explicitly.'],
 'image-missing':['images','warning','A declared image has no local attachment or recorded remote location available to this device.','Review the source image or restore its attachment; the inspection has fetched nothing.'],
 'partial-evidence':['completeness','info','A Dive has missing or partial recorded Weather, Gear or Gas fields.','Review the recorded evidence. Completeness is not a safety, qualification or proficiency assessment.'],
} as const satisfies Record<string,readonly [CheckId,Severity,string,string]>;
export type HealthReason=keyof typeof rules;
export interface HealthFinding {checkId:CheckId;reason:HealthReason;severity:Severity;count:number;explanation:string;nextStep:string;destinations:WorkflowDestination[]}
export interface DataHealthResult {snapshotAt:string;coverageUnknown:boolean;unknownKinds:string[];totalChecked:number;findings:HealthFinding[]}
const object=(value:unknown):Record<string,unknown>|null=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const text=(value:unknown)=>typeof value==='string'?value:'';
const ids=(value:unknown)=>Array.isArray(value)?value.filter((id):id is string=>typeof id==='string'&&Boolean(id)):[];
const children=(value:unknown)=>Array.isArray(value)?value.map(object).filter((child):child is Record<string,unknown>=>child!==null):[];
const kinds=new Set<string>(DATA_REVIEW_KINDS);
function timestamp(value:string){
 const match=value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/);
 if(!match||!validCalendarDay(match[1])||Number(match[2])>23||Number(match[3])>59||Number(match[4]??0)>59)return null;
 const offset=Boolean(match[6]);if(offset&&match[6]!=='Z'&&(Number(match[6]!.slice(1,3))>23||Number(match[6]!.slice(4,6))>59))return null;
 const instant=Date.parse(offset?value:`${match[1]}T${match[2]}:${match[3]}:${match[4]??'00'}.${(match[5]??'').padEnd(3,'0')}Z`);
 return Number.isFinite(instant)?{offset,instant}:null;
}

function sourceDestination(row:CalendarSourceRecord,cylinderIds:ReadonlySet<string>):WorkflowDestination{
 const simple=(route:string,key:string,id=row.id):WorkflowDestination=>({route,recordId:id,params:{[key]:id}});
 switch(row.kind){
  case 'dive':return simple('Logbook','diveId');
  case 'trip':return simple('Dive Plans','planId');
  case 'dive-trip':return simple('Trips','tripId');
  case 'person':return simple('People','personId');
  case 'person-operator-link':return {...simple('People','personId',text(row.data.personId)),params:{personId:text(row.data.personId),relationshipId:row.id}};
  case 'operator':return simple('Dive Centres','operatorId');
  case 'operator-operator-link':return {...simple('Dive Centres','operatorId',text(row.data.fromOperatorId)),params:{operatorId:text(row.data.fromOperatorId),relationshipId:row.id}};
  case 'certification':return simple('Training','certificationId');
  case 'site':return simple('Sites','siteId');
  case 'skill':return simple('Skills & Currency','skillId');
  case 'skill_evidence':return {route:'Skills & Currency',params:{evidenceId:row.id}};
  case 'computer-import':return simple('Dive Computer Imports','importId');
  case 'computer-profile':return {route:'Dive Computer Imports',recordId:text(row.data.importId),params:{importId:text(row.data.importId),profileId:row.id}};
  case 'import-resolution':return {route:'Dive Computer Imports',params:{importId:text(row.data.importId),resolutionId:row.id}};
  case 'gas-plan':return simple('Gas Planning','gasPlanId');
  case 'equipment-set':return simple('Loadouts & Gas','loadoutId');
  case 'equipment-event':{
   const id=text(row.data.equipmentId),cylinder=cylinderIds.has(id),route=cylinder?'Cylinders & Gas':'Equipment',key=cylinder?'cylinderId':'equipmentId';
   return {...simple(route,key,id),params:{[key]:id,eventId:row.id}};
  }
  case 'cylinder':return simple('Cylinders & Gas','cylinderId');
  case 'cylinder-fill':case 'gas-analysis':return {route:'Cylinders & Gas',recordId:text(row.data.cylinderEquipmentId),params:{cylinderId:text(row.data.cylinderEquipmentId),[row.kind==='cylinder-fill'?'fillId':'analysisId']:row.id}};
  default:return simple('Equipment','equipmentId');
 }
}

/** Registry-based inspection of declared evidence. Pure, deterministic and deliberately non-repairing. */
export function evaluateDataHealth(snapshot:OwnerDataSnapshot):DataHealthResult{
 const owned=snapshot.records.filter(row=>kinds.has(row.kind)&&row.id&&object(row.data)&&row.data.householdOwnedByMe!==false&&(!row.data.householdOwnerId||row.data.householdOwnerId===snapshot.accountId));
 const records=owned.filter(row=>!row.data.suppressedFromUse);
 const cylinderIds=new Set(owned.filter(row=>row.kind==='cylinder').map(row=>row.id));
 const unknownKinds=DATA_REVIEW_KINDS.filter(kind=>!snapshot.completeKinds.includes(kind));
 const result:DataHealthResult={snapshotAt:snapshot.snapshotAt,coverageUnknown:unknownKinds.length>0,unknownKinds,totalChecked:records.length,findings:[]};
 const grouped=new Map<HealthReason,{finding:HealthFinding;keys:Set<string>}>();
 const add=(reason:HealthReason,row?:CalendarSourceRecord)=>{
  let group=grouped.get(reason);if(!group){const [checkId,severity,explanation,nextStep]=rules[reason];group={finding:{checkId,reason,severity,count:0,explanation,nextStep,destinations:[]},keys:new Set()};grouped.set(reason,group);}
  const key=row?`${row.kind}:${row.id}`:'coverage';if(group.keys.has(key))return;group.keys.add(key);group.finding.count++;if(row)group.finding.destinations.push(sourceDestination(row,cylinderIds));
 };
 if(result.coverageUnknown)add('coverage-unknown');
 const available=new Map<string,Set<string>>();
 const imageStates=new Map(snapshot.imageEvidence.map(item=>[JSON.stringify([item.recordId,item.field]),item.state]));
 for(const row of owned){const set=available.get(row.kind)??new Set<string>();set.add(row.id);if(row.kind==='skill'){for(const alias of [row.data.skillKey,row.data.key])if(typeof alias==='string'&&alias)set.add(alias);}available.set(row.kind,set);}
 const ref=(row:CalendarSourceRecord,targetKinds:string[],value:unknown)=>{
  if(typeof value!=='string'||!value||targetKinds.includes('person')&&value==='self')return;
  if(targetKinds.some(kind=>available.get(kind)?.has(value)))return;
  add(targetKinds.every(kind=>snapshot.completeKinds.includes(kind))?'missing-reference':'reference-unverified',row);
 };
 const field=(row:CalendarSourceRecord,key:string,targetKinds:string[])=>ref(row,targetKinds,row.data[key]);
 const array=(row:CalendarSourceRecord,key:string,targetKinds:string[])=>{for(const value of ids(row.data[key]))ref(row,targetKinds,value);};
 const range=(row:CalendarSourceRecord,startKey:string,endKey:string,required=false)=>{
  const start=text(row.data[startKey]),end=text(row.data[endKey]);if(required&&!start)add('missing-date',row);
  if(start&&!validCalendarDay(start)||end&&!validCalendarDay(end))add('invalid-date',row);
  if(validCalendarDay(start)&&validCalendarDay(end)&&end<start)add('reversed-date',row);
 };
 const timedRange=(row:CalendarSourceRecord)=>{
  const start=text(row.data.startAt),end=text(row.data.endAt);
  const a=start?timestamp(start):null,b=end?timestamp(end):null;
  if(start&&!a||end&&!b)add('invalid-date',row);
  if(a&&b){if(a.offset!==b.offset)add('date-order-unverified',row);else if(b.instant<a.instant)add('reversed-date',row);}
  if(start&&validCalendarDay(row.data.startDate)&&start.slice(0,10)!==row.data.startDate||end&&validCalendarDay(row.data.endDate)&&end.slice(0,10)!==row.data.endDate)add('conflicting-date',row);
 };
 for(const row of records){
  const data=row.data;
  switch(row.kind){
   case 'dive':{
    range(row,'date','',true);field(row,'siteId',['site']);field(row,'diveLeaderId',['person']);for(const key of ['buddyIds','diveTeamIds'])array(row,key,['person']);array(row,'equipmentIds',['equipment','cylinder']);field(row,'equipmentSetId',['equipment-set']);array(row,'equipmentSetIds',['equipment-set']);
    for(const value of ids(object(data.debrief)?.skillEvidenceIds))ref(row,['skill_evidence'],value);
    const safe={weather:text(data.weather),gas:text(data.gas),airTemperatureC:typeof data.airTemperatureC==='number'?data.airTemperatureC:null,windSpeedKnots:typeof data.windSpeedKnots==='number'?data.windSpeedKnots:null,equipmentIds:ids(data.equipmentIds),hiredEquipment:children(data.hiredEquipment).map(item=>({name:text(item.name),category:text(item.category)})),cylinders:children(data.cylinders).map(item=>({gasType:text(item.gasType),oxygenPercent:typeof item.oxygenPercent==='number'?item.oxygenPercent:null,startPressureBar:typeof item.startPressureBar==='number'?item.startPressureBar:null,endPressureBar:typeof item.endPressureBar==='number'?item.endPressureBar:null}))};
    if(Object.values(diveCompleteness(safe as unknown as DiveRecord)).some(state=>state!=='recorded'))add('partial-evidence',row);break;
   }
   case 'trip':array(row,'diveCentreIds',['operator']);range(row,'startDate','endDate',true);timedRange(row);field(row,'siteId',['site']);array(row,'personIds',['person']);array(row,'linkedDiveIds',['dive']);
    for(const [key,target] of [['linkedTripId','dive-trip'],['linkedDivePlanId','trip'],['linkedGasPlanId','gas-plan'],['linkedTrainingId','training-progress'],['linkedCertificationId','certification']] as const)field(row,key,[target]);
    for(const member of children(data.planTeam))ref(row,['person'],member.personId);break;
   case 'dive-trip':array(row,'diveCentreIds',['operator']);range(row,'startsOn','endsOn');field(row,'organiserPersonId',['person']);array(row,'teamPersonIds',['person']);array(row,'siteIds',['site']);array(row,'planIds',['trip']);array(row,'packingEquipmentSetIds',['equipment-set']);array(row,'linkedDiveIds',['dive']);array(row,'calendarBookingIds',['trip']);field(row,'originCalendarBookingId',['trip']);
    for(const item of children(data.packingItems)){ref(row,['equipment','cylinder'],item.equipmentId);ref(row,['equipment-set'],item.equipmentSetId);}break;
   case 'certification':range(row,'issuedAt','expiresAt');field(row,'personId',['person']);field(row,'instructorId',['person']);break;
   case 'person':field(row,'operatorId',['operator']);field(row,'currentDiveOperatorId',['operator']);break;
   case 'person-operator-link':field(row,'personId',['person']);field(row,'operatorId',['operator']);range(row,'startDate','endDate');break;
   case 'operator-operator-link':field(row,'fromOperatorId',['operator']);field(row,'toOperatorId',['operator']);range(row,'startDate','endDate');break;
   case 'skill_evidence':field(row,'skillKey',['skill']);field(row,'diveId',['dive']);field(row,'planId',['trip']);field(row,'evaluatorPersonId',['person']);field(row,'equipmentSetId',['equipment-set']);if(data.performedAt&&!validCalendarDay(data.performedAt)&&!timestamp(text(data.performedAt)))add('invalid-date',row);break;
   case 'equipment-event':field(row,'equipmentId',['equipment','cylinder']);range(row,'occurredAt','resolvedAt');break;
   case 'cylinder-fill':case 'gas-analysis':field(row,'cylinderEquipmentId',['cylinder','equipment']);field(row,'fillId',['cylinder-fill']);field(row,'originFillId',['cylinder-fill']);field(row,'analysedByPersonId',['person']);break;
   case 'gas-plan':field(row,'divePlanId',['trip']);for(const cylinder of children(data.cylinders)){if(cylinder.sourceMode!=='rental')ref(row,['cylinder','equipment'],cylinder.cylinderEquipmentId);ref(row,['cylinder-fill'],cylinder.fillId);ref(row,['gas-analysis'],cylinder.analysisId);}break;
   case 'computer-profile':field(row,'importId',['computer-import']);field(row,'latestImportId',['computer-import']);if(data.disposition!=='excluded')field(row,'targetDiveId',['dive']);if(data.disposition==='unlinked')add('unresolved-import',row);break;
   case 'import-resolution':if(!data.archivedAt&&!data.supersededAt){field(row,'importId',['computer-import']);field(row,'targetDiveId',['dive']);array(row,'sourceProfileIds',['computer-profile']);}break;
  }
  if(row.kind==='cylinder'||row.kind==='equipment')for(const key of ['hydroTestAt','visualTestAt','lastTestAt','birthDate','oxygenCleanUntil']){const value=data[key];if(typeof value==='string'&&value&&!validCalendarDay(value)&&!calendarMonthRange(value))add('invalid-date',row);}
  const declared=['cardFront','cardBack','profileImage','diveMapImage'].filter(key=>object(data[key]));if(data.profileImageId&&!data.profileImage)declared.push('profileImageId');if(data.imageKey)declared.push('imageKey');
  for(const fieldName of declared){const state=imageStates.get(JSON.stringify([row.id,fieldName]));if(state==='missing')add('image-missing',row);else if(state!=='local-present')add('image-unverified',row);}
 }
 result.findings=[...grouped.values()].map(group=>group.finding);return result;
}

/** Rebuild every displayed/exported summary from fixed text. Never serialises canonical records or source IDs. */
export function createDataHealthReport(result:DataHealthResult){
 const count=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?Math.min(value,25000):0;
 const at=typeof result.snapshotAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(result.snapshotAt)&&validCalendarDay(result.snapshotAt.slice(0,10))&&Number.isFinite(Date.parse(result.snapshotAt))?result.snapshotAt:null;
 return {version:1 as const,inspectedAt:at,scope:'Last owner-scoped device snapshot',coverage:result.coverageUnknown?'partial':'cached',totalChecked:count(result.totalChecked),observations:result.findings.flatMap(item=>{
  if(!Object.prototype.hasOwnProperty.call(rules,item.reason))return [];
  const [checkId,severity,explanation,nextStep]=rules[item.reason];if(item.checkId!==checkId)return [];
  return [{checkId,reason:item.reason,severity,count:count(item.count),explanation,nextStep}];
 })};
}
export function dataHealthReportCsv(result:DataHealthResult){const report=createDataHealthReport(result);return [['Check','Observation','Severity','Affected records','Explanation','Next step'],...report.observations.map(row=>[row.checkId,row.reason,row.severity,row.count,row.explanation,row.nextStep])].map(row=>row.map(csvCell).join(',')).join('\r\n');}
