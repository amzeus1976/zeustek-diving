'use client';
import type { PhoneSyncProgress } from '../../lib/phone/sync-progress';
import styles from './phone.module.css';

export function PhoneSyncCard({ online, busy, ready, downloadedAt, pauseEdits, error, message, progress, people, centres, onSync }: {
  online: boolean; busy: boolean; ready: boolean; downloadedAt?: string | undefined;
  pauseEdits: boolean; error: string; message: string; progress: PhoneSyncProgress | null;
  people: number; centres: number; onSync: () => void;
}) {
  return <section className={styles.card} aria-label="Sync & offline" aria-busy={busy}>
    <h2>Sync &amp; offline</h2>
    <p className={styles.muted}>Last complete download: {downloadedAt ? new Date(downloadedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not downloaded'}</p>
    {busy ? <div className={styles.syncProgress}>
      <div><strong>Downloading</strong><strong>{progress?.percent ?? 0}%</strong></div>
      <progress aria-label="Phone download progress" max={100} value={progress?.percent ?? 0} />
      <output className={styles.notice}>{progress?.label || 'Starting download…'}</output>
      <p className={styles.muted}>Keep ZeusTek open until finished. Any required app refresh happens automatically.</p>
    </div> : <>
      {error ? <p className={styles.error} role="alert">{error}</p> : <output className={styles.notice}>
        {!online ? 'Offline. Downloaded records are available and changes stay on this phone.' : pauseEdits ? 'Sync before editing. Your current draft is saved on this phone.' : message || (ready ? 'Phone app and downloaded records are ready offline.' : 'Download your saved People, Dive Centres, bookings and plans before leaving coverage.')}
      </output>}
      <button type="button" className={`${styles.primary} ${styles.wide}`} disabled={!online} onClick={onSync}>{error ? 'Retry sync & download' : 'Sync & download'}</button>
    </>}
    <p className={styles.muted}>{people} People · {centres} Dive Centres saved on this phone.</p>
    <p className={styles.muted}>Saved changes upload when you tap Sync &amp; download. Full planning details and booking codes are included. Document attachments need a separate download.</p>
  </section>;
}
