import 'fake-indexeddb/auto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore} from '../lib/offline/dive-store';
import {deleteOperator,listOperators,saveOperator,savePerson,listPeople,type PersonRecord} from '../lib/offline/dive-planning';
import {filterDiveCentres,linkedOperatorPeople,safeOperatorUrl,normaliseOperatorDraft,OPERATOR_TYPES} from '../lib/operators/dive-centres';
import {OPERATOR_DELETE_CONSTRAINT} from '../lib/operators/operator-dependencies';
import {recordIdentity} from '../lib/record-identity';

beforeEach(async()=>{
  vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());
  configureDiveStore('t14-operators');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();
});
afterEach(()=>vi.unstubAllGlobals());
const legacy={name:'Legacy Dive Centre',location:'Port',website:'https://example.invalid',notes:'Retain'};
const person=(refs:Partial<PersonRecord>={})=>({name:'Instructor One',role:'instructor' as const,agency:'Agency',membershipNumber:'',highestQualification:'',email:'',phone:'',emergencyContact:'',notes:'',...refs});

describe('T14 canonical operators',()=>{
  it('round trips legacy and additive organisation fields using the same operator ID and kind',async()=>{
    const {id}=await saveOperator(legacy);
    await saveOperator({...legacy,entityId:id,operatorType:'dive-centre',agencies:['Agency'],services:{nitroxFills:true},bookingUrl:'https://example.invalid/book',active:true});
    zeustekDb.close();await zeustekDb.open();
    expect(await listOperators()).toEqual([expect.objectContaining({entityId:id,...legacy,operatorType:'dive-centre',services:{nitroxFills:true}})]);
    expect((await zeustekDb.entities.toArray()).map(row=>row.entityType)).toEqual(['operator']);
  });
  it('finds linked people through either existing reference without duplicating a person',()=>{
    const people=[{...person({operatorId:'o',currentDiveOperatorId:'o'}),entityId:'p',createdAt:'',modifiedAt:''},{...person({operatorId:'another'}),entityId:'q',createdAt:'',modifiedAt:''}];
    expect(linkedOperatorPeople('o',people).map(p=>p.entityId)).toEqual(['p']);
  });
  it('shows explicit links alongside legacy links without duplicating the same Person',()=>{
    const people=[
      {...person({operatorId:'o'}),entityId:'legacy',createdAt:'',modifiedAt:''},
      {...person(),entityId:'new',createdAt:'',modifiedAt:''},
    ];
    const links=[{entityId:'link-1',personId:'legacy',operatorId:'o',role:'Instructor',active:true},{entityId:'link-2',personId:'new',operatorId:'o',role:'Guide',active:true}];
    expect(linkedOperatorPeople('o',people,links).map(p=>p.entityId)).toEqual(['legacy','new']);
  });
  it('distinguishes unclassified operators from explicitly Other records',()=>{
    const rows=[{...legacy,entityId:'unset',createdAt:'',modifiedAt:''},{...legacy,name:'Explicit Other',operatorType:'other' as const,entityId:'other',createdAt:'',modifiedAt:''}];
    expect(filterDiveCentres(rows,{type:'unclassified'}).map(r=>r.entityId)).toEqual(['unset']);
    expect(filterDiveCentres(rows,{type:'other'}).map(r=>r.entityId)).toEqual(['other']);
  });
  it('permits distinct vessels sharing an operator website while detecting same-name same-location duplicates',()=>{
    const first={name:'MV Alpha',location:'Port A',website:'https://fleet.example.invalid'};
    const second={name:'MV Beta',location:'Port A',website:'https://fleet.example.invalid'};
    expect(recordIdentity('operator',first)).not.toBe(recordIdentity('operator',second));
    expect(recordIdentity('operator',first)).toBe(recordIdentity('operator',{...first,website:'https://other.example.invalid'}));
  });
  it('offers distinct non-human entity types and requires a subtype for a new Other entity',()=>{
    const values=OPERATOR_TYPES.map(([key])=>key);
    expect(values).toEqual(expect.arrayContaining(['dive-centre','dive-boat','dive-resort','charter-operator','dive-school','dive-club','dive-shop','dive-operator','dive-accommodation','liveaboard']));
    expect(()=>normaliseOperatorDraft({...legacy,operatorType:'other'})).toThrow(/subtype/i);
    expect(normaliseOperatorDraft({...legacy,operatorType:'other',otherSubtype:'Underwater photographer collective'})).toMatchObject({otherSubtype:'Underwater photographer collective'});
  });
  it.each(['dive-centre','dive-resort','dive-boat','liveaboard'] as const)('persists a %s in canonical operator storage',async operatorType=>{
    const saved=await saveOperator({...legacy,name:`Fixture ${operatorType}`,operatorType});
    expect((await listOperators()).find(row=>row.entityId===saved.id)).toMatchObject({operatorType,name:`Fixture ${operatorType}`});
    expect((await zeustekDb.entities.get(`dive:t14-operators:${saved.id}`))?.entityType).toBe('operator');
  });
  it.each(['operatorId','currentDiveOperatorId'] as const)('blocks deletion for %s without changing either record',async key=>{
    const {id}=await saveOperator(legacy);await savePerson(person({[key]:id}));
    const before=JSON.stringify(await zeustekDb.entities.toArray());
    await expect(deleteOperator(id)).rejects.toThrow(/linked.*person|person.*linked/i);
    expect(JSON.stringify(await zeustekDb.entities.toArray())).toBe(before);expect(await listPeople()).toHaveLength(1);
  });
  it('deletes an unreferenced operator without deleting people',async()=>{
    const {id}=await saveOperator(legacy);await savePerson(person());await deleteOperator(id);
    expect(await listOperators()).toHaveLength(0);expect(await listPeople()).toHaveLength(1);
  });
  it('filters type, status, services and searchable contact fields without hiding legacy records by default',()=>{
    const rows=[{...legacy,entityId:'old',createdAt:'',modifiedAt:''},{...legacy,name:'Blue Centre',entityId:'blue',createdAt:'',modifiedAt:'',town:'Dover',operatorType:'dive-centre' as const,services:{nitroxFills:true},active:false}];
    expect(filterDiveCentres(rows,{})).toHaveLength(2);
    expect(filterDiveCentres(rows,{query:'dover',type:'dive-centre',service:'nitroxFills',status:'inactive'}).map(r=>r.entityId)).toEqual(['blue']);
  });
  it('validates location and safe links while preserving legacy fields',()=>{
    expect(safeOperatorUrl('javascript:alert(1)')).toBeNull();
    expect(safeOperatorUrl('example.org/book')).toBe('https://example.org/book');
    expect(()=>normaliseOperatorDraft({...legacy,latitude:95})).toThrow(/latitude/i);
    expect(normaliseOperatorDraft({...legacy,agencies:[' Agency ','Agency','']})).toMatchObject({...legacy,agencies:['Agency']});
  });
});

describe('T14 atomic cloud deletion constraint',()=>{
  it('prevents a stale-client deletion when a Person has since linked the operator',()=>{
    const db=new DatabaseSync(':memory:');
    try{
      db.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY,user_id TEXT,kind TEXT,data_json TEXT,deleted_at INTEGER)');
      const insert=db.prepare('INSERT INTO dive_records VALUES (?,?,?,?,NULL)');
      insert.run('o','owner','operator','{}');insert.run('p','owner','person',JSON.stringify({currentDiveOperatorId:'o'}));
      const remove=db.prepare('UPDATE dive_records SET deleted_at=1 WHERE id=? AND user_id=?'+OPERATOR_DELETE_CONSTRAINT);
      expect(remove.run('o','owner','owner','o','o').changes).toBe(0);
      expect(db.prepare('SELECT deleted_at FROM dive_records WHERE id=?').get('o')).toMatchObject({deleted_at:null});
      db.prepare('UPDATE dive_records SET data_json=? WHERE id=?').run('{}','p');
      expect(remove.run('o','owner','owner','o','o').changes).toBe(1);
    }finally{db.close();}
  });
});
