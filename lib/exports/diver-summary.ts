/** One explicit projection shared by every owner-selected export format. */
export interface SummaryOptions { summary:boolean;types:boolean;deep:boolean;certifications:boolean;equipment:boolean;logs:boolean;certificationNumbers:boolean }
type DiveInput={diveNumber?:number|null;date?:string;site?:string;maxDepthM?:number|null;totalElapsedMin?:number|null;bottomTimeMin?:number|null;diveMode?:string;isTechnicalDive?:boolean;diveTypes?:string[]};
type CertInput={agency?:string;certification?:string;certificationNumber?:string;issuedAt?:string;expiresAt?:string};
type GearInput={name?:string;category?:string;manufacturer?:string;model?:string;retired?:boolean};
export type SummaryDocument={format:'zeustek-diver-summary';version:1;title:string;generatedAt:string;sections:Array<{title:string;lines:string[]}>};
const text=(value:unknown)=>typeof value==='string'?Array.from(value).filter(char=>{const code=char.charCodeAt(0);return code>=32||code===9||code===10||code===13;}).join('').trim():'';
const finite=(value:number|null|undefined)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:0;
const activityLabel=(value:string)=>{const known:Record<string,string>={recreational:'Recreational',technical:'Technical',shore:'Shore',boat:'Boat',wreck:'Wreck',night:'Night','recreational training':'Recreational training'};const trimmed=value.trim().replace(/\s+/g,' ');return known[trimmed.toLocaleLowerCase('en-US')]??trimmed;};
export function buildDiverSummary(input:{name:string;generatedAt:string;options:SummaryOptions;dives:readonly DiveInput[];certifications:readonly CertInput[];equipment:readonly GearInput[]}):SummaryDocument {
 const sections:SummaryDocument['sections']=[];const add=(title:string,lines:string[])=>sections.push({title,lines:lines.length?lines:['None selected.']});
 const minutes=input.dives.reduce((sum,row)=>sum+finite(row.totalElapsedMin??row.bottomTimeMin),0);
 const mode=(row:DiveInput)=>row.diveMode?activityLabel(text(row.diveMode).replaceAll('-',' ')):row.isTechnicalDive?'Technical':'Recreational';
 if(input.options.summary)add('Dive summary',[`${input.dives.length} Dives`,`${minutes} minutes underwater`,`${Math.max(0,...input.dives.map(row=>finite(row.maxDepthM)))} m maximum recorded depth`]);
 if(input.options.deep)add('Depth experience',[`${input.dives.filter(row=>finite(row.maxDepthM)>20).length} Dives deeper than 20 m`,`${input.dives.filter(row=>finite(row.maxDepthM)>30).length} Dives deeper than 30 m`]);
 if(input.options.types){const counts=new Map<string,{label:string;count:number}>();for(const dive of input.dives){const seen=new Set<string>();for(const type of [mode(dive),...(dive.diveTypes??[]).map(text)].filter(Boolean)){const key=type.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');if(seen.has(key))continue;seen.add(key);const current=counts.get(key);counts.set(key,{label:current?.label??activityLabel(type),count:(current?.count??0)+1});}}add('Dive types and activities',[...counts.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label)).map(({label,count})=>`${label}: ${count}`));}
 if(input.options.certifications)add('Certifications',input.certifications.map(row=>[text(row.agency),text(row.certification),row.issuedAt?`Issued ${text(row.issuedAt)}`:'',row.expiresAt?`Expires ${text(row.expiresAt)}`:'',input.options.certificationNumbers&&row.certificationNumber?`Number ${text(row.certificationNumber)}`:''].filter(Boolean).join(' | ')));
 if(input.options.equipment)add('Equipment',input.equipment.map(row=>[text(row.name),text(row.category),text(row.manufacturer),text(row.model),row.retired?'Retired':''].filter(Boolean).join(' | ')));
 if(input.options.logs)add('Selected Dive log',input.dives.map(row=>[`#${row.diveNumber??'?'}`,text(row.date)||'Date not recorded',text(row.site)||'Site not recorded',`${row.maxDepthM??'?'} m`,`${row.totalElapsedMin??row.bottomTimeMin??'?'} min`,mode(row)].join(' | ')));
 return {format:'zeustek-diver-summary',version:1,title:input.name||'Diver summary',generatedAt:input.generatedAt,sections};
}
export function summaryText(dto:SummaryDocument){return [dto.title,`Prepared ${dto.generatedAt}`,...dto.sections.flatMap(section=>['',section.title,...section.lines])].join('\n');}
export function csvCell(value:unknown){const raw=typeof value==='string'?value:typeof value==='number'?String(value):'';return `"${(/^[\s\uFEFF]*[=+@-]/.test(raw)?"'"+raw:raw).replaceAll('"','""')}"`;}
export function summaryCsv(dto:SummaryDocument){return [['Section','Value'],['Diver',dto.title],['Prepared',dto.generatedAt],...dto.sections.flatMap(section=>section.lines.map(line=>[section.title,line]))].map(row=>row.map(csvCell).join(',')).join('\r\n');}
export function summaryJson(dto:SummaryDocument){return JSON.stringify(dto,null,2);}
