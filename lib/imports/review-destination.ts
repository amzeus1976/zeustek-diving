type ImportIdentity={entityId:string};
type ProfileIdentity={entityId:string;importId:string;latestImportId?:string;sourceVersions?:Array<{importId:string}>};
type ResolutionIdentity={entityId:string;importId:string;sourceProfileIds?:string[]};
/** Explicit source IDs never fall back to another imported file, profile or decision. */
export function resolveComputerReview<I extends ImportIdentity,P extends ProfileIdentity,R extends ResolutionIdentity>(query:URLSearchParams,imports:ReadonlyArray<I>,profiles:ReadonlyArray<P>,resolutions:ReadonlyArray<R>,current=''):{selectedProfileId:string;unavailable:boolean;requested:boolean;importRecord?:I;resolution?:R}{
 const requested=['profileId','importId','recordId','resolutionId'].some(key=>query.has(key));
 if(!requested)return {selectedProfileId:profiles.some(row=>row.entityId===current)?current:profiles[0]?.entityId??'',unavailable:false,requested:false};
 const profileId=query.get('profileId'),importId=query.get('importId')??query.get('recordId'),resolutionId=query.get('resolutionId');
 const unavailable={selectedProfileId:'',unavailable:true,requested:true};
 if(profileId===''||importId===''||resolutionId==='')return unavailable;
 const profile=profileId?profiles.find(row=>row.entityId===profileId):undefined;
 const resolution=resolutionId?resolutions.find(row=>row.entityId===resolutionId):undefined;
 const importRecord=importId?imports.find(row=>row.entityId===importId):resolution?imports.find(row=>row.entityId===resolution.importId):undefined;
 if(profileId&&!profile||resolutionId&&!resolution||importId&&!importRecord)return unavailable;
 if(resolution&&importId&&resolution.importId!==importId||resolution&&profileId&&!resolution.sourceProfileIds?.includes(profileId))return unavailable;
 if(profile&&importId&&![profile.importId,profile.latestImportId,...(profile.sourceVersions?.map(row=>row.importId)??[])].includes(importId))return unavailable;
 return {selectedProfileId:profile?.entityId??'',unavailable:false,requested:true,...(importRecord?{importRecord}:{}),...(resolution?{resolution}: {})};
}
