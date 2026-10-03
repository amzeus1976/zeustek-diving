import {describe,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {diveEntityWriteConstraint} from '../lib/operators/dive-log-write-boundary';
describe('atomic owner-scoped Dive Entity references',()=>{
 it('does not change unrelated record kinds or historical unchanged references',()=>{
  expect(diveEntityWriteConstraint('person',{operatorId:'old'},null,'owner')).toEqual({sql:'',bindings:[]});expect(diveEntityWriteConstraint('dive',{operatorId:'missing-historical'},{operatorId:'missing-historical'},'owner')).toEqual({sql:'',bindings:[]});
 });
 it('rejects malformed identity values without interpreting a name as an ID',()=>{
  expect(()=>diveEntityWriteConstraint('dive',{operatorId:{name:'Example'}},null,'owner')).toThrow(/reference/i);expect(()=>diveEntityWriteConstraint('dive',{vesselId:'x'.repeat(257)},null,'owner')).toThrow(/reference/i);
 });
 it.each(['operatorId','vesselId'])('checks %s atomically and forbids foreign, deleted, wrong-kind or missing endpoints',field=>{
  const db=new DatabaseSync(':memory:');try{
   db.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY,user_id TEXT,kind TEXT,data_json TEXT,deleted_at INTEGER)');const insert=db.prepare('INSERT INTO dive_records VALUES (?,?,?,?,?)');insert.run('valid','owner','operator','{}',null);insert.run('foreign','other','operator','{}',null);insert.run('deleted','owner','operator','{}',1);insert.run('human','owner','person','{}',null);
   for(const id of ['valid','foreign','deleted','human','missing']){const guard=diveEntityWriteConstraint('dive',{[field]:id},null,'owner');const write=db.prepare('INSERT INTO dive_records SELECT ?,?,?,?,NULL WHERE 1=1'+guard.sql);expect(write.run('dive-'+id,'owner','dive',JSON.stringify({[field]:id}),...guard.bindings).changes).toBe(id==='valid'?1:0);}
  }finally{db.close();}
 });
 it('requires both selected endpoints independently and allows intentional unlinking',()=>{
  const guard=diveEntityWriteConstraint('dive',{operatorId:'operator',vesselId:'boat'},null,'owner');expect(guard.bindings).toEqual(['operator','owner','boat','owner']);expect(diveEntityWriteConstraint('dive',{operatorId:'',vesselId:''},{operatorId:'operator',vesselId:'boat'},'owner')).toEqual({sql:'',bindings:[]});
 });
});
