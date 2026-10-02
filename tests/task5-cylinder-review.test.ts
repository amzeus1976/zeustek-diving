import {expect,it} from 'vitest';
import {resolveCylinderReview,resolveCylinderReviewAttempt,type CylinderReviewAttemptState} from '../lib/cylinders/review-destination';
const cylinders=[{entityId:'canonical',recordStorageKind:'cylinder'},{entityId:'legacy',recordStorageKind:'equipment'}] as const;
const fills=[{entityId:'fill-a',cylinderEquipmentId:'canonical'},{entityId:'fill-b',cylinderEquipmentId:'legacy'}];
const analyses=[{entityId:'analysis-a',cylinderEquipmentId:'canonical'}];
const review=(query:string)=>resolveCylinderReview(new URLSearchParams(query),cylinders,fills,analyses);
it('opens only the requested canonical or legacy cylinder without changing identity or history',()=>{
 const before=JSON.stringify({cylinders,fills,analyses});
 expect(review('cylinderId=canonical')).toMatchObject({state:'found',cylinder:cylinders[0]});
 expect(review('cylinderId=legacy')).toMatchObject({state:'found',cylinder:cylinders[1]});
 expect(review('cylinderId=absent')).toEqual({state:'unavailable'});
 expect(JSON.stringify({cylinders,fills,analyses})).toBe(before);
});
it('resolves the exact retained fill/analysis when its parent is available',()=>{
 expect(review('fillId=fill-a')).toMatchObject({state:'found',cylinder:cylinders[0],fillId:'fill-a'});
 expect(review('cylinderId=canonical&fillId=fill-a&analysisId=analysis-a')).toMatchObject({state:'found',fillId:'fill-a',analysisId:'analysis-a',historyUnavailable:false});
});
it('never substitutes another cylinder for a mismatched or missing child reference',()=>{
 expect(review('cylinderId=canonical&fillId=fill-b')).toMatchObject({state:'found',cylinder:cylinders[0],historyUnavailable:true});
 expect(review('fillId=fill-a&analysisId=missing')).toMatchObject({state:'unavailable'});
 expect(review('fillId=fill-a&analysisId=analysis-a&cylinderId=missing')).toEqual({state:'unavailable'});
 expect(review('cylinderId=canonical&analysisId=missing')).toMatchObject({state:'found',historyUnavailable:true});
});
it('does not request a detail without an explicit ID',()=>expect(review('tab=history')).toEqual({state:'none'}));
it('does not infer another parent from history when an exact cylinder identity is explicitly blank',()=>{
 for(const query of ['cylinderId=','recordId=','cylinderId=&fillId=fill-a','recordId=&analysisId=analysis-a','cylinderId=&recordId=canonical&fillId=fill-a'])expect(review(query)).toEqual({state:'unavailable'});
});
it('retries the same unavailable source after its exact cylinder and history arrive, then handles it once',()=>{
 const query=new URLSearchParams('cylinderId=canonical&fillId=fill-a');
 let state:CylinderReviewAttemptState={openedKey:null,handledKey:null};
 const cold=resolveCylinderReviewAttempt(query,[],[],[],state);
 expect(cold?.review).toEqual({state:'unavailable'});expect(cold?.openCylinder).toBe(false);state=cold!.nextState;
 const arrived=resolveCylinderReviewAttempt(query,cylinders,fills,analyses,state);
 expect(arrived?.review).toMatchObject({state:'found',cylinder:cylinders[0],fillId:'fill-a',historyUnavailable:false});expect(arrived?.openCylinder).toBe(true);state=arrived!.nextState;
 expect(resolveCylinderReviewAttempt(query,cylinders,fills,analyses,state)).toBeNull();
});
it('lets history arrive later without reopening a parent already viewed, closed or being edited',()=>{
 const query=new URLSearchParams('cylinderId=canonical&fillId=fill-a&analysisId=analysis-a');
 const first=resolveCylinderReviewAttempt(query,cylinders,[],[],{openedKey:null,handledKey:null})!;
 expect(first.review).toMatchObject({state:'found',historyUnavailable:true});expect(first.openCylinder).toBe(true);
 const stillMissing=resolveCylinderReviewAttempt(query,cylinders,[],[],first.nextState)!;
 expect(stillMissing.openCylinder).toBe(false);expect(stillMissing.review).toMatchObject({historyUnavailable:true});
 const arrived=resolveCylinderReviewAttempt(query,cylinders,fills,analyses,stillMissing.nextState)!;
 expect(arrived.review).toMatchObject({fillId:'fill-a',analysisId:'analysis-a',historyUnavailable:false});expect(arrived.openCylinder).toBe(false);
 expect(resolveCylinderReviewAttempt(query,cylinders,fills,analyses,arrived.nextState)).toBeNull();
});
it('keeps distinct exact identities distinct even when they contain separator characters',()=>{
 const rows=[{entityId:'a|b'},{entityId:'a'}];
 const first=resolveCylinderReviewAttempt(new URLSearchParams('cylinderId=a%7Cb&recordId=c'),rows,[],[],{openedKey:null,handledKey:null})!;
 const second=resolveCylinderReviewAttempt(new URLSearchParams('cylinderId=a&recordId=b%7Cc'),rows,[],[],first.nextState)!;
 expect(second.review).toMatchObject({state:'found',cylinder:rows[1]});expect(second.openCylinder).toBe(true);
});
