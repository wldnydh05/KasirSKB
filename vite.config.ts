import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/',
          name: 'Kasir Ayam Bebek S.K.B',
          short_name: 'Kasir SKB',
          description: 'Aplikasi kasir & laporan Rumah Makan Ayam Bebek S.K.B — offline-first, laba/rugi 2 cabang, ekspor CSV.',
          theme_color: '#173f2b',
          background_color: '#f3f4ef',
          lang: 'id',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        // PWA service worker disabled in dev to prevent stale-cache white screens.
        // Production build still emits the SW (registerType: autoUpdate).
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Pin port 3000. strictPort stops Vite from silently falling back to
      // 3001+ when 3000 is taken — a second origin would get its own
      // IndexedDB copy and split user data across two databases.
      port: 3000,
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Allow Vite dev server to be reached through cloudflared quick tunnels
      // (npm run tunnel). The leading dot permits every *.trycloudflare.com
      // subdomain, so a restarted tunnel with a new URL keeps working.
      allowedHosts: ['.trycloudflare.com'],
    },
  };
});
