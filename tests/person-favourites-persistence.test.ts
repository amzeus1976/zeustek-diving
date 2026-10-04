import 'fake-indexeddb/auto';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore} from '../lib/offline/dive-store';
import {savePerson,listPeople,type PersonRecord} from '../lib/offline/dive-planning';
beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('favourite-fixture');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
it('persists an explicit Person favourite change while retaining manual evidence, photo and legacy links, then removes only that preference',async()=>{
 const record={name:'Fixture Human',role:'buddy',agency:'',highestQualification:'Manual value',membershipNumber:'',email:'private@example.invalid',phone:'',emergencyContact:'',operatorId:'legacy-entity',currentDiveOperatorId:'current-entity',profileImageId:'legacy-photo',preferredTopBuddyPersonId:'preferred',manualOverrideFields:['highestQualification'],notes:'Private note'} as Omit<PersonRecord,'createdAt'|'modifiedAt'>;
 await savePerson(record);const before=(await listPeople())[0]!;const stateBefore=await zeustekDb.entities.toArray(),eventsBefore=await zeustekDb.events.count();
 expect((await listPeople())[0]?.favourite).toBeUndefined();expect(await zeustekDb.entities.toArray()).toEqual(stateBefore);expect(await zeustekDb.events.count()).toBe(eventsBefore);
 await savePerson({...before,favourite:true});const saved=(await listPeople())[0]!;expect(saved).toMatchObject({...record,entityId:before.entityId,favourite:true});
 await savePerson({...saved,favourite:false});const reopened=(await listPeople())[0]!;expect(reopened).toMatchObject({...record,entityId:before.entityId,favourite:false});expect(fetch).not.toHaveBeenCalled();
});
it('does not leak the current owner preference into another account snapshot',async()=>{await savePerson({name:'Fixture',role:'buddy',agency:'',highestQualification:'',membershipNumber:'',email:'',phone:'',emergencyContact:'',notes:'',favourite:true});configureDiveStore('other-fixture');expect(await listPeople()).toEqual([]);expect(fetch).not.toHaveBeenCalled();});
