'use client';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './plan-editor-section.module.css';

/** Native disclosure keeps draft inputs mounted and does not invoke navigation. */
export function PlanEditorSection({title,children,help}:{title:string;children?:ReactNode;help?:ReactNode}) {
  return <details open className={styles.section}>
    <summary aria-label={title} className={styles.summary}>
      <span>{title}</span>
      <span aria-hidden="true" className={styles.action}>
        <span className={styles.minimise}>Minimise</span>
        <span className={styles.expand}>Expand</span>
        <ChevronDown size={20}/>
      </span>
    </summary>
    <fieldset aria-label={title}>{help&&<div className={styles.help}>{help}</div>}{children}</fieldset>
  </details>;
}
