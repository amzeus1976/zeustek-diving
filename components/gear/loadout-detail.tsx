'use client';
import {X,Pencil} from 'lucide-react';
import {AccessibleDialog} from '../accessible-dialog';
import {loadoutDetailRows} from '../../lib/gear/loadout-detail';
import type {ReusableLoadoutRecord} from '../../lib/offline/loadouts-gas';
import type {EquipmentRecord,Stored} from '../../lib/offline/dive-planning';
import styles from '../loadouts-gas.module.css';
export function LoadoutDetail({item,equipment,close,edit}:{item:Stored<ReusableLoadoutRecord>;equipment:Stored<EquipmentRecord>[];close:()=>void;edit:()=>void}) {
  const rows=loadoutDetailRows(item,equipment);
  return <div className="focus-modal-bg"><AccessibleDialog label={item.name+' loadout details'} className={'focus-modal '+styles.cylinderDetail} close={close}>
    <header><div><span className="focus-eyebrow">REUSABLE LOADOUT</span><h2>{item.name}</h2><p>{item.intendedUse||'Equipment configuration'}</p></div><button className="focus-icon" aria-label="Close loadout details" onClick={close}><X/></button></header>
    {item.description&&<p>{item.description}</p>}<div className={styles.chips}>{(item.environmentTags??[]).map(tag=><span key={tag}>{tag}</span>)}</div>
    <dl className={styles.specGrid}>{rows.map(row=><div key={row.slot}><dt>{row.label}</dt><dd>{row.items.map(reference=><p key={reference.id}>{reference.label}{!reference.available?' · reference retained':''}</p>)}</dd></div>)}</dl>
    {!rows.length&&<p>No equipment assigned.</p>}{item.notes&&<section><h3>Notes</h3><p style={{whiteSpace:'pre-wrap'}}>{item.notes}</p></section>}
    <footer><button className="focus-secondary" onClick={close}>Close</button><button className="focus-primary" onClick={edit}><Pencil size={16}/>Edit loadout</button></footer>
  </AccessibleDialog></div>;
}
