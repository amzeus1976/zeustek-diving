'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readPhoneAccount } from '../../lib/phone/offline-access';
import PhoneApp from './phone-app';

export function PhoneOfflineBootstrap() {
  const [account, setAccount] = useState<string | null | undefined>();
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    void readPhoneAccount()
      .then((value) => {
        if (alive) setAccount(value?.account ?? null);
      })
      .catch(() => {
        if (alive) {
          setAccount(null);
          setError(
            'Local storage could not be opened. Reconnect to retry; do not remove the app or clear saved data.',
          );
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  if (account === undefined)
    return <output>Opening saved dive records…</output>;
  if (!account)
    return (
      <main>
        <h1>Connect to prepare this phone</h1>
        <p>
          {error ||
            'Sign in and download your plans inside this app before using it offline.'}
        </p>
        <Link href="/phone">Open ZeusTek Diving</Link>
      </main>
    );
  return <PhoneApp userId={account} verifiedOnline={false} />;
}
