import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative asset URLs let the same build work at a domain root, a GitHub
  // Pages repository path, or any other static hosting subdirectory.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['songbook-icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Songbook',
        short_name: 'Songbook',
        description: 'An offline ChordPro song viewer for rehearsals and performances.',
        theme_color: '#4338ca',
        background_color: '#f7f8fb',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{html,js,css}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
});
