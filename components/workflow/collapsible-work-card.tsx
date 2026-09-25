'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {recordNavigation} from '../../lib/editor/navigation-guard';
import styles from './collapsible-work-card.module.css';

export interface CardDensityRenderState { expanded: boolean; previewLimit: number }

export interface CollapsibleWorkCardProps {
  id: string;
  title: string;
  eyebrow?: string;
  status?: ReactNode;
  alert?: ReactNode;
  defaultMinimized?: boolean;
  defaultExpanded?: boolean;
  rowCount?: number;
  previewLimit?: number;
  onOpenDetail?: () => void;
  actions?: ReactNode;
  className?: string;
  children: ReactNode | ((state: CardDensityRenderState) => ReactNode);
}

function keyFor(id: string) { return `zeustek-card-density:${id}`; }

function readPreference(storageKey: string) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as { minimized?: boolean; expanded?: boolean } : null;
  } catch { return null; }
}

export function CollapsibleWorkCard({
  id, title, eyebrow, status, alert, defaultMinimized = false, defaultExpanded = false,
  rowCount, previewLimit = 5, onOpenDetail, actions, className = '', children,
}: CollapsibleWorkCardProps) {
  const regionId = useId();
  const storageKey = useMemo(() => keyFor(id), [id]);
  const [preference] = useState(() => readPreference(storageKey));
  const [minimized, setMinimized] = useState(() => preference?.minimized ?? defaultMinimized);
  const [expanded, setExpanded] = useState(() => preference?.expanded ?? defaultExpanded);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ minimized, expanded })); } catch { /* Device preference only. */ }
  }, [storageKey, minimized, expanded]);

  const canShowMore = rowCount != null && rowCount > previewLimit;
  const content = typeof children === 'function' ? children({ expanded, previewLimit }) : children;
  return (
    <section id={id} className={`${styles.card} ${className}`} data-zeustek-density-card="true" data-minimized={minimized || undefined}>
      <header className={styles.header}>
        <div className={styles.heading}>
          {eyebrow && <span className="focus-eyebrow">{eyebrow}</span>}
          <h2>{onOpenDetail ? <button type="button" className={styles.headingButton} onClick={onOpenDetail} aria-label={`Open ${title}`}>{title}</button> : title}</h2>
          {(status || alert) && <output className={styles.status} aria-live="polite">{status}{alert && <strong role="alert">{alert}</strong>}</output>}
        </div>
        <div className={styles.controls}>
          {actions}
          {canShowMore && !minimized && <button type="button" className="focus-secondary" aria-controls={regionId} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Show less' : `Show more${rowCount ? ` (${rowCount - previewLimit})` : ''}`}</button>}
          <button type="button" className={`${styles.densityButton} focus-secondary`} aria-controls={regionId} aria-expanded={!minimized} aria-label={`${minimized ? 'Expand' : 'Collapse'} ${title}`} title={`${minimized ? 'Expand' : 'Collapse'} ${title}`} onClick={() => recordNavigation.request(() => setMinimized((value) => !value))}><span aria-hidden="true">{minimized ? '+' : '−'}</span></button>
        </div>
      </header>
      {!minimized && <div id={regionId} className={styles.body} data-expanded={expanded || undefined}>{content}</div>}
    </section>
  );
}
