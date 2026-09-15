import type { CSSProperties } from 'react';
import { getZeusTekIcon } from '../lib/zeustek-icons';
import styles from './zeustek-icon.module.css';

type IconSize = 'chip' | 'card' | 'heading' | 'hero';

export function ZeusTekIcon({
  id,
  size = 'card',
  label,
  className = '',
}: {
  id: string | null | undefined;
  size?: IconSize | number;
  label?: string;
  className?: string;
}) {
  const icon = getZeusTekIcon(id);
  if (!icon) return null;
  const numericStyle = typeof size === 'number'
    ? ({ '--zeustek-icon-size': `${size}px` } as CSSProperties)
    : undefined;
  // Static transparent artwork is already size-constrained by CSS and ships with the PWA.
  // oxlint-disable-next-line next/no-img-element
  return <img
    src={icon.src}
    alt={label ?? ''}
    aria-hidden={label ? undefined : true}
    className={`${styles.icon} ${typeof size === 'string' ? styles[size] : styles.custom} ${className}`}
    style={numericStyle}
    width={typeof size === 'number' ? size : undefined}
    height={typeof size === 'number' ? size : undefined}
    loading={size === 'hero' ? 'eager' : 'lazy'}
  />;
}

export function ZeusTekIconLabel({
  id,
  children,
  className = '',
}: {
  id: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`${styles.label} ${className}`}><ZeusTekIcon id={id} size="chip" />{children}</span>;
}
