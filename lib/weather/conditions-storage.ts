import {gzipSync,gunzipSync,strToU8} from 'fflate';

const MAX_JSON_BYTES=5_000_000;
const MAX_PACKED_CHARACTERS=160_000;
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const invalid=()=>new Error('Saved conditions exceed the supported size or contain invalid packed data. The original device record is retained.');
const crcTable=Uint32Array.from({length:256},(_,index)=>{let n=index;for(let bit=0;bit<8;bit++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes:Uint8Array){let n=0xffffffff;for(const byte of bytes)n=crcTable[(n^byte)&255]!^(n>>>8);return (n^0xffffffff)>>>0;}
function base64(bytes:Uint8Array){let binary='';for(let start=0;start<bytes.length;start+=8192)binary+=String.fromCharCode(...bytes.subarray(start,start+8192));return btoa(binary);}
function snapshot(value:unknown){if(!object(value)||value.version!==1||!object(value.request)||!Array.isArray(value.readings)||value.readings.length>6000)throw invalid();return value;}

/** Storage-only, lossless packing. Canonical Plan fields, source readings and timestamps are unchanged. */
export function packConditionsRecord<T extends Record<string,unknown>>(kind:string,record:T):T {
  if(kind!=='trip'||!object(record.conditions))return record;
  const conditions=record.conditions;
  if(conditions.conditionsV1Packed!==undefined){unpackConditionsRecord(kind,record);return record;}
  if(!object(conditions.conditionsV1))return record;
  const bytes=strToU8(JSON.stringify(conditions.conditionsV1));
  if(bytes.length<64_000)return record;
  snapshot(conditions.conditionsV1);
  if(bytes.length>MAX_JSON_BYTES)throw invalid();
  const body=base64(gzipSync(bytes,{level:6,mtime:0}));
  if(body.length>MAX_PACKED_CHARACTERS)throw invalid();
  const {conditionsV1:omitted,...rest}=conditions;void omitted;
  return {...record,conditions:{...rest,conditionsV1Packed:{version:1,encoding:'gzip-base64',jsonBytes:bytes.length,body}}};
}

/** Old uncompressed records remain readable; packed snapshots are expanded only behind owner boundaries. */
export function unpackConditionsRecord<T extends Record<string,unknown>>(kind:string,record:T):T {
  if(kind!=='trip'||!object(record.conditions)||record.conditions.conditionsV1Packed===undefined)return record;
  const conditions=record.conditions;const packed=conditions.conditionsV1Packed;
  if(conditions.conditionsV1!==undefined||!object(packed)||packed.version!==1||packed.encoding!=='gzip-base64'||
     !Number.isInteger(packed.jsonBytes)||Number(packed.jsonBytes)<1||Number(packed.jsonBytes)>MAX_JSON_BYTES||
     typeof packed.body!=='string'||packed.body.length>MAX_PACKED_CHARACTERS||!/^[A-Za-z0-9+/]*={0,2}$/.test(packed.body))throw invalid();
  try{
    const binary=atob(packed.body);const compressed=Uint8Array.from(binary,char=>char.charCodeAt(0));
    if(compressed.length<18||compressed[0]!==31||compressed[1]!==139||compressed[2]!==8)throw invalid();
    const tail=new DataView(compressed.buffer,compressed.byteOffset+compressed.length-8,8);
    if(tail.getUint32(4,true)!==packed.jsonBytes)throw invalid();
    const bytes=gunzipSync(compressed,{out:new Uint8Array(Number(packed.jsonBytes))});
    if(bytes.length!==packed.jsonBytes||crc32(bytes)!==tail.getUint32(0,true))throw invalid();
    const decoded=snapshot(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
    const {conditionsV1Packed:omitted,...rest}=conditions;void omitted;
    return {...record,conditions:{...rest,conditionsV1:decoded}};
  }catch{throw invalid();}
}
