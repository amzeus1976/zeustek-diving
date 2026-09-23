import {describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import type {CertificationRecord,PersonRecord,EquipmentRecord,Stored} from '../lib/offline/dive-planning';
import {derivePersonProfileStats,refreshPersonDerivedStats} from '../lib/offline/people-profiles';
import {loadoutSlotChoices} from '../lib/gear/loadout-slot-choices';
import {LOADOUT_SLOT_DEFINITIONS} from '../lib/offline/loadouts-gas';
import {bookingRecordLinks} from '../lib/planning/booking-record-links';
import {ATOMIC_BUDDY_LINK_SQL,buddyLinkRequest,buddyInitials} from '../lib/people/buddy-links';
const person=(patch:Partial<PersonRecord>={})=>({name:'Grace Buddy',role:'buddy',highestQualification:'',agency:'',membershipNumber:'',email:'',phone:'',emergencyContact:'',notes:'',createdAt:'',modifiedAt:'',entityId:'p',...patch}) as PersonRecord&{entityId:string};
const cert=(patch:Partial<CertificationRecord>={})=>({agency:'Test',certification:'Core Diver',level:'',certificationNumber:'',issuedAt:'2026-01-01',expiresAt:'',instructor:'',notes:'',imageKey:'',imageName:'',createdAt:'',modifiedAt:'',courseType:'core',...patch}) as CertificationRecord;
describe('T14 Stage4 evidence and destinations',()=>{
  it('associates unassigned legacy certificates only with the owner, never the named instructor',()=>{
    const certificates=[cert({certification:'Owner cert',instructorId:'p'}),cert({certification:'Buddy cert',personId:'p'})];
    expect(derivePersonProfileStats(person(),[],certificates).highestRecreationalCertification).toBe('Buddy cert');
    expect(derivePersonProfileStats(person({roles:{ownerProfile:true}}),[],[certificates[0]!]).highestKnownQualification).toBe('Owner cert');
    expect(derivePersonProfileStats(person({entityId:'q'} as Partial<PersonRecord>),[],certificates).highestRecreationalCertification).toBe('');
  });
  it('does not let a recent specialty or display-award priority displace core qualification evidence',()=>{
    const stats=derivePersonProfileStats(person({roles:{ownerProfile:true}}),[],[
      cert({certification:'Advanced Open Water',qualificationRank:2}),
      cert({certification:'Open Water',qualificationRank:1,awardPriority:99,issuedAt:'2026-09-01'}),
      cert({certification:'Underwater Photography',courseType:'specialty',awardPriority:100,issuedAt:'2026-09-02'}),
    ]);
    expect(stats.highestRecreationalCertification).toBe('Advanced Open Water');
    expect(stats.highestKnownQualification).toBe('Advanced Open Water');
  });
  it('derives allowed depth only from explicit associated evidence, separately from achieved depth and overrides',()=>{
    const owner=person({roles:{ownerProfile:true},maxAllowedDepthM:25,maxAllowedDepthSource:'owner-entered',manualOverrideFields:['maxAllowedDepthM']});
    const derived=derivePersonProfileStats(owner,[],[cert({certifiedDepthM:30}),cert({personId:'someone-else',certifiedDepthM:70})]);
    expect(derived.maxAllowedDepthM).toBe(30);expect(derived.maxDepthM).toBeNull();
    expect(refreshPersonDerivedStats(owner,derived).maxAllowedDepthM).toBe(25);
    expect(derivePersonProfileStats(owner,[],[cert({certification:'Deep Diver'})]).maxAllowedDepthM).toBeNull();
  });
  it('limits Other to uncovered categories while retaining already-selected legacy items',()=>{
    const gear=[{entityId:'mask',name:'Mask',category:'Mask'},{entityId:'tool',name:'Repair tool',category:'Other'},{entityId:'computer',name:'Computer',category:'Computer'},{entityId:'old',name:'Old tool',category:'Other',retired:true}] as Stored<EquipmentRecord>[];
    const other=LOADOUT_SLOT_DEFINITIONS.find(row=>row.key==='other')!;
    expect(loadoutSlotChoices(other,gear).map(row=>row.entityId)).toEqual(['tool']);
    expect(loadoutSlotChoices(other,gear,['mask','old']).map(row=>row.entityId)).toEqual(['mask','tool','old']);
  });
  it('preserves legacy owner-entered qualification text until replacement is explicitly chosen',()=>{
    const legacy=person({highestQualification:'Recorded instructor evidence',highestTechnicalCertification:'Manual tec evidence'});
    const refreshed=refreshPersonDerivedStats(legacy,derivePersonProfileStats(legacy,[],[]));
    expect(refreshed.highestKnownQualification).toBe('Recorded instructor evidence');
    expect(refreshed.highestTechnicalCertification).toBe('Manual tec evidence');
  });
  it('preserves explicit owner-entered sources even when the legacy override list is absent',()=>{
    const entered=person({highestKnownQualification:'My verified qualification',profileValueSources:{highestKnownQualification:'owner-entered'}});
    const derived=derivePersonProfileStats(entered,[],[]);
    expect(refreshPersonDerivedStats(entered,derived).highestKnownQualification).toBe('My verified qualification');
    expect(refreshPersonDerivedStats(entered,derived,true).highestKnownQualification).toBe('');
  });
  it('omits absent calendar associations and creates exact canonical destinations',()=>{
    expect(bookingRecordLinks({})).toEqual([]);
    expect(bookingRecordLinks({linkedTripId:'t /1',linkedDivePlanId:'dp',linkedGasPlanId:'gp'}).map(row=>row.href)).toEqual([
      '/?section=Trips&recordId=t+%2F1&tripId=t+%2F1','/?section=Dive+Plans&recordId=dp&planId=dp','/?section=Gas+Planning&recordId=gp&gasPlanId=gp',
    ]);
  });
  it('deduplicates a bounded, explicitly selected buddy-link request and formats real initials',()=>{
    const rows=[{entityId:'a',modifiedAt:'2026-09-01T00:00:00.000Z'}];
    expect(buddyLinkRequest('p',['a','a'],rows).dives).toHaveLength(1);
    expect(()=>buddyLinkRequest('p',['missing'],rows)).toThrow(/refresh|available/i);
    expect(()=>buddyLinkRequest('p',[],rows)).toThrow(/select/i);
    expect(buddyInitials('Grace Buddy')).toBe('G.B.');expect(buddyInitials('李')).toBe('李.');
  });
});
describe('T14 explicit historical linking is atomic and owner-scoped',()=>{
  const setup=()=>{
    const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE dive_records(id TEXT PRIMARY KEY,user_id TEXT,kind TEXT,data_json TEXT,created_at INTEGER,updated_at INTEGER,deleted_at INTEGER)');
    const insert=db.prepare('INSERT INTO dive_records VALUES (?,?,?,?,0,1,NULL)');
    insert.run('p','owner','person','{}');insert.run('a','owner','dive','{"notes":"preserve","buddyIds":["old"],"diveTeamIds":["old"]}');insert.run('b','owner','dive','{}');
    return db;
  };
  it('links every selected Dive in one statement, preserving other facts and no duplicate IDs',()=>{
    const db=setup();try{
      const expected=JSON.stringify([{id:'a',revision:1},{id:'b',revision:1}]);
      expect(db.prepare(ATOMIC_BUDDY_LINK_SQL).run(expected,'owner','p',2,2).changes).toBe(2);
      const a=JSON.parse(String(db.prepare('SELECT data_json FROM dive_records WHERE id=?').get('a')!.data_json));
      expect(a).toEqual({notes:'preserve',buddyIds:['old','p'],diveTeamIds:['old','p']});
      expect(db.prepare(ATOMIC_BUDDY_LINK_SQL).run(JSON.stringify([{id:'a',revision:2}]),'owner','p',3,1).changes).toBe(1);
      expect(JSON.parse(String(db.prepare('SELECT data_json FROM dive_records WHERE id=?').get('a')!.data_json)).buddyIds).toEqual(['old','p']);
    }finally{db.close();}
  });
  it.each(['stale','foreign','missing person'])('makes no partial changes on %s input',kind=>{
    const db=setup();try{
      if(kind==='foreign')db.prepare('UPDATE dive_records SET user_id=? WHERE id=?').run('other','b');
      const before=db.prepare('SELECT * FROM dive_records ORDER BY id').all();
      const expected=JSON.stringify([{id:'a',revision:1},{id:'b',revision:kind==='stale'?0:1}]);
      expect(db.prepare(ATOMIC_BUDDY_LINK_SQL).run(expected,'owner',kind==='missing person'?'missing':'p',2,2).changes).toBe(0);
      expect(db.prepare('SELECT * FROM dive_records ORDER BY id').all()).toEqual(before);
    }finally{db.close();}
  });
});
