import 'fake-indexeddb/auto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore,listLocalDiveRecords,saveLocalRecord} from '../lib/offline/dive-store';
import {localBackupPayload,restoreLocalPayload} from '../lib/offline/local-backup';
import {emptyRequirementSet,listReferenceRequirementSets,saveReferenceRequirementSet,evaluateTechnicalRequirement} from '../lib/offline/technical-workspace';
import {appendTripAttachments,categoriseTripAttachment,cleanupTripMedia,safeTripResourceUrl,tripMediaOwner,updateTripResources} from '../lib/offline/trip-attachments';
import {editableDiveExpeditionTrip,listDiveExpeditionTrips,saveDiveExpeditionTrip} from '../lib/offline/trips-expeditions';
beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('t07-test');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
const asset=(id:string)=>({id,fileName:'duplicate.png',contentType:'image/png',sizeBytes:123,createdAt:'2026-09-14T10:00:00Z'});
describe('T07 canonical reference snapshots and Trip resource scopes',()=>{
  it('cleans only originals owned by the removed itinerary scope, never linked entities or other scopes',async()=>{
    const request=vi.fn(async(url:string,init?:RequestInit)=>init?.method==='DELETE'?Response.json({deleted:true}):Response.json({items:[{id:'owned-original'}]}));
    vi.stubGlobal('fetch',request);await cleanupTripMedia('trip',['removed-item'],false);
    expect(request.mock.calls).toEqual([
      ['/api/media?kind=dive-trip-itinerary&ownerId=trip%3Aremoved-item',{cache:'no-store'}],
      ['/api/media?id=owned-original',{method:'DELETE'}],
    ]);
  });
  it('categorises legacy attachments without inventing unavailable size or capture dates',()=>{
    const legacy={id:'legacy',fileName:'prior.pdf',contentType:'application/pdf'};
    const first=categoriseTripAttachment([],legacy,'Booking confirmation');
    expect(first).toEqual([{...legacy,category:'Booking confirmation'}]);
    expect(categoriseTripAttachment(first,legacy,'Medical')).toEqual([{...legacy,category:'Medical'}]);
  });
  it('saves immutable versions offline, prevents destructive duplicates, queues events and preserves backup',async()=>{
    const input={...emptyRequirementSet('synthetic-pathway','Synthetic only'),agency:'Test only',versionLabel:'v1',sourceCitation:'Owner synthetic acceptance',requirements:[]};
    const first=await saveReferenceRequirementSet(input);
    await expect(saveReferenceRequirementSet({...input,entityId:first.id})).rejects.toThrow('immutable');
    await expect(saveReferenceRequirementSet(input)).rejects.toThrow('already exists');
    await saveReferenceRequirementSet({...input,versionLabel:'v2',requirements:[{key:'manual',label:'Synthetic rule',kind:'manual',rule:{}}]});
    const backup=await localBackupPayload();for(const table of zeustekDb.tables)await table.clear();await restoreLocalPayload(backup);
    expect(await listReferenceRequirementSets()).toHaveLength(2);expect((await listReferenceRequirementSets()).find(row=>row.entityId===first.id)?.requirements).toEqual([]);expect(fetch).not.toHaveBeenCalled();
  });
  it('appends item-specific attachments and safe links, preserves canonical references and deletion isolation through reopening/backup',async()=>{
    await saveLocalRecord('trip',{entityId:'plan',name:'Canonical Plan'});await saveLocalRecord('site',{entityId:'site',name:'Canonical Site'});await saveLocalRecord('person',{entityId:'person',name:'Canonical Person'});await saveLocalRecord('equipment-set',{entityId:'loadout',name:'Canonical loadout'});await saveLocalRecord('site-overhead-profile',{entityId:'overhead',siteId:'site'});
    await saveLocalRecord('dive-trip',{entityId:'expedition',name:'Synthetic Trip',teamPersonIds:['person'],siteIds:['site'],planIds:['plan'],packingEquipmentSetIds:['loadout'],itinerary:[{id:'hotel',kind:'accommodation',title:'Test hotel'},{id:'dive',kind:'dive',title:'Test dive'}],documentAttachmentIds:['legacy-file'],futureFact:'keep'});
    await updateTripResources('expedition',undefined,scope=>({...scope,attachments:appendTripAttachments(scope.attachments,[asset('passport')],'Passport / identity')}));
    await updateTripResources('expedition','hotel',scope=>({...scope,attachments:appendTripAttachments(scope.attachments,Array.from({length:5},(_,index)=>asset(`image${index}`)),'Photo')}));
    await updateTripResources('expedition','hotel',scope=>({...scope,attachments:appendTripAttachments(scope.attachments,Array.from({length:3},(_,index)=>asset(`extra${index}`)),'Photo'),links:[{id:'airbnb',title:'Accommodation',url:'https://example.com/accommodation',notes:'Synthetic'}]}));
    await updateTripResources('expedition','dive',scope=>({...scope,attachments:appendTripAttachments(scope.attachments,[{...asset('map'),contentType:'application/pdf'}],'Map'),links:[{id:'dive-link',url:'https://example.com/map'}]}));
    zeustekDb.close();await zeustekDb.open();let trip=(await listDiveExpeditionTrips())[0]!;expect(trip.itinerary[0]?.attachments).toHaveLength(8);expect(trip.documentAttachmentIds).toContain('legacy-file');expect(trip.documentAttachmentIds).toContain('passport');
    await updateTripResources('expedition','hotel',scope=>({...scope,attachments:scope.attachments.filter(item=>item.id!=='image0')}));
    trip=(await listDiveExpeditionTrips())[0]!;expect(trip.itinerary[0]?.attachments).toHaveLength(7);expect(trip.itinerary[1]?.attachments?.[0]?.id).toBe('map');expect(trip.attachments?.[0]?.id).toBe('passport');
    await saveDiveExpeditionTrip({...editableDiveExpeditionTrip(trip),notes:'Offline edit'});expect(await zeustekDb.outbox.count()).toBeGreaterThan(5);
    const backup=await localBackupPayload();for(const table of zeustekDb.tables)await table.clear();await restoreLocalPayload(backup);
    expect((await listDiveExpeditionTrips())[0]).toMatchObject({futureFact:'keep',planIds:['plan'],siteIds:['site'],teamPersonIds:['person'],packingEquipmentSetIds:['loadout']});
    for(const kind of ['trip','site','person','equipment-set','site-overhead-profile'])expect(await listLocalDiveRecords(kind)).toHaveLength(1);expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects unsafe link schemes and credentials and keeps full safe URLs',()=>{
    for(const value of ['javascript:alert(1)','data:text/html,test','file:///secret','https://user:pass@example.com'])expect(safeTripResourceUrl(value)).toBeNull();expect(safeTripResourceUrl('https://example.com/a?long=test#part')).toBe('https://example.com/a?long=test#part');
    expect(tripMediaOwner('trip','hotel')).not.toEqual(tripMediaOwner('trip'));expect(tripMediaOwner('trip','hotel')).not.toEqual(tripMediaOwner('trip','dive'));
  });
  it('does not count future or undated assessment evidence as attained',()=>{
    const result=evaluateTechnicalRequirement({key:'future',label:'Synthetic',kind:'assessment',rule:{skillKey:'skill',minCompetence:'competent'}},{dives:[],certifications:[],skills:[{entityId:'skill',name:'Synthetic',group:'Future custom group'}],evidence:[{entityId:'future',skillKey:'skill',competenceLevel:'competent',performedAt:'2099-01-01',attachmentIds:[]}],equipmentSets:[],asOf:new Date('2026-09-14')});expect(result.state).toBe('not_satisfied');
  });
});
