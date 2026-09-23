import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import hostingConfig from './.openai/hosting.json';
import {readFileSync} from 'node:fs';
import {buildCompleteIconPrecache} from './lib/brand/icon-cache-policy';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

export default defineConfig((async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: {
      host: '0.0.0.0',
      allowedHosts: ['terminal.local'],
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    plugins: [
      vinext(),
      sites(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'app',
        filename: 'service-worker.ts',
        outDir: 'dist/client',
        injectRegister: false,
        manifest: {
          id: '/',
          name: 'Zeustek Dive',
          short_name: 'Zeustek Dive',
          description: 'Private offline-first dive logbook and planning system',
          start_url: '/?source=pwa',
          scope: '/',
          display: 'standalone',
          background_color: '#080808',
          theme_color: '#080808',
          orientation: 'any',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        injectManifest: { globDirectory: 'dist/client', globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], globIgnores:['**/node_modules/**','**/server/**','**/brand/icons/zeustek-complete/**'], additionalManifestEntries:buildCompleteIconPrecache(src=>readFileSync(`public${src}`)) },
      }) as unknown as import('vite').PluginOption,
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
  };
}) as never);
