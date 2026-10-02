/** Display numbers are labels; canonical entity IDs and references never change. */
export type CylinderNumberIdentity={entityId:string;recordStorageKind:'cylinder'|'equipment';cylinderNumber?:string|null;modifiedAt:string};
type CylinderReference=Pick<CylinderNumberIdentity,'entityId'|'recordStorageKind'>;
export type CylinderNumberIssue={kind:'duplicate'|'missing'|'invalid';number:string|null;records:CylinderReference[]};

function parsedNumber(value:unknown):number|null {
 if(typeof value!=='string')return null;
 const label=value.trim();
 if(!/^\d{1,2}$/.test(label))return null;
 const number=Number(label);
 return number>=1&&number<=99?number:null;
}
const formatted=(number:number)=>String(number).padStart(2,'0');
const reference=(row:CylinderNumberIdentity):CylinderReference=>({entityId:row.entityId,recordStorageKind:row.recordStorageKind});

/** Pure projection: reading diagnostics never allocates, repairs or persists. */
export function cylinderNumberIssues(rows:readonly CylinderNumberIdentity[]):CylinderNumberIssue[] {
 const issues:CylinderNumberIssue[]=[],groups=new Map<number,CylinderReference[]>();
 for(const row of rows){
  const number=parsedNumber(row.cylinderNumber);
  if(number===null){const missing=row.cylinderNumber==null||typeof row.cylinderNumber==='string'&&!row.cylinderNumber.trim();issues.push({kind:missing?'missing':'invalid',number:null,records:[reference(row)]});continue;}
  groups.set(number,[...(groups.get(number)??[]),reference(row)]);
 }
 for(const [number,records] of groups)if(records.length>1)issues.push({kind:'duplicate',number:formatted(number),records});
 return issues;
}

export type CylinderNumberReview={entityId:string;recordStorageKind:'cylinder'|'equipment';expectedNumber:string|null;expectedModifiedAt:string;requestedNumber:string};
/** Prepare one owner-reviewed change. Persistence must also enforce owner/revision/collision atomically. */
export function reviewCylinderNumberChange(rows:readonly CylinderNumberIdentity[],review:CylinderNumberReview){
 const selected=rows.find(row=>row.entityId===review.entityId&&row.recordStorageKind===review.recordStorageKind);
 if(!selected)throw new Error('The selected cylinder is no longer available.');
 if((selected.cylinderNumber??null)!==review.expectedNumber||selected.modifiedAt!==review.expectedModifiedAt||!Number.isFinite(Date.parse(review.expectedModifiedAt)))throw new Error('The cylinder changed. Refresh and review its current identity and number.');
 const requested=parsedNumber(review.requestedNumber);
 if(requested===null)throw new Error('Choose a cylinder display number in the existing 01–99 range.');
 if(rows.some(row=>(row.entityId!==selected.entityId||row.recordStorageKind!==selected.recordStorageKind)&&parsedNumber(row.cylinderNumber)===requested))throw new Error('That number is already assigned to another cylinder. Review both identities.');
 return {entityId:selected.entityId,recordStorageKind:selected.recordStorageKind,cylinderNumber:formatted(requested),expectedNumber:review.expectedNumber,expectedModifiedAt:review.expectedModifiedAt};
}
