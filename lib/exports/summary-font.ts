import japaneseCoverage from './summary-font-coverage.json';
import latinCoverage from './summary-latin-coverage.json';
export type SummaryFontOptions={fontData?:Uint8Array;latinFontData?:Uint8Array};
export type SummaryTypeface='helvetica'|'NotoSans'|'NotoSansJP';
const covers=(ranges:number[][],point:number)=>ranges.some(([start,end])=>point>=start!&&point<=end!);
export function summaryTypeface(char:string):SummaryTypeface {
  const point=char.codePointAt(0)??32;
  if(point<127)return 'helvetica';
  return covers(latinCoverage,point)?'NotoSans':'NotoSansJP';
}
export function unsupportedSummaryGlyphs(text:string) {
  return [...new Set(Array.from(text).filter(char=>{
    const point=char.codePointAt(0)!;
    return point>127&&!covers(latinCoverage,point)&&!covers(japaneseCoverage,point);
  }).map(char=>'U+'+char.codePointAt(0)!.toString(16).toUpperCase()))];
}
export async function loadSummaryFonts(options:SummaryFontOptions={}) {
  const load=async(path:string)=>{
    const response=await fetch(path,{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Document fonts are unavailable. Retry or download TXT, CSV or JSON.');
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.byteLength<1000||bytes.byteLength>7*1024*1024)throw new Error('Document font could not be loaded.');
    return bytes;
  };
  const [latin,japanese]=await Promise.all([
    options.latinFontData??load('/fonts/summary/NotoSans-Regular.ttf'),
    options.fontData??load('/fonts/summary/NotoSansJP-Regular.ttf'),
  ]);
  return {latin,japanese};
}
export function fontBase64(bytes:Uint8Array) {
  let binary='';
  for(let index=0;index<bytes.length;index+=32768)binary+=String.fromCharCode(...bytes.subarray(index,index+32768));
  return btoa(binary);
}
