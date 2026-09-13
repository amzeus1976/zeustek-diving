'use client';
import { useEffect } from 'react';
import { provisionLocalPlatform } from '@/lib/offline/platform';

export function PwaRegister() {
  useEffect(() => {
    void provisionLocalPlatform();
    if ('serviceWorker' in navigator) {
      const register = () => navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
      if (document.readyState === 'complete') void register();
      else window.addEventListener('load', register, { once: true });
    }
  }, []);
  return null;
}
