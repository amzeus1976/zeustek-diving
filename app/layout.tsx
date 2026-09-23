import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './journal-enhancements.css';
import './platform.css';
import './theme-overrides.css';
import './focus.css';
import './issue-register.css';
import './audit-improvements.css';
import './t14-record-workspaces.css';
import './t14-cpd-news.css';
import { PwaRegister } from '@/components/pwa-register';

const geistSans = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const geistMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Zeustek Dive',
  description: 'A private cloud dive logbook, equipment tracker, site guide and training record.',
  openGraph: { title: 'Zeustek Dive', description: 'Dive logs, sites, equipment and training — private and available across devices.', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'Zeustek Dive', description: 'Dive logs, sites, equipment and training — private and available across devices.', images: ['/og.png'] },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Zeustek Dive' },
  icons: { apple: '/apple-touch-icon.png', icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }] },
};

export const viewport: Viewport = { themeColor: '#080808', colorScheme: 'dark', viewportFit: 'cover' };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
