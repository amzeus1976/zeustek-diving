import { SharedLinkVisitor } from '@/components/sharing/shared-link-visitor';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Selected snapshot · ZeusTek Diving',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export default function SharePage() {
  return <SharedLinkVisitor />;
}
