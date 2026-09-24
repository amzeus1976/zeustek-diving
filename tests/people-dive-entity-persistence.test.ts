import 'fake-indexeddb/auto';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore,saveLocalRecord,listLocalDiveRecords} from '../lib/offline/dive-store';
import * as store from '../lib/offline/dive-store';
import {saveOperator,savePerson,deleteOperator,deletePerson,listOperators,listPeople} from '../lib/offline/dive-planning';
import * as constraints from '../lib/operators/operator-dependencies';

beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('entity-relationship-test');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
const operator=(name:string)=>({name,location:'Port',website:'',notes:'',operatorType:'dive-centre' as const});
const person=(name:string)=>({name,role:'buddy' as const,agency:'',highestQualification:'',membershipNumber:'',email:'',phone:'',emergencyContact:'',notes:''});

describe('canonical relationship persistence',()=>{
  it('syncs parents before links and unlinks before parent deletion',()=>{
    const rows=[
      {kind:'operator',record:null,id:'delete-parent'},
      {kind:'person-operator-link',record:{personId:'p',operatorId:'o',role:'Guide',active:true,primary:true},id:'new-link'},
      {kind:'person-operator-link',record:null,id:'delete-link'},
      {kind:'person',record:{name:'Alex'},id:'create-parent'},
      {kind:'person-operator-link',record:{personId:'p',operatorId:'o',role:'Instructor',active:true,primary:false},id:'clear-primary'},
    ];
    const ordered=(store as typeof store & Record<string,any>).sortPendingDiveChanges?.(rows)??[];
    expect(ordered.map((row:{id:string})=>row.id)).toEqual(['create-parent','clear-primary','delete-link','new-link','delete-parent']);
  });
  it('rejects a link to a missing Person or Dive Entity',async()=>{
    await expect(saveLocalRecord('person-operator-link',{personId:'missing',operatorId:'missing',role:'Guide',active:true})).rejects.toThrow(/person|entity|operator/i);
  });
  it('stores multiple affiliations as relation records with stable IDs, without changing Person fields',async()=>{
    const p=await savePerson(person('Alex'));
    const a=await saveOperator(operator('Centre A'));
    const b=await saveOperator(operator('Resort B'));
    const first=await saveLocalRecord('person-operator-link',{personId:p.id,operatorId:a.id,role:'Instructor',active:true});
    const second=await saveLocalRecord('person-operator-link',{personId:p.id,operatorId:b.id,role:'Guide',active:true});
    expect(first.id).not.toBe(second.id);
    expect(first.id).toContain('person-operator-link');
    expect(await listLocalDiveRecords('person-operator-link')).toHaveLength(2);
    expect((await listPeople())[0]).not.toHaveProperty('operatorId');
    await expect(saveLocalRecord('person-operator-link',{personId:p.id,operatorId:a.id,role:' instructor ',active:true})).rejects.toThrow(/matching|duplicate/i);
  });
  it('blocks deletion of either linked endpoint without losing either record',async()=>{
    const p=await savePerson(person('Alex'));
    const a=await saveOperator(operator('Centre A'));
    await saveLocalRecord('person-operator-link',{personId:p.id,operatorId:a.id,role:'Guide',active:true});
    await expect(deleteOperator(a.id)).rejects.toThrow(/link|relationship/i);
    await expect(deletePerson(p.id)).rejects.toThrow(/link|relationship/i);
    expect(await listOperators()).toHaveLength(1);
    expect(await listPeople()).toHaveLength(1);
  });
  it('rejects a second active primary affiliation while offline',async()=>{
    const p=await savePerson(person('Alex'));
    const a=await saveOperator(operator('Centre A'));
    const b=await saveOperator(operator('Resort B'));
    await saveLocalRecord('person-operator-link',{personId:p.id,operatorId:a.id,role:'Instructor',active:true,primary:true});
    await expect(saveLocalRecord('person-operator-link',{personId:p.id,operatorId:b.id,role:'Guide',active:true,primary:true})).rejects.toThrow(/primary/i);
    expect(await listLocalDiveRecords('person-operator-link')).toHaveLength(1);
  });
  it('keeps a Person with a planned-team reference intact offline',async()=>{
    const p=await savePerson(person('Alex'));
    await saveLocalRecord('trip',{name:'Next Dive',planTeam:[{personId:p.id,role:'Buddy'}]});
    await expect(deletePerson(p.id)).rejects.toThrow(/Plan/i);
    expect(await listPeople()).toHaveLength(1);
  });
});

describe('atomic server deletion constraints',()=>{
  it('blocks stale Operator deletion when an explicit Person or entity relation exists',()=>{
    const db=new DatabaseSync(':memory:');
    try{
      db.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY,user_id TEXT,kind TEXT,data_json TEXT,deleted_at INTEGER)');
      const add=db.prepare('INSERT INTO dive_records VALUES (?,?,?,?,NULL)');
      add.run('centre','owner','operator','{}');add.run('boat','owner','operator','{}');
      add.run('person-link','owner','person-operator-link',JSON.stringify({personId:'p',operatorId:'centre',role:'Guide'}));
      add.run('entity-link','owner','operator-operator-link',JSON.stringify({fromOperatorId:'centre',toOperatorId:'boat',relationType:'operates'}));
      const sql='UPDATE dive_records SET deleted_at=1 WHERE id=? AND user_id=?'+constraints.OPERATOR_DELETE_CONSTRAINT;
      const args=['centre','owner','owner','centre','centre','owner','centre','owner','centre','centre'].slice(0,(sql.match(/\?/g)||[]).length);
      expect(db.prepare(sql).run(...args).changes).toBe(0);
    }finally{db.close();}
  });
});
