'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  validateSharedSnapshot,
  type SharedSnapshot,
} from '@/lib/sharing/share-links';
import { SharedSnapshotView } from './shared-snapshot-view';
export function SharedLinkVisitor() {
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null),
    [token, setToken] = useState(''),
    [message, setMessage] = useState('Loading selected snapshot…');
  const unavailable = useCallback(() => {
    setSnapshot(null);
    setMessage(
      'This shared snapshot is unavailable. It may have expired or been revoked.',
    );
  }, []);
  useEffect(() => {
    let active = true,
      controller: AbortController | null = null;
    const capability = window.location.hash.slice(1);
    if (!/^[A-Za-z0-9_-]{43}$/.test(capability)) {
      queueMicrotask(() => {
        if (active) unavailable();
      });
      return () => {
        active = false;
      };
    }
    async function load() {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch('/api/share', {
          headers: { authorization: `Bearer ${capability}` },
          cache: 'no-store',
          credentials: 'omit',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Unavailable');
        const next = validateSharedSnapshot(await response.json());
        if (active) {
          setToken(capability);
          setSnapshot((previous) =>
            JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
          );
          setMessage('');
        }
      } catch (error) {
        if (
          active &&
          !(error instanceof DOMException && error.name === 'AbortError')
        )
          unavailable();
      }
    }
    void load();
    const interval = setInterval(() => {
        if (document.visibilityState === 'visible') void load();
      }, 30000),
      onVisible = () => {
        if (document.visibilityState === 'visible') void load();
      };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [unavailable]);
  useEffect(() => {
    if (!snapshot?.expiresAt) return;
    const expiry = Date.parse(snapshot.expiresAt);
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = expiry - Date.now();
      if (remaining <= 0) unavailable();
      else timer = setTimeout(check, Math.min(remaining, 3600000));
    };
    check();
    return () => clearTimeout(timer);
  }, [snapshot, unavailable]);
  return (
    <main className="public-profile-view">
      {snapshot ? (
        <SharedSnapshotView
          snapshot={snapshot}
          token={token}
          onUnavailable={unavailable}
        />
      ) : (
        <section className="public-profile-card">
          <h1>ZeusTek Diving</h1>
          <output>{message}</output>
          <p>
            Only explicitly published snapshots are available through shared
            links.
          </p>
        </section>
      )}
    </main>
  );
}
