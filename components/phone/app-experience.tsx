'use client';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import {
  choosePhoneInterface,
  readInterfaceMode,
  saveInterfaceMode,
} from '../../lib/phone/interface-mode';
import { phoneWorkerMessage } from '../../lib/phone/offline-shell';

const subscribe = () => () => {};
const clientMode = () =>
  choosePhoneInterface(
    readInterfaceMode(window.location.search),
    Math.min(screen.width, screen.height),
    matchMedia('(pointer: coarse)').matches,
  )
    ? 'phone'
    : 'full';

/** Desktop markup and styles remain in the existing component, unchanged. */
export default function AppExperience({ children }: { children: ReactNode }) {
  const resolved = useSyncExternalStore(subscribe, clientMode, () => 'full');
  useEffect(() => {
    const mode = readInterfaceMode(window.location.search);
    if (resolved === 'phone') {
      const query = new URLSearchParams(window.location.search);
      query.delete('interface');
      window.location.replace('/phone' + (query.size ? '?' + query : ''));
      return;
    }
    if (mode === 'full') {
      saveInterfaceMode('full');
      void phoneWorkerMessage('CLEAR_PHONE_ENTRY').catch(() => false);
    }
  }, [resolved]);
  return resolved === 'full' ? (
    children
  ) : (
    <output>Opening ZeusTek Diving…</output>
  );
}
