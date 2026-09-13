"use client";
import {useState} from 'react';
import {listDiveSites,saveDiveSite} from '@/lib/offline/dive-planning';
import {auditSiteCoordinate,COORDINATE_SOURCE,COORDINATE_AUDIT_VERSION} from '@/lib/site-coordinate-audit';
type Row={id:string;name:string;status:string;before:{latitude?:number|null|undefined;longitude?:number|null|undefined};after?:{latitude:number;longitude:number}|undefined;distance?:number|undefined};
export function SiteCoordinateAudit({onUpdated}:{onUpdated:()=>void}) {
 const [rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function run(apply:boolean){
  setBusy(true);setMessage('Checking every saved site…');const result:Row[]=[];
  try {
   const sites=await listDiveSites();
   for(const site of sites){
    const audit=auditSiteCoordinate(site);let status:string=audit.status;
    const before={latitude:site.latitude,longitude:site.longitude};
    if(apply && (audit.status==='Correction available' || audit.status==='Researched correction available') && audit.target){
     try{await saveDiveSite({...site,latitude:audit.target.latitude,longitude:audit.target.longitude,coordinateAudit:{version:COORDINATE_AUDIT_VERSION,source:('source' in audit ? audit.source : COORDINATE_SOURCE),checkedAt:new Date().toISOString(),previous:site.coordinateAudit?.previous ?? before}});status='Corrected';}
     catch{status='Save failed';}
    }
    result.push({id:site.entityId,name:site.name,status,before,after:audit.target,distance:Number.isFinite(audit.distance)?audit.distance:undefined});
   }
   setRows(result);setMessage(`${result.length} sites checked. ${result.filter(r=>r.status==='Corrected').length} corrected. ${result.filter(r=>['No Google match','Ambiguous name','Location needs review','Save failed'].includes(r.status)).length} need review.`);onUpdated();
  }catch{setMessage('The audit could not finish. Saved sites are retained.');}finally{setBusy(false);}
 }
 function download(){const blob=new Blob([JSON.stringify({source:COORDINATE_SOURCE,version:COORDINATE_AUDIT_VERSION,rows},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='zeustek-coordinate-audit.json';a.click();URL.revokeObjectURL(url);}
 return <section className="focus-card coordinate-audit"><h2>Check all site coordinates</h2><p>Compare every saved site with verified dive-guide coordinates first, then your Google map snapshot from 8 September 2026. Original coordinates are retained with each correction. Duplicate names and distant matches need review.</p><div className="record-actions"><button disabled={busy} onClick={()=>void run(false)}>Audit every site</button><button disabled={busy} onClick={()=>void run(true)}>Apply verified coordinate corrections</button>{rows.length>0&&<button onClick={download}>Download coordinate audit</button>}</div><p role="status">{message}</p>{rows.length>0&&<details><summary>All {rows.length} audit results</summary><table><thead><tr><th>Site</th><th>Result</th><th>Distance (m)</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.name}</td><td>{row.status}</td><td>{row.distance==null?'—':Math.round(row.distance)}</td></tr>)}</tbody></table></details>}</section>;
}
