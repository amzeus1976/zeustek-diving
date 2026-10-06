import {describe,expect,it} from 'vitest';
import {gzipSync,strToU8} from 'fflate';
import {packConditionsRecord,unpackConditionsRecord} from '../lib/weather/conditions-storage';
import {planTextFromPlain,PLAN_TEXT_FIELDS} from '../lib/planning/formatted-text';
const readings=Array.from({length:3000},(_,i)=>({id:`reading-${i}`,metric:i%2?'wave-height':'air-temperature',value:i%20,units:i%2?'m':'°C',provider:'fixture-weather',attribution:'Fixture source — no real observation',classification:'forecast',validAt:`2026-10-11T${String(i%24).padStart(2,'0')}:00:00Z`,resolution:'hourly forecast',retrievedAt:'2026-10-04T12:00:00Z',latitude:55,longitude:-1,depth:{kind:'surface'},status:'usable'}));
const snapshot={version:1,request:{siteId:'fixture-site',date:'2026-10-11',time:'12:00',provider:'fixture-weather'},readings,diagnostics:[]};
const plan={entityId:'fixture-plan',name:'Owner-entered plan',notes:'Owner-entered text 🌊 海',conditions:{weather:'Saved conditions',conditionsV1:snapshot}};
describe('Lossless bounded saved Plan conditions',()=>{
 it('fits high-entropy CJK text using the API character metric and rejects forged plane-packet lengths and padding',()=>{
  let seed=123456789;const text=Array.from({length:185000},()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return String.fromCharCode(0x4e00+((seed>>>0)%20992));}).join('');
  const dive={notes:'Created from Plan',editorFields:'q'.repeat(16000),originatingPlanRevision:{snapshot:{record:{entityId:'plan',aim:text,equipmentIds:['equipment']}}}};
  const packed=packConditionsRecord('dive',dive);expect(JSON.stringify(packed).length).toBeLessThan(200000);expect(unpackConditionsRecord('dive',JSON.parse(JSON.stringify(packed)))).toEqual(dive);
  const source=packed.originatingPlanRevision.snapshot.record as unknown as Record<string,unknown>,packet=source.planTextPacked as Record<string,unknown>;expect(packet.encoding).toBe('gzip-utf16planes-unicode15');
  for(const replacement of [{...packet,compressedBytes:9000000},{...packet,compressedBytes:Number(packet.compressedBytes)-1},{...packet,jsonBytes:100},{...packet,body:String(packet.body)+'a'},{...packet,body:String(packet.body).slice(0,-1)+'\u8fff'}]){const broken=structuredClone(packed);(broken.originatingPlanRevision.snapshot.record as unknown as Record<string,unknown>).planTextPacked=replacement;expect(()=>unpackConditionsRecord('dive',broken)).toThrow(/conditions/i);}
 });
 it('packs incompressible non-narrative source text without base64 expansion and preserves strict decoding bounds',()=>{
  let seed=123456789;const text=Array.from({length:185000},()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[(seed>>>0)%64];}).join('');
  for(const path of ['aim','emergency.notes']){
   const source:Record<string,unknown>={entityId:'plan',equipmentIds:['equipment'],planTeam:[{personId:'person'}]};const [parent,key]=path.split('.');if(key)source[parent!]={[key]:text};else source[parent!]=text;
   const dive={notes:'Created from Plan',editorFields:'q'.repeat(16000),originatingPlanRevision:{snapshot:{record:source}}};
   const packed=packConditionsRecord('dive',dive);expect(JSON.stringify(packed).length).toBeLessThan(200000);expect(unpackConditionsRecord('dive',JSON.parse(JSON.stringify(packed)))).toEqual(dive);
   const packet=packed.originatingPlanRevision.snapshot.record.planTextPacked as Record<string,unknown>;expect(packet.encoding).toBe('gzip-unicode8');
   for(const replacement of [{...packet,body:String(packet.body)+'a'},{...packet,jsonBytes:100},{...packet,encoding:'arbitrary'}]){const invalid=structuredClone(packed);invalid.originatingPlanRevision.snapshot.record.planTextPacked=replacement;expect(()=>unpackConditionsRecord('dive',invalid)).toThrow(/conditions/i);}
  }
 });
 it('validates generalized note references, bounds expansion and reads legacy prefix packets',()=>{
  const record={originatingPlanRevision:{snapshot:{record:{notes:'legacy',humanFactors:{stopAbortCriteria:['Exact 🌊']}}}}};
  expect(unpackConditionsRecord('dive',{...record,notesFromPlan:{version:1,suffix:' suffix'}})).toHaveProperty('notes','legacy suffix');
  expect(unpackConditionsRecord('dive',{...record,notesFromPlan:{version:2,parts:['Before ',{field:'humanFactors.stopAbortCriteria',index:0},' after']}})).toHaveProperty('notes','Before Exact 🌊 after');
  for(const parts of [[{field:'equipmentIds',index:0}],[{field:'notes',index:0}],[{field:'humanFactors.stopAbortCriteria',index:-1}],[{field:'humanFactors.stopAbortCriteria',index:9}],[{field:'notes',hidden:'id'}]])expect(()=>unpackConditionsRecord('dive',{...record,notesFromPlan:{version:2,parts}})).toThrow(/conditions/i);
  const large={originatingPlanRevision:{snapshot:{record:{notes:'x'.repeat(100000)}}},notesFromPlan:{version:2,parts:Array.from({length:51},()=>({field:'notes'}))}};expect(()=>unpackConditionsRecord('dive',large)).toThrow(/conditions/i);
 });
 it('packs every supported long-text path near the whole-record boundary while retaining linked IDs',()=>{
  const arrays=new Set(['goals','secondaryObjectives',...['keyRisks','mitigations','pressures','stopAbortCriteria','teamConcerns'].map(key=>'humanFactors.'+key)]);
  for(const path of [...PLAN_TEXT_FIELDS,'objective','humanFactors.objective']){
   const source:Record<string,unknown>={entityId:'plan',name:'Boundary',equipmentIds:['equipment'],planTeam:[{personId:'person'}],gasPlanId:'gas',emergency:{oxygenTrainedPersonIds:['person']}};
   const value=arrays.has(path)?['  '+'x'.repeat(185000)+'  ','','🌊']: '  '+'x'.repeat(185000)+'  ',[parent,key]=path.split('.');
   if(key)source[parent!]={...source[parent!] as Record<string,unknown>,[key]:value};else source[parent!]=value;
   const dive={notes:'Created from Plan',editorFields:'q'.repeat(16000),originatingPlanRevision:{snapshot:{version:1,accountId:'owner',record:source}}};
   expect(JSON.stringify(source).length).toBeLessThan(200000);expect(JSON.stringify(dive).length).toBeGreaterThan(200000);
   const packed=packConditionsRecord('dive',dive);expect(JSON.stringify(packed).length).toBeLessThan(200000);expect(unpackConditionsRecord('dive',packed)).toEqual(dive);
   expect(packed.originatingPlanRevision.snapshot.record).toMatchObject({equipmentIds:['equipment'],planTeam:[{personId:'person'}],gasPlanId:'gas',emergency:{oxygenTrainedPersonIds:['person']}});
  }
 });
 it('deduplicates incompressible repeated Plan notes and leaves canonical references visible in stored Dive snapshots',()=>{
  let seed=123456789;const notes=Array.from({length:100000},()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[(seed>>>0)%64];}).join('');
  const source={entityId:'plan',notes,siteId:'site',equipmentIds:['equipment'],planTeam:[{personId:'person'}],gasPlanId:'gas'};
  const dive={notes:notes+'\n\nCreated from plan',originatingPlanId:'plan',originatingPlanRevision:{eventId:'event',recordHash:'exact-source-hash',modifiedAt:'stamp',snapshot:{version:1,accountId:'owner',record:source}}};
  expect(JSON.stringify(dive).length).toBeGreaterThan(200000);const packed=packConditionsRecord('dive',dive);
  expect(JSON.stringify(packed).length).toBeLessThan(200000);expect(unpackConditionsRecord('dive',packed)).toEqual(dive);
  expect(packed.originatingPlanRevision.snapshot.record).toMatchObject({entityId:'plan',siteId:'site',equipmentIds:['equipment'],planTeam:[{personId:'person'}],gasPlanId:'gas'});
 });
 it('packs source weather and long text without mutating an immutable full Plan snapshot',()=>{
  const source={...plan,notes:'海🌊'.repeat(23000)},dive={notes:source.notes+'\n\nCreated from plan',originatingPlanRevision:{eventId:'event',recordHash:'exact-source-hash',snapshot:{version:1,accountId:'owner',record:source}}};
  const initial=JSON.stringify(dive),packed=packConditionsRecord('dive',dive);expect(JSON.stringify(packed).length).toBeLessThan(200000);
  expect(unpackConditionsRecord('dive',packed)).toEqual(dive);expect(JSON.stringify(dive)).toBe(initial);expect(packConditionsRecord('dive',packed)).toEqual(packed);
 });
 it('rejects corrupt, conflicting and forged packed source text and invalid note references',()=>{
  const source={entityId:'plan',notes:'x'.repeat(100000)},dive={notes:source.notes,originatingPlanRevision:{snapshot:{version:1,accountId:'owner',record:source}}};
  const packed=packConditionsRecord('dive',dive) as unknown as {originatingPlanRevision:{snapshot:{record:Record<string,unknown>}},notesFromPlan:unknown};
  const body=packed.originatingPlanRevision.snapshot.record.planTextPacked as Record<string,unknown>;
  for(const replacement of [{...body,jsonBytes:90000000},{...body,body:'invalid'},{...body,jsonBytes:100}]){
   const broken=structuredClone(packed);broken.originatingPlanRevision.snapshot.record.planTextPacked=replacement;expect(()=>unpackConditionsRecord('dive',broken)).toThrow(/conditions/i);
  }
  const conflicting=structuredClone(packed);conflicting.originatingPlanRevision.snapshot.record.notes='conflict';expect(()=>unpackConditionsRecord('dive',conflicting)).toThrow(/conditions/i);
  expect(()=>unpackConditionsRecord('dive',{notesFromPlan:{version:1,suffix:'x'}})).toThrow(/conditions/i);
  const injected=structuredClone(packed);const json=strToU8(JSON.stringify({notes:'x',equipmentIds:['hidden']}));injected.originatingPlanRevision.snapshot.record.planTextPacked={version:1,encoding:'gzip-base64',jsonBytes:json.length,body:btoa(String.fromCharCode(...gzipSync(json)))};expect(()=>unpackConditionsRecord('dive',injected)).toThrow(/conditions/i);
  const badStyle=strToU8(JSON.stringify({textFormatting:{equipmentIds:['hidden']}}));injected.originatingPlanRevision.snapshot.record.planTextPacked={version:1,encoding:'gzip-base64',jsonBytes:badStyle.length,body:btoa(String.fromCharCode(...gzipSync(badStyle)))};expect(()=>unpackConditionsRecord('dive',injected)).toThrow(/conditions/i);
 });
 it('never hides unsupported metadata references or drops legacy non-string notes while packing another text field',()=>{
  const source={entityId:'plan',notes:'x'.repeat(100000),textFormatting:{equipmentIds:['equipment']}},dive={originatingPlanRevision:{snapshot:{version:1,accountId:'owner',record:source}}};
  const packed=packConditionsRecord('dive',dive);expect(packed.originatingPlanRevision.snapshot.record.textFormatting).toEqual(source.textFormatting);expect(unpackConditionsRecord('dive',packed)).toEqual(dive);
  const legacy={originatingPlanRevision:{snapshot:{version:1,accountId:'owner',record:{entityId:'plan',notes:['Legacy shape'],textFormatting:{notes:planTextFromPlain('x'.repeat(100000))}}}}};
  const legacyPacked=packConditionsRecord('dive',legacy);expect(legacyPacked.originatingPlanRevision.snapshot.record.notes).toEqual(['Legacy shape']);expect(unpackConditionsRecord('dive',legacyPacked)).toEqual(legacy);
 });
 it('fits a 3000-reading forecast inside the existing record limit and reconstructs every reading and owner field',()=>{
  const original=JSON.stringify(plan);expect(original.length).toBeGreaterThan(200000);
  const packed=packConditionsRecord('trip',plan);expect(JSON.stringify(packed).length).toBeLessThan(200000);
  expect(packed.conditions).not.toHaveProperty('conditionsV1');expect(unpackConditionsRecord('trip',packed)).toEqual(plan);expect(JSON.stringify(plan)).toBe(original);
 });
 it('leaves existing small plans and unrelated canonical record kinds unchanged',()=>{
  const small={...plan,conditions:{conditionsV1:{...snapshot,readings:readings.slice(0,2)}}};
  expect(packConditionsRecord('trip',small)).toBe(small);expect(unpackConditionsRecord('trip',small)).toBe(small);
  expect(packConditionsRecord('person',plan)).toBe(plan);
 });
 it('is idempotent across backup/restore and never packs owner notes or hidden records',()=>{
  const packed=packConditionsRecord('trip',plan);expect(packConditionsRecord('trip',packed)).toEqual(packed);
  const backup=JSON.parse(JSON.stringify(packed));expect(unpackConditionsRecord('trip',backup)).toEqual(plan);expect(packed.notes).toBe(plan.notes);
 });
 it('rejects corrupt, conflicting, unsupported and excessive packed input before accepting storage',()=>{
  const packed=packConditionsRecord('trip',plan);const encoded=(packed.conditions as unknown as {conditionsV1Packed:{version:number;encoding:string;jsonBytes:number;body:string}}).conditionsV1Packed;
  for(const replacement of [{...encoded,version:2},{...encoded,jsonBytes:90000000},{...encoded,body:'invalid'},{...encoded,jsonBytes:encoded.jsonBytes-1}])expect(()=>unpackConditionsRecord('trip',{...packed,conditions:{conditionsV1Packed:replacement}})).toThrow(/conditions/i);
  expect(()=>unpackConditionsRecord('trip',{...packed,conditions:{conditionsV1:snapshot,conditionsV1Packed:encoded}})).toThrow(/conditions/i);
 });
 it('bounds decoded allocation against a forged compressed-size declaration',()=>{
  const bomb=gzipSync(strToU8(JSON.stringify({version:1,readings:[{value:'x'.repeat(6000000)}]})));const body=btoa(String.fromCharCode(...bomb));
  expect(()=>unpackConditionsRecord('trip',{conditions:{conditionsV1Packed:{version:1,encoding:'gzip-base64',jsonBytes:100,body}}})).toThrow(/conditions/i);
 });
});
