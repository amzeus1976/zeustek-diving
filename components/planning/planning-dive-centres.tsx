'use client';
import type {OperatorRecord,Stored} from '../../lib/offline/dive-planning';
import {OPERATOR_TYPES} from '../../lib/operators/dive-centres';
import styles from './planning-dive-centres.module.css';

/** Private live contacts come from canonical Dive Entities, never a copied Person or phone snapshot. */
export function PlanningDiveCentres({ids,centres,change}:{ids:readonly string[];centres:ReadonlyArray<Stored<OperatorRecord>>;change?:(ids:string[])=>void}){
 const available=centres.filter(row=>row.active!==false&&!ids.includes(row.entityId)).sort((a,b)=>a.name.localeCompare(b.name)||a.entityId.localeCompare(b.entityId));
 return <div className={styles.contacts}>
  {change&&<label>Add Dive Centre / operator<select value="" onChange={event=>{const row=available.find(row=>row.entityId===event.target.value);if(row)change([...ids,row.entityId]);}}><option value="">Choose a saved Dive Entity</option>{available.map(row=><option key={row.entityId} value={row.entityId}>{row.name} · {OPERATOR_TYPES.find(([type])=>type===row.operatorType)?.[1]??'Unclassified'}{row.location?` · ${row.location}`:''} · {row.entityId.slice(-8)}</option>)}</select></label>}
  {!ids.length&&<p>No Dive Centres selected.</p>}
  {ids.map(id=>{const centre=centres.find(row=>row.entityId===id);const phone=centre?.phone?.trim();const emergency=centre?.emergencyPhone?.trim();const href=`/?${new URLSearchParams({section:'Dive Centres',operatorId:id})}`;return <article key={id}>
   <div className={styles.heading}><b>{centre?.name??`Unavailable Dive Entity · ${id.slice(-8)}`}{centre?.active===false?' · inactive':''}</b>{change&&<button type="button" className="focus-secondary" aria-label={`Remove ${centre?.name??'unavailable Dive Entity'} contact`} onClick={()=>change(ids.filter(value=>value!==id))}>Remove</button>}</div>
   {centre&&<><span>{centre.location||centre.town||'Location not recorded'}</span><span>Phone: {phone?<ContactPhone value={phone}/>: 'Not recorded'}</span>{emergency&&<span>Emergency phone: <ContactPhone value={emergency}/></span>}{centre.email&&<span>Email: {centre.email}</span>}</>}
   <a href={href}>Open exact Dive Entity ↗</a>
  </article>;})}
  {change&&<p><a href="/?section=Dive%20Centres" target="_blank" rel="noopener noreferrer">Add or edit a Dive Entity ↗</a>. Contacts stay separate from People and are saved with this Plan or Trip.</p>}
 </div>;
}
function ContactPhone({value}:{value:string}){const number=value.replace(/[\s().-]/g,'');return /^\+?\d{5,20}$/.test(number)?<a href={`tel:${number}`}>{value}</a>:<>{value}</>;}
