import type { SummaryDocument } from './diver-summary';
import {SummaryImageFailure} from './summary-card';
import {fontBase64,loadSummaryFonts,summaryTypeface,unsupportedSummaryGlyphs,type SummaryFontOptions,type SummaryTypeface} from './summary-font';
export type SummaryImage={label:string;bytes:Uint8Array;type:'jpg'|'png';width:number;height:number};
export async function collectSummaryImages(sources:Array<{label:string;load:()=>Promise<Omit<SummaryImage,'label'>|null>}>){const images:SummaryImage[]=[];const warnings:string[]=[];const failures:Partial<Record<'source'|'transport'|'decode'|'render'|'unknown',number>>={};for(const source of sources){try{const image=await source.load();if(!image)throw new Error();images.push({...image,label:source.label});}catch(error){const stage=error instanceof SummaryImageFailure?error.stage:'unknown';failures[stage]=(failures[stage]??0)+1;warnings.push(`${source.label}: image unavailable${error instanceof SummaryImageFailure?` (${error.stage})`:''}; text retained.`);}}return {images,warnings,failures};}
const documentValues=(dto:SummaryDocument,images:SummaryImage[])=>[dto.title,`Prepared ${dto.generatedAt}`,...dto.sections.flatMap(s=>[s.title,...s.lines]),...images.map(image=>image.label)];
export async function renderSummaryPdf(dto:SummaryDocument,images:SummaryImage[]=[],options:SummaryFontOptions={}):Promise<Uint8Array>{
 const {jsPDF}=await import('jspdf');const pdf=new jsPDF({unit:'mm',format:'a4',compress:false});let y=20;
 const values=documentValues(dto,images),unicode=values.some(value=>/[^\x00-\x7F]/.test(value));
 if(unicode){const unsupported=unsupportedSummaryGlyphs(values.join('\n'));if(unsupported.length)throw new Error(`Document font does not cover ${unsupported.join(', ')}. TXT, CSV and JSON preserve this text.`);const fonts=await loadSummaryFonts(options);for(const [file,family,data] of [['NotoSans-Regular.ttf','NotoSans',fonts.latin],['NotoSansJP-Regular.ttf','NotoSansJP',fonts.japanese]] as const){pdf.addFileToVFS(file,fontBase64(data));pdf.addFont(file,family,'normal');}}
 type Glyph={char:string;font:SummaryTypeface;width:number};
 const setFont=(font:SummaryTypeface,heading:boolean)=>pdf.setFont(font,font==='helvetica'&&heading?'bold':'normal');
 const wrap=(value:string,heading:boolean)=>{pdf.setFontSize(heading?13:10);const result:Glyph[][]=[];for(const paragraph of value.split(/\r?\n/)){let row:Glyph[]=[],width=0;for(const char of Array.from(paragraph)){const font=summaryTypeface(char);setFont(font,heading);const glyph={char,font,width:pdf.getTextWidth(char)};if(width+glyph.width>178&&row.length){const space=row.map(g=>g.char).lastIndexOf(' ');if(space>0){result.push(row.slice(0,space));row=row.slice(space+1);width=row.reduce((n,g)=>n+g.width,0);}else{result.push(row);row=[];width=0;}}row.push(glyph);width+=glyph.width;}result.push(row);}return result;};
 const line=(value:string,heading=false)=>{const rows=wrap(value,heading);for(const row of rows){if(y>278){pdf.addPage();y=20;}let x=16;let run='',runWidth=0,font:SummaryTypeface='helvetica';const draw=()=>{if(!run)return;setFont(font,heading);pdf.text(run,x,y);x+=runWidth;run='';runWidth=0;};for(const glyph of row){if(glyph.font!==font){draw();font=glyph.font;}run+=glyph.char;runWidth+=glyph.width;}draw();y+=heading?7:5;}y+=3;};
 line(dto.title,true);line(`Prepared ${dto.generatedAt}`);for(const section of dto.sections){line(section.title,true);for(const value of section.lines)line(value);}
 for(const image of images){try{if(image.width<=0||image.height<=0)throw new Error();const height=Math.min(100,178*image.height/image.width);const captionHeight=wrap(image.label,true).length*7+3;if(y+height+captionHeight+8>280){pdf.addPage();y=20;}line(image.label,true);if(y+height>280){pdf.addPage();y=20;}pdf.addImage(image.bytes,image.type==='jpg'?'JPEG':'PNG',16,y,Math.min(178,height*image.width/image.height),height);y+=height+8;}catch{line(`${image.label}: image unavailable; text retained.`);}}
 return new Uint8Array(pdf.output('arraybuffer'));
}
export async function renderSummaryDocx(dto:SummaryDocument,images:SummaryImage[]=[],options:SummaryFontOptions={}):Promise<Uint8Array>{
 const docx=await import('docx');const unicode=documentValues(dto,images).some(value=>/[^\x00-\x7F]/.test(value));const fonts=unicode?await loadSummaryFonts(options):null;
 const font={ascii:fonts?'Noto Sans':'Arial',hAnsi:fonts?'Noto Sans':'Arial',eastAsia:fonts?'Noto Sans JP':'Arial',cs:fonts?'Noto Sans':'Arial'};
 const paragraph=(text:string,options:Omit<ConstructorParameters<typeof docx.Paragraph>[0]&object,'text'|'children'>={})=>new docx.Paragraph({...options,children:[new docx.TextRun({text,font})]});
 const children:InstanceType<typeof docx.Paragraph>[]=[paragraph(dto.title,{heading:docx.HeadingLevel.TITLE}),paragraph(`Prepared ${dto.generatedAt}`)];
 for(const section of dto.sections){children.push(paragraph(section.title,{heading:docx.HeadingLevel.HEADING_1}));for(const text of section.lines)children.push(paragraph(text,{spacing:{after:100}}));}
 for(const image of images){if(image.width<=0||image.height<=0){children.push(paragraph(`${image.label}: image unavailable; text retained.`));continue;}const scale=Math.min(500/image.width,360/image.height);children.push(paragraph(image.label,{keepNext:true}));children.push(new docx.Paragraph({children:[new docx.ImageRun({data:image.bytes,type:image.type,transformation:{width:image.width*scale,height:image.height*scale}})]}));}
 const document=new docx.Document({creator:'ZeusTek Diving',title:dto.title,
  // docx's font API accepts Buffer but its encoder uses only Uint8Array operations,
  // retaining the existing browser export without a Node Buffer dependency.
  ...(fonts?{fonts:[{name:'Noto Sans',data:fonts.latin as unknown as Buffer},{name:'Noto Sans JP',data:fonts.japanese as unknown as Buffer}]}:{}),
  styles:{default:{document:{run:{font,size:22,color:'000000'},paragraph:{spacing:{line:300}}},title:{run:{font,size:32,color:'000000'},paragraph:{keepNext:true,spacing:{after:240}}},heading1:{run:{font,size:26,bold:true,color:'000000'},paragraph:{keepNext:true,spacing:{before:200,after:120}}}}},
  sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1080,right:1080,bottom:1080,left:1080}}},children}]});return new Uint8Array(await docx.Packer.toArrayBuffer(document));
}
