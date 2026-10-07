import type { Metadata } from 'next';
import { PhoneOfflineBootstrap } from '../../../components/phone/phone-offline-bootstrap';

/** Public shell only: never embeds identity, records, authentication or credentials. */
export const metadata: Metadata = {
  title: 'ZeusTek Diving — Offline',
  manifest: '/phone/manifest.webmanifest',
};
export default function PhoneOfflinePage() {
  return <PhoneOfflineBootstrap />;
}
