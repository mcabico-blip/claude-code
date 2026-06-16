import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // PWA offline rule: the shell must render without signal; field capture
    // queues client-side and syncs later.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'UBI Construction Suite',
        short_name: 'UBI Suite',
        description: 'Construction management for Ulticon Builders + Omega Asia',
        theme_color: '#0f2233',
        background_color: '#f3f5f7',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
