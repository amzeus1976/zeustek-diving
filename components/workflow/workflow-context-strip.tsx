'use client';

import { ChevronRight } from 'lucide-react';
import styles from './workflow-context-strip.module.css';

export interface WorkflowContextAction { label: string; route?: string; unavailable?: string }

export function WorkflowContextStrip({ from, current, next, go }: { from: WorkflowContextAction[]; current: string; next: WorkflowContextAction[]; go: (route: string) => void }) {
  const actions = (items: WorkflowContextAction[]) => items.map((item) => item.route
    ? <button key={item.label} type="button" onClick={() => { if (item.route) go(item.route); }}>{item.label}</button>
    : <span key={item.label} title={item.unavailable}>{item.label}<small>{item.unavailable}</small></span>);
  return <details className={styles.strip}>
    <summary aria-label={`Show workflow links for ${current}`}><span>Workflow</span><strong>{current}</strong><i aria-hidden="true"/></summary>
    <nav className={styles.content} aria-label={`${current} workflow`}>
      <div><b>From</b>{actions(from)}</div><ChevronRight aria-hidden="true"/>
      <div className={styles.current}><b>This page</b><strong>{current}</strong></div><ChevronRight aria-hidden="true"/>
      <div><b>Next</b>{actions(next)}</div>
    </nav>
  </details>;
}
