export function GET() {
  return Response.json(
    {
      id: '/',
      name: 'ZeusTek Diving',
      short_name: 'ZeusTek Diving',
      description: 'Dive-day plans, gas plans and offline logging',
      start_url: '/phone?source=pwa',
      scope: '/',
      display: 'standalone',
      background_color: '#080808',
      theme_color: '#080808',
      orientation: 'any',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    {
      headers: {
        'content-type': 'application/manifest+json',
        'cache-control': 'public, max-age=3600',
      },
    },
  );
}
