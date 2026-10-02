import type {CardImage} from '../offline/dive-images';
export type SummaryImageStage='source'|'transport'|'decode'|'render';
export class SummaryImageFailure extends Error {
  constructor(readonly stage:SummaryImageStage){super(`Image unavailable (${stage}); text retained.`);}
}
export function summaryCardGeometry(sourceWidth:number,sourceHeight:number,crop:Pick<CardImage,'x'|'y'|'zoom'>) {
  if(!Number.isFinite(sourceWidth)||!Number.isFinite(sourceHeight)||sourceWidth<=0||sourceHeight<=0)return null;
  const width=952,height=600;
  const zoom=Number.isFinite(crop.zoom)?Math.max(1,Math.min(3,crop.zoom)):1;
  const focal=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(100,value)):50;
  const scale=Math.max(width/sourceWidth,height/sourceHeight)*zoom;
  const drawWidth=sourceWidth*scale,drawHeight=sourceHeight*scale;
  return {width,height,drawWidth,drawHeight,left:(width-drawWidth)*focal(crop.x)/100,top:(height-drawHeight)*focal(crop.y)/100};
}
export function decodeSummaryImage(source:string):Promise<HTMLImageElement> {
  return new Promise((resolve,reject)=>{
    const image=new Image();
    const timer=setTimeout(()=>{image.onload=null;image.onerror=null;image.src='';reject(new SummaryImageFailure('transport'));},15000);
    image.onload=()=>{clearTimeout(timer);image.onload=null;image.onerror=null;if(!image.naturalWidth||!image.naturalHeight)reject(new SummaryImageFailure('decode'));else resolve(image);};
    image.onerror=()=>{clearTimeout(timer);image.onload=null;image.onerror=null;reject(new SummaryImageFailure('decode'));};
    image.src=source;
  });
}
export async function renderSummaryCard(image:CardImage,loadSource:()=>Promise<string>,decode:(source:string)=>Promise<HTMLImageElement>=decodeSummaryImage) {
  let stage:SummaryImageStage='source',source='';
  try {
    source=await loadSource();if(!source)throw new SummaryImageFailure(stage);
    // Reuse the private source resolver and the card preview's browser image
    // decoding. Fetching a temporary Blob URL is unsupported in some hosts.
    stage='decode';const decoded=await decode(source);
    const geometry=summaryCardGeometry(decoded.naturalWidth,decoded.naturalHeight,image);if(!geometry)throw new SummaryImageFailure(stage);
    stage='render';const canvas=document.createElement('canvas');canvas.width=geometry.width;canvas.height=geometry.height;
    const context=canvas.getContext('2d');if(!context)throw new SummaryImageFailure(stage);
    context.fillStyle='#111';context.fillRect(0,0,geometry.width,geometry.height);
    context.drawImage(decoded,geometry.left,geometry.top,geometry.drawWidth,geometry.drawHeight);
    const output=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
    if(!output)throw new SummaryImageFailure(stage);
    return {bytes:new Uint8Array(await output.arrayBuffer()),type:'jpg' as const,width:geometry.width,height:geometry.height};
  }catch(error){throw new SummaryImageFailure(error instanceof SummaryImageFailure?error.stage:stage);}
  finally {if(source.startsWith('blob:'))URL.revokeObjectURL(source);}
}
