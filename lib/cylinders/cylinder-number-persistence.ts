import {listCylinderInventory} from '../offline/loadouts-gas';
import {saveRecord} from '../offline/dive-planning';
import {reviewCylinderNumberChange,type CylinderNumberReview} from './cylinder-number-review';

let reviewQueue:Promise<unknown>=Promise.resolve();
/** An explicit single-record edit uses the canonical offline mutation/conflict path. */
export function saveReviewedCylinderNumber(review:CylinderNumberReview){
 const work=reviewQueue.then(async()=>{
  const rows=await listCylinderInventory();
  const proposed=reviewCylinderNumberChange(rows,review);
  const row=rows.find(item=>item.entityId===proposed.entityId&&item.recordStorageKind===proposed.recordStorageKind)!;
  const {recordStorageKind,...record}=row;
  return saveRecord(recordStorageKind,{...record,cylinderNumber:proposed.cylinderNumber});
 });
 reviewQueue=work.then(()=>undefined,()=>undefined);return work;
}
