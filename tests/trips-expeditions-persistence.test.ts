import 'fake-indexeddb/auto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore,listLocalDiveRecords,saveLocalRecord} from '../lib/offline/dive-store';
import {localBackupPayload,restoreLocalPayload} from '../lib/offline/local-backup';
import {DIVE_RECORD_KINDS,recordIdentity} from '../lib/record-identity';
import {deleteDiveExpeditionTrip,editableDiveExpeditionTrip,listDiveExpeditionTrips,saveDiveExpeditionTrip,tripReadiness,type DiveExpeditionTripInput} from '../lib/offline/trips-expeditions';
beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('t04-test');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
const base=():DiveExpeditionTripInput=>({name:'UK day trip',status:'draft',startsOn:'2026-10-01',endsOn:'2026-10-01',teamPersonIds:[],siteIds:[],planIds:[],packingEquipmentSetIds:[],documentAttachmentIds:[],itinerary:[],bookings:[],packingItems:[],gasLogistics:[]});
describe('T04 canonical offline persistence',()=>{
  it('creates and edits offline through immutable events/outbox without persisting derived readiness',async()=>{
    const saved=await saveDiveExpeditionTrip(base());const trip=(await listDiveExpeditionTrips())[0]!;
    tripReadiness(trip);await saveDiveExpeditionTrip({...editableDiveExpeditionTrip(trip),destination:'Lancashire'});
    zeustekDb.close();await zeustekDb.open();expect((await listDiveExpeditionTrips())[0]).toMatchObject({entityId:saved.id,destination:'Lancashire'});
    expect((await listDiveExpeditionTrips())[0]).not.toHaveProperty('readiness');
    expect(await zeustekDb.events.where('entityId').equals(`dive:t04-test:${saved.id}`).count()).toBe(2);
    expect(await zeustekDb.outbox.count()).toBeGreaterThanOrEqual(2);expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves canonical Plan, Site, Person, loadout and overhead records on edits and deletion',async()=>{
    const refs=[['trip','plan'],['site','site'],['person','person'],['equipment-set','set'],['site-overhead-profile','overhead']] as const;
    for(const [kind,id] of refs)await saveLocalRecord(kind,{entityId:id,name:`Original ${id}`,history:'Keep',siteId:'site'});
    const before=await Promise.all(refs.map(([kind])=>listLocalDiveRecords(kind)));
    const saved=await saveDiveExpeditionTrip({...base(),planIds:['plan'],siteIds:['site'],organiserPersonId:'person',teamPersonIds:['person'],packingEquipmentSetIds:['set']});
    const trip=(await listDiveExpeditionTrips())[0]!;await saveDiveExpeditionTrip({...editableDiveExpeditionTrip(trip),packingItems:[{id:'packing',label:'Mask',packed:true}]});
    await deleteDiveExpeditionTrip(saved.id);expect(await listDiveExpeditionTrips()).toHaveLength(0);
    expect(await Promise.all(refs.map(([kind])=>listLocalDiveRecords(kind)))).toEqual(before);
    expect(DIVE_RECORD_KINDS).toContain('site-overhead-profile');
  });
  it('keeps similar trips separate rather than destructively merging or assigning name identities',async()=>{
    const first=await saveDiveExpeditionTrip(base());const second=await saveDiveExpeditionTrip(base());
    expect(first.id).not.toBe(second.id);expect(await listDiveExpeditionTrips()).toHaveLength(2);expect(recordIdentity('dive-trip',base())).toBe('');
  });
  it('retains unknown fields, historical missing references, logistics and document IDs through edit and backup',async()=>{
    await saveLocalRecord('dive-trip',{...base(),entityId:'historical-trip',futureFact:{keep:true},planIds:['unavailable-plan'],documentAttachmentIds:['original-file'],itinerary:[{id:'leg',kind:'dive',title:'Day two'}],bookings:[{id:'booking',kind:'operator',provider:'Boat',paid:true}],gasLogistics:[{id:'gas',label:'Air',plannedFillBar:200}]});
    const old=(await listDiveExpeditionTrips())[0]!;await saveDiveExpeditionTrip({...editableDiveExpeditionTrip(old),notes:'Edited offline'});
    const backup=await localBackupPayload();for(const table of zeustekDb.tables)await table.clear();await restoreLocalPayload(backup);
    expect((await listDiveExpeditionTrips())[0]).toMatchObject({entityId:'historical-trip',futureFact:{keep:true},planIds:['unavailable-plan'],documentAttachmentIds:['original-file'],itinerary:[{title:'Day two'}],bookings:[{paid:true}],gasLogistics:[{plannedFillBar:200}],notes:'Edited offline'});
    configureDiveStore('other-person');expect(await listDiveExpeditionTrips()).toHaveLength(0);
  });
});
