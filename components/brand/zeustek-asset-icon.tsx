'use client';

import type { CSSProperties, ReactNode } from 'react';
import { findZeusTekIcon } from '../../lib/brand/zeustek-icon-registry';

export function ZeusTekAssetIcon({
  name,
  label,
  size = 40,
  className,
  decorative = false,
  fallback = null,
}: {
  name?: string | null;
  label?: string;
  size?: number;
  className?: string;
  decorative?: boolean;
  fallback?: ReactNode;
}) {
  const icon = findZeusTekIcon(name);
  if (!icon) {
    return fallback ? <span className={className} aria-label={decorative ? undefined : label}>{fallback}</span> : null;
  }
  const style = { '--zt-asset-icon-size': `${size}px` } as CSSProperties;
  // Brand assets are manifest-backed static PNGs; intrinsic dimensions prevent layout shift.
  // oxlint-disable-next-line next/no-img-element
  return <img className={className ?? 'zeustek-asset-icon'} src={icon.src} alt={decorative ? '' : label ?? icon.label}
    aria-hidden={decorative ? 'true' : undefined} width={size} height={size} loading="lazy" decoding="async" style={style} data-zeustek-icon={icon.key}/>;
}
