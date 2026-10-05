'use client';
import {useId,useState} from 'react';
import {eventTextPreview} from '../../lib/planning/calendar-booking-workflow';
import styles from './planning-pages.module.css';
export function CalendarEventText({text,label}:{text:string;label:string}){
 const id=useId();const [expanded,setExpanded]=useState(false);const summary=eventTextPreview(text);
 return <div className={styles.eventText}><span id={id}>{expanded?text:summary.preview}</span>{summary.truncated&&<button type="button" className="focus-link" aria-expanded={expanded} aria-controls={id} aria-label={`${expanded?'Show less':'Show more'} ${label}`} onClick={()=>setExpanded(value=>!value)}>{expanded?'Less':'… More'}</button>}</div>;
}
