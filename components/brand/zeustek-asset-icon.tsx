'use client';

import {useState,type CSSProperties,type ReactNode} from 'react';
import {resolveZeusTekIcon} from '../../lib/brand/zeustek-icon-resolver';

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
  const icon = resolveZeusTekIcon(name);
  const [failedSource,setFailedSource]=useState<string|null>(null);
  if (!icon || failedSource===icon.src) {
    return fallback ? <span className={className} aria-label={decorative ? undefined : label}>{fallback}</span> : null;
  }
  const style = { '--zt-asset-icon-size': `${size}px` } as CSSProperties;
  // Brand assets are manifest-backed static PNGs; intrinsic dimensions prevent layout shift.
  // oxlint-disable-next-line next/no-img-element
  return <img className={className ?? 'zeustek-asset-icon'} src={icon.src} alt={decorative ? '' : label ?? icon.label}
    aria-hidden={decorative ? 'true' : undefined} width={size} height={size} loading="lazy" decoding="async" style={style} data-zeustek-icon={icon.key} onError={()=>setFailedSource(icon.src)}/>;
}
