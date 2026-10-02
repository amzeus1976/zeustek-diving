import {expect,it} from 'vitest';
import {resolveComputerReview} from '../lib/imports/review-destination';
const imports=[{entityId:'import-a'},{entityId:'import-b'}];
const profiles=[{entityId:'profile-a',importId:'import-a',latestImportId:'import-b'},{entityId:'profile-b',importId:'import-b'}];
const resolutions=[{entityId:'resolution-a',importId:'import-a',sourceProfileIds:['profile-a'],targetDiveId:'exact-dive',decisions:[]}];
const review=(query:string,current='')=>resolveComputerReview(new URLSearchParams(query),imports,profiles,resolutions,current);
it('opens the exact profile including its explicitly recorded later import',()=>{
 expect(review('profileId=profile-a&importId=import-a')).toMatchObject({selectedProfileId:'profile-a',unavailable:false});
 expect(review('profileId=profile-a&importId=import-b')).toMatchObject({selectedProfileId:'profile-a',unavailable:false});
});
it('preserves the exact import and resolution context without selecting a different source profile',()=>{
 expect(review('importId=import-a')).toMatchObject({selectedProfileId:'',importRecord:imports[0],unavailable:false});
 expect(review('importId=import-a&resolutionId=resolution-a')).toMatchObject({selectedProfileId:'',resolution:resolutions[0],importRecord:imports[0],unavailable:false});
 expect(review('resolutionId=resolution-a')).toMatchObject({resolution:resolutions[0],unavailable:false});
});
it('reports absent, contradictory or empty requested sources rather than falling back to first/current',()=>{
 for(const query of ['profileId=missing','profileId=','importId=missing','importId=import-b&resolutionId=resolution-a','profileId=profile-b&resolutionId=resolution-a'])expect(review(query,'profile-a')).toMatchObject({selectedProfileId:'',unavailable:true});
});
it('retains ordinary profile selection when no exact review was requested and never mutates evidence',()=>{
 const before=JSON.stringify({imports,profiles,resolutions});expect(review('','profile-b').selectedProfileId).toBe('profile-b');expect(review('').selectedProfileId).toBe('profile-a');expect(JSON.stringify({imports,profiles,resolutions})).toBe(before);
});
