import { describe,it,expect } from 'vitest';
import { unzipSync,strFromU8 } from 'fflate';
import { buildDiverSummary,summaryText,summaryCsv,summaryJson } from '../lib/exports/diver-summary';
import { renderSummaryPdf,renderSummaryDocx,collectSummaryImages } from '../lib/exports/summary-documents';
import { exportableCloudRows } from '../lib/server/backup-boundary';
const options={summary:true,types:true,deep:true,certifications:true,equipment:true,logs:true,certificationNumbers:false};
const input={name:'Fixture Diver',generatedAt:'2026-09-23T12:00:00Z',options,
 dives:[{entityId:'private-dive',diveNumber:7,date:'2026-09-22',site:'Fixture Bay',maxDepthM:24,totalElapsedMin:45,bottomTimeMin:40,notes:'PRIVATE_DIVE_NOTE',diveTypes:['Shore']}],
 certifications:[{agency:'Fixture Agency',certification:'Advanced fixture',certificationNumber:'PRIVATE_CERT_NUMBER',issuedAt:'2026-01-01',notes:'PRIVATE_CERT_NOTE',entityId:'private-cert'}],
 equipment:[{name:'Fixture regulator',category:'Regulator',manufacturer:'Fixture maker',model:'Model X',serialNumber:'PRIVATE_SERIAL',notes:'PRIVATE_GEAR_NOTE',entityId:'private-gear'}]};
describe('T14 privacy-aware diver documents',()=>{
 it('projects only selected fields without record identifiers, notes or serials',()=>{const dto=buildDiverSummary(input);const json=summaryJson(dto);expect(json).toContain('Fixture regulator');expect(json).toContain('45 minutes');expect(json).not.toMatch(/PRIVATE_|private-/);});
 it('includes certification numbers only after a separate owner selection',()=>{expect(summaryText(buildDiverSummary({...input,options:{...options,certificationNumbers:true}}))).toContain('PRIVATE_CERT_NUMBER');});
 it('omits excluded sections consistently from every fallback',()=>{const dto=buildDiverSummary({...input,options:{...options,equipment:false,logs:false,certifications:false}});for(const value of [summaryText(dto),summaryCsv(dto),summaryJson(dto)])expect(value).not.toMatch(/Fixture regulator|Fixture Bay|Advanced fixture/);});
 it('neutralizes formula cells including leading whitespace and quotes newlines',()=>{const dto=buildDiverSummary({...input,name:'  =HYPERLINK("bad")',equipment:[{name:'@SUM(1)',category:'Regulator'}]});const csv=summaryCsv(dto);expect(csv).toContain(`"'  =HYPERLINK(""bad"")"`);expect(csv).toContain(`"'@SUM(1)`);});
 it('builds actual PDF pages containing selected equipment and dive data',async()=>{const bytes=await renderSummaryPdf(buildDiverSummary(input));const raw=new TextDecoder().decode(bytes);expect(raw.startsWith('%PDF-')).toBe(true);expect(raw).toContain('Fixture regulator');expect(raw).toContain('Fixture Bay');expect(raw).not.toContain('PRIVATE_');});
 it('builds actual DOCX XML with the same selected equipment and dive data',async()=>{const bytes=await renderSummaryDocx(buildDiverSummary(input));const files=unzipSync(bytes);const xml=strFromU8(files['word/document.xml']!);expect(xml).toContain('Fixture regulator');expect(xml).toContain('Fixture Bay');expect(xml).not.toContain('PRIVATE_');});
 it('keeps document text available when an image resolver fails or returns no image',async()=>{const images=await collectSummaryImages([{label:'Front',load:async()=>{throw new Error('private image error')}},{label:'Back',load:async()=>null}]);expect(images.images).toEqual([]);expect(images.warnings).toEqual(['Front: image unavailable; text retained.','Back: image unavailable; text retained.']);expect((await renderSummaryDocx(buildDiverSummary(input),images.images)).length).toBeGreaterThan(1000);});
 it('paginates long descriptions without losing the final text',async()=>{const dto=buildDiverSummary({...input,equipment:[{name:'Fixture '.repeat(400)+'END_OF_GEAR',category:'Regulator'}]});const bytes=await renderSummaryPdf(dto);expect(new TextDecoder().decode(bytes)).toContain('END_OF_GEAR');});
});
describe('T14 cloud backup boundary',()=>{
 it('excludes credentials, server metadata and future unknown kinds while preserving canonical bytes',()=>{const rows=[{kind:'dive',id:'fixture',dataJson:'{"notes":"private owner backup"}'},{kind:'gmail-connection-secret',dataJson:'ENCRYPTED_TOKEN'},{kind:'future-server-secret',dataJson:'SECRET'},{kind:'gmail-news',dataJson:'cached story'}];expect(exportableCloudRows(rows)).toEqual([rows[0],rows[3]]);expect(rows).toHaveLength(4);});
});
