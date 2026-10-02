import {expect,it} from 'vitest';
import {resolveCylinderReview} from '../lib/cylinders/review-destination';
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
