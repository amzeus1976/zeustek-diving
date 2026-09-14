import { MapPin } from 'lucide-react';
import type { DiveSiteRecord, Stored } from '../lib/offline/dive-planning';
import styles from './trips-expeditions.module.css';

export function TripLinkedSites({ siteIds, sites }: {
  siteIds: string[];
  sites: Array<Stored<DiveSiteRecord>>;
}) {
  const siteLink = (id: string) => (
    <a className="focus-link" key={id} href={`/?${new URLSearchParams({ section: 'Sites', siteId: id })}`}>
      <MapPin size={13}/>{sites.find(site => site.entityId === id)?.name ?? 'Site unavailable'}
    </a>
  );
  return <div>
    <h3>Linked Sites</h3>
    {siteIds.slice(0, 4).map(siteLink)}
    {siteIds.length > 4 && <details className={styles.linkedSitesDisclosure}>
      <summary>
        <span className={styles.moreSites}>… more <span className={styles.screenReaderOnly}>linked Dive Sites</span> ({siteIds.length - 4})</span>
        <span className={styles.lessSites}>… less <span className={styles.screenReaderOnly}>linked Dive Sites</span></span>
      </summary>
      <div className={styles.remainingSites}>{siteIds.slice(4).map(siteLink)}</div>
    </details>}
    {!siteIds.length && <p className="focus-copy">No Sites linked.</p>}
  </div>;
}
