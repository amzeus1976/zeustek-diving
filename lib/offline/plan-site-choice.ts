import type { DiveSiteRecord, Stored } from './dive-planning';

/** A datalist value must identify one canonical Site, even when names repeat. */
export function siteChoiceLabel(site: Stored<DiveSiteRecord>): string {
  const context = [site.location, site.region, site.country, site.waterType, site.siteType, site.maxDepthM == null ? null : `${site.maxDepthM} m`]
    .map((value) => String(value ?? '').trim()).filter(Boolean).join(' · ');
  return `${site.name}${context ? ` · ${context}` : ''} · ID ${site.entityId.slice(-8)}`;
}

export function matchSiteChoice(sites: Array<Stored<DiveSiteRecord>>, value: string): Stored<DiveSiteRecord> | null {
  const query = value.trim().toLocaleLowerCase('en-GB');
  if (!query) return null;
  const labelled = sites.find((site) => siteChoiceLabel(site).toLocaleLowerCase('en-GB') === query);
  if (labelled) return labelled;
  const named = sites.filter((site) => site.name.trim().toLocaleLowerCase('en-GB') === query);
  return named.length === 1 ? named[0] ?? null : null;
}

/** Reject invalid coordinates; never create an empty Google Maps query. */
export function siteMapQuery(site?: DiveSiteRecord | null): string | null {
  if (!site) return null;
  const lat = site.latitude;
  const lon = site.longitude;
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180)
    return `${lat},${lon}`;
  const address = [site.address, site.postcode, site.location].map((value) => value?.trim()).filter(Boolean).join(' ');
  return address || null;
}
