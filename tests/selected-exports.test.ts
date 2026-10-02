import {describe,it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {unzipSync,strFromU8} from 'fflate';
import {buildDiverSummary,summaryText,summaryCsv,summaryJson} from '../lib/exports/diver-summary';
import {renderSummaryPdf,renderSummaryDocx,collectSummaryImages} from '../lib/exports/summary-documents';
import {unsupportedSummaryGlyphs} from '../lib/exports/summary-font';
import {summaryCardGeometry,SummaryImageFailure,renderSummaryCard} from '../lib/exports/summary-card';

const options={summary:true,types:true,deep:true,certifications:true,equipment:true,logs:true,certificationNumbers:false};
const fixture={name:'Élodie Αθήνα 東京 Мария',generatedAt:'2026-10-02T12:00:00Z',options,
 dives:[{date:'2026-09-01',site:'東京湾',maxDepthM:20,bottomTimeMin:45,diveMode:'recreational',diveTypes:['Recreational','SHORE',' Shore ','shore']}],
 certifications:[{agency:'Fixture agency',certification:'Élodie – Αθήνα – 東京 – Мария',certificationNumber:'PRIVATE_NUMBER'}],
 equipment:[{name:'Régulateur',category:'Regulator',notes:'PRIVATE_NOTE',serialNumber:'PRIVATE_SERIAL'}]};
const fontData=new Uint8Array(readFileSync('public/fonts/summary/NotoSansJP-Regular.ttf'));
const latinFontData=new Uint8Array(readFileSync('public/fonts/summary/NotoSans-Regular.ttf'));

describe('selected export content and Unicode',()=>{
 it('counts each normalised mode/activity once per Dive without changing tags',()=>{const before=JSON.stringify(fixture);const dto=buildDiverSummary(fixture);expect(dto.sections.find(s=>s.title==='Dive types and activities')?.lines).toEqual(['Recreational: 1','Shore: 1']);expect(JSON.stringify(fixture)).toBe(before);});
 it('keeps all text fallbacks consistent and excludes private fields',()=>{const dto=buildDiverSummary(fixture);for(const output of [summaryText(dto),summaryCsv(dto),summaryJson(dto)]){expect(output).toContain(fixture.name);expect(output).toContain('東京湾');expect(output).not.toContain('PRIVATE_');}});
 it('covers accented Latin, Greek, Cyrillic, Japanese and subscripts',()=>{expect(unsupportedSummaryGlyphs('Élodie Αθήνα 東京 Мария O₂')).toEqual([]);expect(unsupportedSummaryGlyphs('🫠')).toEqual(['U+1FAE0']);});
 it('embeds a Unicode font and searchable Unicode mapping in PDF',async()=>{const bytes=await renderSummaryPdf(buildDiverSummary(fixture),[],{fontData,latinFontData});const pdf=new TextDecoder().decode(bytes);expect(pdf).toContain('/ToUnicode');expect(pdf).toContain('/FontFile2');expect(pdf).toMatch(/6771/i);expect(pdf).not.toContain('PRIVATE_');});
 it('embeds the licensed font in DOCX with the selected multilingual text',async()=>{const files=unzipSync(await renderSummaryDocx(buildDiverSummary(fixture),[],{fontData,latinFontData}));expect(Object.keys(files).some(name=>name.startsWith('word/fonts/')&&name.endsWith('.odttf'))).toBe(true);const xml=strFromU8(files['word/document.xml']!);expect(xml).toContain('東京湾');expect(xml).toContain('Élodie');expect(xml).toContain('w:eastAsia="Noto Sans JP"');expect(xml).not.toContain('PRIVATE_');expect(strFromU8(files['word/styles.xml']!)).toContain('Noto Sans JP');});
 it('reports unsupported PDF glyphs rather than silently dropping them',async()=>{await expect(renderSummaryPdf({...buildDiverSummary(fixture),title:'🫠'},[],{fontData,latinFontData})).rejects.toThrow(/U\+1FAE0/);});
 it('wraps long records across pages and preserves the final record without source changes',async()=>{const dto={format:'zeustek-diver-summary' as const,version:1 as const,title:'Long selected records',generatedAt:'2026-10-02',sections:[{title:'Long records',lines:[...Array.from({length:12},()=>('Long record '+ 'X'.repeat(600))), 'FINAL SELECTED RECORD']} ]};const before=JSON.stringify(dto);const bytes=await renderSummaryPdf(dto);const pdf=new TextDecoder().decode(bytes);expect((pdf.match(/\/Type \/Page\b/g)??[]).length).toBeGreaterThan(2);expect(pdf).toContain('FINAL SELECTED RECORD');expect(JSON.stringify(dto)).toBe(before);});
 it('keeps empty selections usable without including unselected content',async()=>{const dto=buildDiverSummary({...fixture,dives:[],certifications:[],equipment:[]});expect(summaryText(dto)).toContain('0 Dives');expect(summaryText(dto)).not.toContain('東京湾');expect((await renderSummaryDocx(dto,[],{fontData,latinFontData})).length).toBeGreaterThan(1000);});
});
describe('bounded card rendering stages',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('renders an already-resolved private image without fetching its temporary Blob URL',async()=>{
  const network=vi.fn(()=>{throw new TypeError('PRIVATE_TRANSPORT');});vi.stubGlobal('fetch',network);
  const drawImage=vi.fn();vi.stubGlobal('document',{createElement:()=>({getContext:()=>({fillRect:vi.fn(),drawImage}),toBlob:(callback:(blob:Blob)=>void)=>callback(new Blob(['rendered image']))})});
  const decoder=vi.fn(async()=>({naturalWidth:900,naturalHeight:600} as HTMLImageElement));
  const result=await renderSummaryCard({attachmentId:'private',zoom:1,x:50,y:50},async()=>'blob:local-private-image',decoder);
  expect(network).not.toHaveBeenCalled();expect(decoder).toHaveBeenCalledWith('blob:local-private-image');expect(drawImage).toHaveBeenCalledOnce();expect(result.bytes.length).toBeGreaterThan(0);
 });
 it('reports only bounded image stages without raw errors in diagnostics',async()=>{const result=await collectSummaryImages([{label:'Front',load:async()=>{throw new SummaryImageFailure('decode');}},{label:'Back',load:async()=>{throw new Error('SECRET_CONNECTION_PRIVATE_ATTACHMENT');}}]);expect(result.failures).toEqual({decode:1,unknown:1});expect(JSON.stringify(result)).not.toContain('SECRET_CONNECTION');});
 it('preserves crop aspect and focal position without editing its metadata',()=>{const crop={zoom:1.2,x:25,y:75};const before=JSON.stringify(crop);expect(summaryCardGeometry(900,600,crop)).toMatchObject({width:952,height:600});expect(JSON.stringify(crop)).toBe(before);expect(summaryCardGeometry(0,600,crop)).toBeNull();});
 it('reports source and transport stages without leaking attachment keys',async()=>{const image={attachmentId:'PRIVATE_KEY',zoom:1,x:50,y:50};await expect(renderSummaryCard(image,async()=>{throw new Error('PRIVATE_KEY private source')})).rejects.toMatchObject({stage:'source'});try{await renderSummaryCard(image,async()=>{throw new Error('PRIVATE_KEY')});}catch(error){expect(String(error)).not.toContain('PRIVATE_KEY');expect(error).toBeInstanceOf(SummaryImageFailure);}});
});
