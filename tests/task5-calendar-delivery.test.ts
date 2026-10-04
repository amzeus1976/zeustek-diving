import 'fake-indexeddb/auto';
import {beforeEach,expect,it} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore} from '../lib/offline/dive-store';
import {readCalendarDelivery,saveCalendarDelivery} from '../lib/calendar/calendar-delivery';
const uid=`ztek-${'a'.repeat(64)}@calendar.zeustek`;
const manifest={version:1 as const,entries:{[uid]:{digest:'b'.repeat(64),sequence:0}}};
beforeEach(async()=>{configureDiveStore('owner');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
it('reads default delivery history without writing any table',async()=>{const before=await Promise.all(zeustekDb.tables.map(table=>table.toArray()));expect(await readCalendarDelivery('owner')).toEqual({version:1,entries:{}});expect(await Promise.all(zeustekDb.tables.map(table=>table.toArray()))).toEqual(before);});
it('persists only validated opaque delivery metadata after an explicit call and rejects concurrent stale history',async()=>{
 const old=await readCalendarDelivery('owner');await saveCalendarDelivery('owner',manifest,old);expect(await readCalendarDelivery('owner')).toEqual(manifest);expect(await zeustekDb.entities.count()).toBe(0);expect(await zeustekDb.events.count()).toBe(0);expect(await zeustekDb.outbox.count()).toBe(0);
 await expect(saveCalendarDelivery('owner',{version:1,entries:{}},old)).rejects.toThrow('changed');expect(await readCalendarDelivery('owner')).toEqual(manifest);
});
it('rejects private metadata, malformed history and a changed account without replacing valid history',async()=>{
 const empty=await readCalendarDelivery('owner');await expect(saveCalendarDelivery('owner',{...manifest,privateNotes:'PRIVATE'} as typeof manifest,empty)).rejects.toThrow();expect(await zeustekDb.settings.count()).toBe(0);
 configureDiveStore('other');await expect(saveCalendarDelivery('owner',manifest,empty)).rejects.toThrow('account');expect(await zeustekDb.settings.count()).toBe(0);
});
