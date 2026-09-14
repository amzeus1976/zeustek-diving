'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from './trips-expeditions.module.css';

// Native disclosures hide content without unmounting upload/link drafts.
export function TripSection({title,children,className=''}:{title:string;children:ReactNode;className?:string}) {
  return <section className={className}><details className={styles.sectionDisclosure} open>
    <summary><h3>{title}</h3></summary><div className={styles.sectionContents}>{children}</div>
  </details></section>;
}

export function TripNote({text,label='notes'}:{text:string;label?:string}) {
  const ref=useRef<HTMLParagraphElement>(null);const id=useId();
  const [expanded,setExpanded]=useState(false);const [overflows,setOverflows]=useState(false);
  useEffect(()=>{
    const element=ref.current;if(!element || expanded)return;
    const measure=()=>setOverflows(element.scrollHeight>element.clientHeight+1);
    measure();const observer=new ResizeObserver(measure);observer.observe(element);
    return()=>observer.disconnect();
  },[text,expanded]);
  return <div className={styles.notePreview}>
    <p ref={ref} id={id} className={expanded?styles.fullNote:styles.shortNote}>{text}</p>
    {(overflows||expanded)&&<button type="button" className="focus-secondary" aria-expanded={expanded} aria-controls={id}
      aria-label={`${expanded?'Show less':'Show more'} ${label}`} onClick={()=>setExpanded(current=>!current)}>{expanded?'Show less':'Show more'}</button>}
  </div>;
}
