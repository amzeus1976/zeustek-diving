import 'fake-indexeddb/auto';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore} from '../lib/offline/dive-store';
import {localBackupPayload,restoreLocalPayload} from '../lib/offline/local-backup';
const accountModule='dive:fixture-backup';
beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());await zeustekDb.delete();await zeustekDb.open();configureDiveStore('fixture-backup');});afterEach(async()=>{await zeustekDb.delete();vi.unstubAllGlobals();});
describe('T14 local encrypted-backup input boundary',()=>{
 it('never includes server connection records or pending connection metadata, and keeps ordinary records',async()=>{
  const row=(id:string,entityType:string,record:Record<string,string>)=>({entityId:`${accountModule}:${id}`,module:accountModule,entityType,schemaVersion:1,record,recordHash:'',deleted:0 as const,updatedEventId:'',updatedAt:''});
  await zeustekDb.entities.bulkPut([row('dive','dive',{site:'Fixture Bay'}),row('connection','gmail-connection-secret',{encryptedRefreshToken:'DUMMY_PRIVATE_TOKEN'})]);
  await zeustekDb.settings.bulkPut([{key:`pending:${accountModule}:dive`,value:{state:'pending'}},{key:`pending:${accountModule}:connection`,value:{token:'DUMMY_PENDING_SECRET'}},{key:`conflict-archive:${accountModule}:gmail-connection-secret:connection:review`,value:{token:'DUMMY_REVIEW_SECRET'}},{key:`backup-review:${accountModule}:archive:fixture`,value:{entityType:'gmail-connection-secret',encryptedRefreshToken:'DUMMY_ARCHIVED_SECRET'}}]);
 const backup=await localBackupPayload();expect(backup.entities.map(entry=>entry.entityType)).toEqual(['dive']);expect(backup.pending).toHaveLength(1);expect(JSON.stringify(backup)).not.toMatch(/DUMMY_PRIVATE_TOKEN|DUMMY_PENDING_SECRET|DUMMY_REVIEW_SECRET|DUMMY_ARCHIVED_SECRET|gmail-connection-secret/);
 });
 it('rejects a legacy local backup with a connection secret hidden in review metadata',async()=>{const backup=await localBackupPayload();backup.reviews.push({key:`backup-review:${accountModule}:archive:fixture`,value:{encryptedRefreshToken:'DUMMY_PRIVATE_TOKEN'}});await expect(restoreLocalPayload(backup)).rejects.toThrow('invalid data');});
 it('rejects a relationship whose canonical parents are absent without restoring any records',async()=>{
  const backup=await localBackupPayload();
  const id='person-operator-link:missing-person:missing-centre:guide';
  backup.entities.push({entityId:`${accountModule}:${id}`,module:accountModule,entityType:'person-operator-link',schemaVersion:1,record:{entityId:id,personId:'missing-person',operatorId:'missing-centre',role:'Guide',active:true},recordHash:'',deleted:0,updatedEventId:'',updatedAt:''});
  await expect(restoreLocalPayload(backup)).rejects.toThrow('invalid data');
  expect(await zeustekDb.entities.count()).toBe(0);
 });
 it('rejects two primary affiliations in a local backup before inserting either',async()=>{
  const backup=await localBackupPayload();
  const row=(id:string,entityType:string,record:Record<string,unknown>)=>({entityId:`${accountModule}:${id}`,module:accountModule,entityType,schemaVersion:1,record:{...record,entityId:id},recordHash:'',deleted:0 as const,updatedEventId:'',updatedAt:''});
  backup.entities.push(row('person','person',{name:'Alex'}),row('a','operator',{name:'A'}),row('b','operator',{name:'B'}));
  backup.entities.push(row('person-operator-link:person:a:guide','person-operator-link',{personId:'person',operatorId:'a',role:'Guide',active:true,primary:true}));
  backup.entities.push(row('person-operator-link:person:b:instructor','person-operator-link',{personId:'person',operatorId:'b',role:'Instructor',active:true,primary:true}));
  await expect(restoreLocalPayload(backup)).rejects.toThrow('invalid data');
  expect(await zeustekDb.entities.count()).toBe(0);
 });
});
