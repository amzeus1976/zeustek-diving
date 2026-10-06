import {gzipSync,gunzipSync,strToU8} from 'fflate';
import {normalisePlanTextFormats,PLAN_TEXT_FIELDS} from '../planning/formatted-text';

const MAX_JSON_BYTES=5_000_000;
const MAX_PACKED_CHARACTERS=160_000;
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const invalid=()=>new Error('Saved conditions exceed the supported size or contain invalid packed data. The original device record is retained.');
const crcTable=Uint32Array.from({length:256},(_,index)=>{let n=index;for(let bit=0;bit<8;bit++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes:Uint8Array){let n=0xffffffff;for(const byte of bytes)n=crcTable[(n^byte)&255]!^(n>>>8);return (n^0xffffffff)>>>0;}
function base64(bytes:Uint8Array){let binary='';for(let start=0;start<bytes.length;start+=8192)binary+=String.fromCharCode(...bytes.subarray(start,start+8192));return btoa(binary);}
function snapshot(value:unknown){if(!object(value)||value.version!==1||!object(value.request)||!Array.isArray(value.readings)||value.readings.length>6000)throw invalid();return value;}
function packedJson(value:unknown){
  const bytes=strToU8(JSON.stringify(value));if(bytes.length>MAX_JSON_BYTES)throw invalid();
  const body=base64(gzipSync(bytes,{level:6,mtime:0}));if(body.length>MAX_PACKED_CHARACTERS)throw invalid();
  return {version:1,encoding:'gzip-base64',jsonBytes:bytes.length,body};
}
function sameJson(a:unknown,b:unknown):boolean {
  if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const x=a as Record<string,unknown>,y=b as Record<string,unknown>,keys=Object.keys(x);
  return keys.length===Object.keys(y).length&&keys.every(key=>Object.hasOwn(y,key)&&sameJson(x[key],y[key]));
}
function validPresentation(value:unknown){return object(value)&&sameJson(value,normalisePlanTextFormats(value));}
const textFields=new Set([...PLAN_TEXT_FIELDS,'objective','humanFactors.objective']);
const arrayFields=new Set(['goals','secondaryObjectives',...['keyRisks','mitigations','pressures','stopAbortCriteria','teamConcerns'].map(key=>'humanFactors.'+key)]);
const textValue=(key:string,value:unknown)=>textFields.has(key)&&(arrayFields.has(key)?Array.isArray(value)&&value.every(row=>typeof row==='string'):typeof value==='string');
function fieldValue(record:Record<string,unknown>,path:string){const [parent,key]=path.split('.');return key?(object(record[parent!])?(record[parent!] as Record<string,unknown>)[key]:undefined):record[parent!];}
function setTextField(record:Record<string,unknown>,path:string,value:unknown,remove=false){
  const [parent,key]=path.split('.'),result={...record};
  if(key){if(result[parent!]!==undefined&&!object(result[parent!]))throw invalid();const nested={...result[parent!] as Record<string,unknown>};if(remove)delete nested[key];else nested[key]=value;result[parent!]=nested;}
  else if(remove)delete result[parent!];else result[parent!]=value;
  return result;
}
type NotePart=string|{field:string;index?:number};
function deduplicatedNotes(notes:string,source:Record<string,unknown>){
  const values:Array<{text:string;ref:Exclude<NotePart,string>}>=[];
  for(const field of textFields){const value=fieldValue(source,field);if(!textValue(field,value))continue;
    if(typeof value==='string'){if(value.length>=1024)values.push({text:value,ref:{field}});}
    else (value as string[]).forEach((text,index)=>{if(text.length>=1024)values.push({text,ref:{field,index}});});
  }
  let parts:NotePart[]=[notes];
  for(const {text,ref} of values.sort((a,b)=>b.text.length-a.text.length)){
    parts=parts.flatMap(part=>{if(typeof part!=='string'||!part.includes(text))return [part];const segments=part.split(text),next:NotePart[]=[];
      segments.forEach((segment,index)=>{if(index)next.push(ref);if(segment)next.push(segment);});return next;});
    if(parts.length>10000)return undefined;
  }
  return parts.some(part=>typeof part!=='string')&&JSON.stringify(parts).length<JSON.stringify(notes).length?{version:2,parts}:undefined;
}
function restoredNotes(repeated:unknown,source:Record<string,unknown>){
  if(!object(repeated))throw invalid();
  if(repeated.version===1){if(Object.keys(repeated).some(key=>key!=='version'&&key!=='suffix')||typeof repeated.suffix!=='string'||typeof source.notes!=='string')throw invalid();return source.notes+repeated.suffix;}
  if(repeated.version!==2||Object.keys(repeated).some(key=>key!=='version'&&key!=='parts')||!Array.isArray(repeated.parts)||repeated.parts.length>10000)throw invalid();
  let length=0;const parts=repeated.parts.map(part=>{
    let text:string;
    if(typeof part==='string')text=part;
    else{
      if(!object(part)||typeof part.field!=='string'||!textFields.has(part.field)||Object.keys(part).some(key=>key!=='field'&&key!=='index'))throw invalid();
      const value=fieldValue(source,part.field);if(!textValue(part.field,value))throw invalid();
      if(typeof value==='string'){if(part.index!==undefined)throw invalid();text=value;}
      else{if(!Number.isInteger(part.index)||Number(part.index)<0||Number(part.index)>=(value as string[]).length)throw invalid();text=(value as string[])[Number(part.index)]!;}
    }
    length+=text.length;if(length>MAX_JSON_BYTES)throw invalid();return text;
  });return parts.join('');
}
function readPackedJson(packed:unknown):unknown {
  if(!object(packed)||packed.version!==1||packed.encoding!=='gzip-base64'||
     !Number.isInteger(packed.jsonBytes)||Number(packed.jsonBytes)<1||Number(packed.jsonBytes)>MAX_JSON_BYTES||
     typeof packed.body!=='string'||packed.body.length>MAX_PACKED_CHARACTERS||!/^[A-Za-z0-9+/]*={0,2}$/.test(packed.body))throw invalid();
  try{
    const binary=atob(packed.body),compressed=Uint8Array.from(binary,char=>char.charCodeAt(0));
    if(compressed.length<18||compressed[0]!==31||compressed[1]!==139||compressed[2]!==8)throw invalid();
    const tail=new DataView(compressed.buffer,compressed.byteOffset+compressed.length-8,8);
    if(tail.getUint32(4,true)!==packed.jsonBytes)throw invalid();
    const bytes=gunzipSync(compressed,{out:new Uint8Array(Number(packed.jsonBytes))});
    if(bytes.length!==packed.jsonBytes||crc32(bytes)!==tail.getUint32(0,true))throw invalid();
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }catch{throw invalid();}
}
function planTextPayload(value:unknown){
  if(!object(value)||!Object.keys(value).length||Object.keys(value).some(key=>key!=='notes'&&key!=='fields'&&key!=='textFormatting')||
    (value.notes!==undefined&&typeof value.notes!=='string')||(value.textFormatting!==undefined&&!validPresentation(value.textFormatting)))throw invalid();
  if(value.fields!==undefined&&(!object(value.fields)||Object.entries(value.fields).some(([key,row])=>!textValue(key,row))||(value.notes!==undefined&&Object.hasOwn(value.fields,'notes'))))throw invalid();
  return value;
}
function packDiveSnapshot<T extends Record<string,unknown>>(record:T):T {
  if(!object(record.originatingPlanRevision)||!object(record.originatingPlanRevision.snapshot)||!object(record.originatingPlanRevision.snapshot.record)){
    if(record.notesFromPlan!==undefined)throw invalid();return record;
  }
  const revision=record.originatingPlanRevision,origin=revision.snapshot as Record<string,unknown>,source=origin.record as Record<string,unknown>;
  if(source.planTextPacked!==undefined||record.notesFromPlan!==undefined){unpackConditionsRecord('dive',record);return record;}
  let compactSource=packConditionsRecord('trip',source),candidate:Record<string,unknown>={...record,originatingPlanRevision:{...revision,snapshot:{...origin,record:compactSource}}};
  // Synthesized narrative can repeat notes, objectives and stop/abort entries anywhere.
  if(typeof record.notes==='string'&&JSON.stringify(candidate).length>180000){
    const repeated=deduplicatedNotes(record.notes,source);
    if(repeated){const {notes:omitted,...rest}=candidate;void omitted;candidate={...rest,notesFromPlan:repeated};}
  }
  const fields:Record<string,unknown>={};for(const key of textFields){const value=fieldValue(compactSource,key);if(textValue(key,value))fields[key]=value;}
  const text={...(Object.keys(fields).length?{fields}:{}),...(validPresentation(compactSource.textFormatting)?{textFormatting:compactSource.textFormatting}:{})};
  if(Object.keys(text).length&&(JSON.stringify(text).length>=64000||JSON.stringify(candidate).length>180000)){
    let encoded:ReturnType<typeof packedJson>|undefined;try{encoded=packedJson(text);}catch{/* Incompressible text stays exact; the ordinary whole-record limit still applies. */}
    // Only these private text fields are packed; canonical IDs and references stay visible.
    if(encoded&&JSON.stringify(encoded).length<JSON.stringify(text).length){
      let rest={...compactSource};for(const key of Object.keys(fields))rest=setTextField(rest,key,undefined,true);if(Object.hasOwn(text,'textFormatting'))delete rest.textFormatting;
      compactSource={...rest,planTextPacked:encoded};candidate={...candidate,originatingPlanRevision:{...revision,snapshot:{...origin,record:compactSource}}};
    }
  }
  return candidate as T;
}
function unpackDiveSnapshot<T extends Record<string,unknown>>(record:T):T {
  const revision=record.originatingPlanRevision;
  if(!object(revision)||!object(revision.snapshot)||!object(revision.snapshot.record)){if(record.notesFromPlan!==undefined)throw invalid();return record;}
  const origin=revision.snapshot,source=origin.record as Record<string,unknown>;let expandedSource=source;
  if(source.planTextPacked!==undefined){
    const text=planTextPayload(readPackedJson(source.planTextPacked));
    if((Object.hasOwn(text,'notes')&&source.notes!==undefined)||(Object.hasOwn(text,'textFormatting')&&source.textFormatting!==undefined))throw invalid();
    const {planTextPacked:omitted,...rest}=source;void omitted;
    expandedSource={...rest,...(Object.hasOwn(text,'notes')?{notes:text.notes}:{}),...(Object.hasOwn(text,'textFormatting')?{textFormatting:text.textFormatting}:{})};
    if(object(text.fields))for(const [key,value] of Object.entries(text.fields)){if(fieldValue(source,key)!==undefined)throw invalid();expandedSource=setTextField(expandedSource,key,value);}
  }
  expandedSource=unpackConditionsRecord('trip',expandedSource);
  if(expandedSource===source&&record.notesFromPlan===undefined)return record;
  let expanded:Record<string,unknown>={...record,originatingPlanRevision:{...revision,snapshot:{...origin,record:expandedSource}}};
  if(record.notesFromPlan!==undefined){
    if(record.notes!==undefined)throw invalid();
    const {notesFromPlan:omitted,...rest}=expanded;void omitted;expanded={...rest,notes:restoredNotes(record.notesFromPlan,expandedSource)};
  }
  return expanded as T;
}

/** Storage-only, lossless packing. Canonical Plan fields, source readings and timestamps are unchanged. */
export function packConditionsRecord<T extends Record<string,unknown>>(kind:string,record:T):T {
  if(kind==='dive')return packDiveSnapshot(record);
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
  if(kind==='dive')return unpackDiveSnapshot(record);
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
