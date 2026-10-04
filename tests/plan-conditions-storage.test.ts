import {describe,expect,it} from 'vitest';
import {gzipSync,strToU8} from 'fflate';
import {packConditionsRecord,unpackConditionsRecord} from '../lib/weather/conditions-storage';
const readings=Array.from({length:3000},(_,i)=>({id:`reading-${i}`,metric:i%2?'wave-height':'air-temperature',value:i%20,units:i%2?'m':'°C',provider:'fixture-weather',attribution:'Fixture source — no real observation',classification:'forecast',validAt:`2026-10-11T${String(i%24).padStart(2,'0')}:00:00Z`,resolution:'hourly forecast',retrievedAt:'2026-10-04T12:00:00Z',latitude:55,longitude:-1,depth:{kind:'surface'},status:'usable'}));
const snapshot={version:1,request:{siteId:'fixture-site',date:'2026-10-11',time:'12:00',provider:'fixture-weather'},readings,diagnostics:[]};
const plan={entityId:'fixture-plan',name:'Owner-entered plan',notes:'Owner-entered text 🌊 海',conditions:{weather:'Saved conditions',conditionsV1:snapshot}};
describe('Lossless bounded saved Plan conditions',()=>{
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
