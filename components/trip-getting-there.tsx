'use client';
import {useId,useState} from 'react';
import type {DiveSiteRecord,PersonRecord,Stored} from '../lib/offline/dive-planning';
import {ownerHomeAddress,siteRoadArrival,tripDirectionsUrl} from '../lib/planning/trip-directions';
import {TripSection} from './trip-disclosure';
import styles from './trip-getting-there.module.css';
export function TripGettingThere({siteIds,sites,people,arrivalPoint='',arrivalSource='owner',onArrivalChange}:{siteIds:string[];sites:Array<Stored<DiveSiteRecord>>;people:Array<Stored<PersonRecord>>;arrivalPoint?:string;arrivalSource?:'site'|'owner';onArrivalChange?:((value:string,source?:'site'|'owner')=>void)|undefined}){
 const id=useId();const linked=sites.filter(site=>siteIds.includes(site.entityId));
 const [origin,setOrigin]=useState<'current'|'home'|'address'>('current');const [address,setAddress]=useState('');
 const [temporaryArrival,setTemporaryArrival]=useState(arrivalPoint);
 const [destinationChoice,setDestinationChoice]=useState({arrival:arrivalPoint,id:arrivalPoint.trim()?'custom':linked.length===1&&siteRoadArrival(linked[0])?linked[0]!.entityId:''});
 const destinationId=destinationChoice.arrival===arrivalPoint?destinationChoice.id:arrivalPoint.trim()?'custom':linked.length===1&&siteRoadArrival(linked[0])?linked[0]!.entityId:'';
 const setDestinationId=(next:string)=>setDestinationChoice({arrival:arrivalPoint,id:next});
 const custom=onArrivalChange?arrivalPoint:temporaryArrival;const selectedSite=linked.find(site=>site.entityId===destinationId);
 const destination=destinationId==='custom'?custom:siteRoadArrival(selectedSite)??'';const home=ownerHomeAddress(people);
 const owners=people.filter(person=>person.roles?.ownerProfile);const owner=owners.length===1?owners[0]:null;
 const url=tripDirectionsUrl(destination,origin==='current'?{kind:'current'}:{kind:origin,address:origin==='home'?home??'':address});
 return <TripSection title="Getting there" className={`focus-card ${styles.panel}`}>
  <p>Review your driving journey, then open Google Maps for approximate travel time and directions.</p>
  <div className={styles.controls}>
   <label htmlFor={`${id}-origin`}>Starting point<select id={`${id}-origin`} value={origin} onChange={event=>setOrigin(event.target.value as typeof origin)}><option value="current">Current location</option><option value="home" disabled={!home}>Home{home?'':' — address not recorded'}</option><option value="address">Address / postcode</option></select></label>
   <label htmlFor={`${id}-destination`}>Driving destination<select id={`${id}-destination`} value={destinationId} onChange={event=>{const next=event.target.value;setDestinationId(next);const site=linked.find(site=>site.entityId===next),road=siteRoadArrival(site);if(onArrivalChange&&site&&(!arrivalPoint.trim()||arrivalSource==='site'))onArrivalChange(road??'','site');}}><option value="">Choose an arrival point</option>{linked.map(site=><option key={site.entityId} value={site.entityId}>{site.name} · {siteRoadArrival(site)??'Road address not recorded'}</option>)}<option value="custom">Harbour / meeting point / arrival address</option></select></label>
   {origin==='address'&&<label className={styles.wide} htmlFor={`${id}-address`}>Starting address / postcode<input id={`${id}-address`} value={address} onChange={event=>setAddress(event.target.value)} autoComplete="off" placeholder="Address, postcode and country"/></label>}
   {origin==='home'&&<p className={styles.wide}><strong>Home:</strong> {home||'Unavailable'}</p>}
   {!home&&<p className={styles.wide}>Home needs a recorded address or postcode.{owner&&<> <a className="focus-link" href={`/?${new URLSearchParams({section:'People',personId:owner.entityId})}`}>Edit your owner profile</a></>}</p>}
   {(onArrivalChange||destinationId==='custom')&&<label className={styles.wide} htmlFor={`${id}-arrival`}>{onArrivalChange?'Saved harbour / meeting point / arrival address':'Temporary arrival address'}<input id={`${id}-arrival`} value={custom} onChange={event=>{setDestinationId('custom');if(onArrivalChange)onArrivalChange(event.target.value,'owner');else setTemporaryArrival(event.target.value);}} autoComplete="off" placeholder="Harbour, entrance or parking address and postcode"/>{onArrivalChange?<small>Saved with this Trip only when you choose Save trip. Selecting a Site fills empty or previously Site-filled arrival fields; your own entries stay unchanged.</small>:<small>For this journey only. Use Edit trip to save an arrival point.</small>}</label>}
   {selectedSite&&<p className={styles.wide}><strong>Road arrival:</strong> {destination||'No road address recorded. Choose a harbour or meeting point instead.'} <a className="focus-link" href={`/?${new URLSearchParams({section:'Sites',siteId:selectedSite.entityId})}`}>View Site</a></p>}
  </div>
  <p className={styles.notice}>{origin==='current'?'Google Maps will ask for or choose your starting location. ':''}Opening directions shares the selected journey with Google Maps. Starting points are not saved in the Trip. Estimates appear in Google Maps and may change; they are not a forecast for your Trip date.</p>
  {url?<a className={`focus-primary ${styles.route}`} href={url} target="_blank" rel="noopener noreferrer">Travel time &amp; directions in Google Maps ↗</a>:<output>Choose a valid starting point and road arrival address before opening directions. Keep addresses short enough for a Maps link.</output>}
 </TripSection>;
}
