import type { SummaryDocument } from './diver-summary';
export type SummaryImage={label:string;bytes:Uint8Array;type:'jpg'|'png';width:number;height:number};
export async function collectSummaryImages(sources:Array<{label:string;load:()=>Promise<Omit<SummaryImage,'label'>|null>}>){const images:SummaryImage[]=[];const warnings:string[]=[];for(const source of sources){try{const image=await source.load();if(!image)throw new Error();images.push({...image,label:source.label});}catch{warnings.push(`${source.label}: image unavailable; text retained.`);}}return {images,warnings};}
export async function renderSummaryPdf(dto:SummaryDocument,images:SummaryImage[]=[]):Promise<Uint8Array>{
 const {jsPDF}=await import('jspdf');const pdf=new jsPDF({unit:'mm',format:'a4',compress:false});let y=20;
 const line=(value:string,heading=false)=>{pdf.setFont('helvetica',heading?'bold':'normal');pdf.setFontSize(heading?13:10);const lines=pdf.splitTextToSize(value,178) as string[];for(const part of lines){if(y>278){pdf.addPage();y=20;}pdf.text(part,16,y);y+=heading?7:5;}y+=3;};
 line(dto.title,true);line(`Prepared ${dto.generatedAt}`);for(const section of dto.sections){line(section.title,true);for(const value of section.lines)line(value);}
 for(const image of images){try{const height=Math.min(100,178*image.height/image.width);if(y+height+15>280){pdf.addPage();y=20;}line(image.label,true);pdf.addImage(image.bytes,image.type==='jpg'?'JPEG':'PNG',16,y,Math.min(178,height*image.width/image.height),height);y+=height+8;}catch{line(`${image.label}: image unavailable; text retained.`);}}
 return new Uint8Array(pdf.output('arraybuffer'));
}
export async function renderSummaryDocx(dto:SummaryDocument,images:SummaryImage[]=[]):Promise<Uint8Array>{
 const docx=await import('docx');const children:InstanceType<typeof docx.Paragraph>[]=[new docx.Paragraph({text:dto.title,heading:docx.HeadingLevel.TITLE}),new docx.Paragraph(`Prepared ${dto.generatedAt}`)];
 for(const section of dto.sections){children.push(new docx.Paragraph({text:section.title,heading:docx.HeadingLevel.HEADING_1}));for(const text of section.lines)children.push(new docx.Paragraph({text,spacing:{after:100}}));}
 for(const image of images){children.push(new docx.Paragraph(image.label));children.push(new docx.Paragraph({children:[new docx.ImageRun({data:image.bytes,type:image.type,transformation:{width:500,height:500*image.height/image.width}})]}));}
 const document=new docx.Document({creator:'ZeusTek Diving',title:dto.title,sections:[{children}]});return new Uint8Array(await docx.Packer.toArrayBuffer(document));
}
