import {Unzlib} from 'fflate';
const MAX_BYTES=2*1024*1024;
function invalid():never{throw new Error('Use a valid PNG or JPEG derivative, at most 2 MB and 2048 pixels per side.');}
function dimensions(width:number,height:number){if(width<1||height<1||width>2048||height>2048||width*height>4194304)invalid();}
function join(parts:Uint8Array[]){const result=new Uint8Array(parts.reduce((size,part)=>size+part.length,0));let cursor=0;for(const part of parts){result.set(part,cursor);cursor+=part.length;}return result;}
function crc(bytes:Uint8Array){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;}
/** Independent validation/metadata removal. No attachment keys, SVG or remote URLs. */
export function sanitizePublicationRaster(bytes:Uint8Array,mime:string){
  if(bytes.length<20||bytes.length>MAX_BYTES)invalid();
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(mime==='image/png'){
    const signature=[137,80,78,71,13,10,26,10];if(signature.some((value,index)=>bytes[index]!==value))invalid();
    const keep=[bytes.slice(0,8)],compressed:Uint8Array[]=[];let cursor=8,width=0,height=0,colourType=0,started=false,ended=false,data=false,palette=false;
    while(cursor<bytes.length){if(cursor+12>bytes.length)invalid();const length=view.getUint32(cursor);if(length>MAX_BYTES||cursor+length+12>bytes.length)invalid();const name=String.fromCharCode(...bytes.slice(cursor+4,cursor+8));if(!/^[A-Za-z]{4}$/.test(name)||crc(bytes.subarray(cursor+4,cursor+8+length))!==view.getUint32(cursor+8+length))invalid();const chunk=bytes.slice(cursor,cursor+12+length);
      if(!started&&name!=='IHDR')invalid();
      if(name==='IHDR'){if(started||length!==13)invalid();width=view.getUint32(cursor+8);height=view.getUint32(cursor+12);dimensions(width,height);const depth=bytes[cursor+16],colour=bytes[cursor+17];if(depth!==8||![0,2,3,4,6].includes(colour!)||bytes[cursor+18]!==0||bytes[cursor+19]!==0||bytes[cursor+20]!==0)invalid();colourType=colour!;started=true;keep.push(chunk);}
      else if(name==='PLTE'){if(data||palette||length<3||length>768||length%3)invalid();palette=true;keep.push(chunk);}
      else if(name==='tRNS'){if(data||length>256)invalid();keep.push(chunk);}
      else if(name==='IDAT'){if(ended||length===0)invalid();data=true;compressed.push(bytes.slice(cursor+8,cursor+8+length));keep.push(chunk);}
      else if(name==='IEND'){if(!data||length!==0||cursor+12!==bytes.length)invalid();ended=true;keep.push(chunk);}
      else if(['acTL','fcTL','fdAT'].includes(name)||name[0]===name[0]!.toUpperCase())invalid();
      // All remaining ancillary metadata is deliberately omitted.
      cursor+=length+12;
    }
    if(!started||!ended||colourType===3&&!palette)invalid();
    // Bound decompression independently of claimed dimensions. Small input chunks
    // cap temporary decoder allocation; oversized output is rejected immediately.
    const channels=({0:1,2:3,3:1,4:2,6:4} as Record<number,number>)[colourType]!;
    const rowBytes=width*channels+1,expected=rowBytes*height;let decoded=0,adlerA=1,adlerB=0;
    const stream=new Unzlib((part)=>{if(decoded+part.length>expected)invalid();for(let index=0;index<part.length;index++){const value=part[index]!;if((decoded+index)%rowBytes===0&&value>4)invalid();adlerA=(adlerA+value)%65521;adlerB=(adlerB+adlerA)%65521;}decoded+=part.length;});
    const encoded=join(compressed);try {for(let offset=0;offset<encoded.length;offset+=256)stream.push(encoded.subarray(offset,offset+256),offset+256>=encoded.length);}catch{return invalid();}
    if(decoded!==expected||encoded.length<6||new DataView(encoded.buffer).getUint32(encoded.length-4)!==((adlerB<<16|adlerA)>>>0))invalid();
    return {bytes:join(keep),contentType:'image/png',width,height};
  }
  if(mime==='image/jpeg'){
    if(bytes[0]!==255||bytes[1]!==216)invalid();const keep=[bytes.slice(0,2)],components:number[]=[];let cursor=2,width=0,height=0,scan=false,ended=false;
    while(cursor<bytes.length){const start=cursor;if(bytes[cursor++]!==255)invalid();while(bytes[cursor]===255)cursor++;const marker=bytes[cursor++];if(marker===undefined)invalid();if(marker===217){if(!scan||cursor!==bytes.length)invalid();keep.push(bytes.slice(start,cursor));ended=true;break;}if(marker===0||marker===216||marker>=208&&marker<=215||cursor+2>bytes.length)invalid();const length=view.getUint16(cursor);if(length<2||cursor+length>bytes.length)invalid();const end=cursor+length;
      if([192,193,194].includes(marker)){if(width||length<8||bytes[cursor+2]!==8)invalid();const count=bytes[cursor+7]!;if(![1,3,4].includes(count)||length!==8+3*count)invalid();for(let index=0;index<count;index++){const component=bytes[cursor+8+3*index]!;if(components.includes(component))invalid();components.push(component);}height=view.getUint16(cursor+3);width=view.getUint16(cursor+5);dimensions(width,height);}
      else if(marker>=192&&marker<=207&&![196,200,204].includes(marker))invalid();
      if(!(marker>=224&&marker<=239)&&marker!==254)keep.push(bytes.slice(start,end));cursor=end;
      if(marker===218){const count=bytes[start+4]!,scanComponents:number[]=[];if(!width||count<1||count>components.length||length!==6+2*count)invalid();for(let index=0;index<count;index++){const component=bytes[start+5+2*index]!;if(!components.includes(component)||scanComponents.includes(component))invalid();scanComponents.push(component);}scan=true;const entropy=cursor;while(cursor<bytes.length){if(bytes[cursor]!==255){cursor++;continue;}let next=cursor+1;while(bytes[next]===255)next++;if(bytes[next]===0||bytes[next]!==undefined&&bytes[next]!>=208&&bytes[next]!<=215){cursor=next+1;continue;}break;}if(cursor===entropy)invalid();keep.push(bytes.slice(entropy,cursor));}
    }
    if(!ended||!width)invalid();return {bytes:join(keep),contentType:'image/jpeg',width,height};
  }
  return invalid();
}
