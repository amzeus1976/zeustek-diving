'use client';

import {useState,type CSSProperties,type ReactNode} from 'react';
import {resolveZeusTekIcon} from '../../lib/brand/zeustek-icon-resolver';
import {navigationIconForRoute} from '../../lib/brand/navigation-icons';

export function ZeusTekAssetIcon({
  name,
  route,
  label,
  size = 40,
  className,
  decorative = false,
  fallback = null,
}: {
  name?: string | null;
  route?: string;
  label?: string;
  size?: number;
  className?: string;
  decorative?: boolean;
  fallback?: ReactNode;
}) {
  const navIcon=route?navigationIconForRoute(route):null;
  const icon = navIcon??resolveZeusTekIcon(name);
  const [failedSource,setFailedSource]=useState<string|null>(null);
  if (!icon || failedSource===icon.src) {
    return fallback ? <span className={className} aria-label={decorative ? undefined : label}>{fallback}</span> : null;
  }
  const style = { '--zt-asset-icon-size': `${size}px`, '--zt-nav-icon-scale': navIcon?.scale??1 } as CSSProperties;
  // Brand assets are manifest-backed static PNGs; intrinsic dimensions prevent layout shift.
  // oxlint-disable-next-line next/no-img-element
  return <img className={className ?? 'zeustek-asset-icon'} src={icon.src} alt={decorative ? '' : label ?? icon.label}
    aria-hidden={decorative ? 'true' : undefined} width={size} height={size} loading="lazy" decoding="async" style={style} data-zeustek-icon={icon.key} data-zeustek-nav-route={route} onError={()=>setFailedSource(icon.src)}/>;
}
