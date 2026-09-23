import {describe,it,expect} from 'vitest';
import {safeDiagnostic,retainDiagnostics,diagnosticCsv} from '../lib/admin/diagnostics';
import {applySettingsPatch} from '../lib/admin/configuration';
const now='2026-09-23T12:00:00Z';
describe('T14 diagnostic privacy and retention',()=>{
 it('constructs a strict safe record and never carries raw error, stack, URLs, contacts or tokens',()=>{const row=safeDiagnostic({code:'client-error',time:now,detail:{count:2,token:'SECRET'},message:'PRIVATE_EMAIL@example.com',stack:'SECRET URL',subject:'PRIVATE_NAME'});expect(JSON.stringify(row)).not.toMatch(/SECRET|PRIVATE/);expect(row?.message).toBe('A client error occurred. Reopen the affected workspace; unsaved changes may need review.');expect(row?.detail).toEqual({count:2});});
 it('rejects invented message codes and non-numeric detail values',()=>{expect(safeDiagnostic({code:'PRIVATE_MESSAGE',time:now})).toBeNull();expect(safeDiagnostic({code:'sync-error',time:now,detail:{count:'SECRET',durationMs:-1,pending:4}})?.detail).toEqual({pending:4});});
 it('caps retention to 2000 recent entries and drops stale/invalid rows',()=>{const rows=Array.from({length:2200},(_,i)=>({...safeDiagnostic({code:'operation-complete',time:now}),id:String(i)}));rows.push({...rows[0]!,time:'2025-01-01'});const kept=retainDiagnostics(rows,new Date(now).getTime());expect(kept).toHaveLength(2000);expect(kept.some(row=>row.time.startsWith('2025'))).toBe(false);});
 it('exports only safe values even when passed tampered stored records',()=>{const csv=diagnosticCsv([{code:'sync-error',time:now,message:'=SECRET',stack:'PRIVATE',detail:{count:1}}]);expect(csv).not.toMatch(/SECRET|PRIVATE/);expect(csv).toContain('Sync');});
});
describe('T14 configuration ownership',()=>{
 const current={selectedAwards:['divesLogged'],maxAwards:8,customGoogleMapEmbedUrl:'old',newsletterEmail:'fixture@example.com',weatherConditions:{version:1},professionalGuides:{fixture:{step:3}},unknownFutureField:{kept:true}};
 it('preserves every unrelated setting when changing a domain',()=>{const next=applySettingsPatch(current,'insights',{selectedAwards:[],maxAwards:4});expect(next).toEqual({...current,selectedAwards:[],maxAwards:4});expect(current.selectedAwards).toEqual(['divesLogged']);});
 it('normalizes map links and rejects fields owned by another domain',()=>{expect(applySettingsPatch(current,'maps',{customGoogleMapEmbedUrl:'https://www.google.com/maps/d/viewer?mid=abcdefghijklm'}).customGoogleMapEmbedUrl).toContain('/embed?mid=abcdefghijklm');expect(()=>applySettingsPatch(current,'insights',{newsletterEmail:'other@example.com'})).toThrow(/domain/);});
 it('rejects invalid award cap, inbox and first-Dive number without truncating values',()=>{expect(()=>applySettingsPatch(current,'insights',{maxAwards:3})).toThrow();expect(()=>applySettingsPatch(current,'news',{newsletterEmail:'bad'})).toThrow();expect(()=>applySettingsPatch(current,'records',{diveNumberStart:1.5})).toThrow();});
});
