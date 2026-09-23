import { csvCell } from '../exports/diver-summary';

const definitions={
 'client-error':['Client','error','A client error occurred. Reopen the affected workspace; unsaved changes may need review.'],
 'sync-error':['Sync','error','Cloud sync failed. Review pending changes and reconnect before retrying.'],
 'import-error':['Imports','error','An import failed. Review the import results before retrying.'],
 'weather-error':['Weather','error','Weather retrieval failed. Earlier saved conditions remain available.'],
 'news-error':['News','error','A News source could not be refreshed. Cached stories remain available.'],
 'validation-error':['Records','warning','A record did not pass validation. Review the affected form.'],
 'release-mismatch':['Release','warning','App version and cached assets differ. Refresh the application.'],
 'operation-complete':['Application','info','Application operation completed.'],
 'legacy-operation':['Application','info','An earlier operation was recorded. Its private details were omitted.'],
} as const;
export type DiagnosticCode=keyof typeof definitions;
export type DiagnosticEntry={code:DiagnosticCode;time:string;domain:string;severity:string;message:string;source:'ZeusTek application';detail:Partial<Record<'count'|'durationMs'|'pending'|'conflicts'|'status',number>>};
const safeNumbers=['count','durationMs','pending','conflicts','status'] as const;
export function safeDiagnostic(value:unknown):DiagnosticEntry|null{
 if(!value||typeof value!=='object')return null;const row=value as Record<string,unknown>;
 if(typeof row.code!=='string'||!Object.hasOwn(definitions,row.code))return null;
 const time=typeof row.time==='string'&&Number.isFinite(Date.parse(row.time))?new Date(row.time).toISOString():null;if(!time)return null;
 const [domain,severity,message]=definitions[row.code as DiagnosticCode];const detail:DiagnosticEntry['detail']={};
 if(row.detail&&typeof row.detail==='object')for(const key of safeNumbers){const value=(row.detail as Record<string,unknown>)[key];if(typeof value==='number'&&Number.isFinite(value)&&value>=0)detail[key]=value;}
 return {code:row.code as DiagnosticCode,time,domain,severity,message,source:'ZeusTek application',detail};
}
export function retainDiagnostics(values:readonly unknown[],now=Date.now()){return values.map(safeDiagnostic).filter((row):row is DiagnosticEntry=>row!==null&&Date.parse(row.time)<=now+60_000&&Date.parse(row.time)>=now-30*86_400_000).sort((a,b)=>b.time.localeCompare(a.time)).slice(0,2000);}
export function diagnosticCsv(values:readonly unknown[]){const rows=values.map(safeDiagnostic).filter((row):row is DiagnosticEntry=>Boolean(row));return [['Time','Domain','Severity','Code','Message','Source','Count','Duration ms','Pending','Conflicts'],...rows.map(row=>[row.time,row.domain,row.severity,row.code,row.message,row.source,String(row.detail.count??''),String(row.detail.durationMs??''),String(row.detail.pending??''),String(row.detail.conflicts??'')])].map(row=>row.map(csvCell).join(',')).join('\r\n');}
export function diagnosticJson(values:readonly unknown[]){return JSON.stringify({format:'zeustek-application-diagnostics',version:1,entries:values.map(safeDiagnostic).filter(Boolean)},null,2);}
