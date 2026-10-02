'use client';
import {useOwnerDataReviewPermission} from './use-owner-data-review';
import {workflowDestinationUrl} from '../../lib/workflow/workflow-destination';
import styles from './data-review.module.css';
export function DataReviewLinks({go}:{go:(destination:string)=>void}){
 const allowed=useOwnerDataReviewPermission();if(!allowed)return null;
 return <DataReviewLinkControls go={go}/>;
}
export function DataReviewLinkControls({go}:{go:(destination:string)=>void}){
 return <section className={styles.workspace} id="evidence-review-tools" aria-label="Owner data review tools"><h2>Evidence &amp; data review</h2><p>Inspect the device snapshot without repairs, or choose a private calendar download. Nothing is published or synchronised by opening these tools.</p><div className={styles.controls}>{[['Evidence & data health','Review evidence & data'],['Calendar download','Choose calendar download']].map(([tab,label])=>{const destination=workflowDestinationUrl({route:'Data & Backups',params:{tab:tab!}});return <a key={tab} className="focus-secondary" href={`/${destination}`} onClick={event=>{event.preventDefault();go(destination);}}>{label}</a>;})}</div></section>;
}
