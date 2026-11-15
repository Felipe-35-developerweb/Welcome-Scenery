import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['avatar.png'],
      manifest: {
        name: 'Welcome Scenery',
        short_name: 'WScenery',
        description: 'Gestão de Turnos e Frota',
        theme_color: '#171716',
        background_color: '#171716',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/avatar.png',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: '/avatar.png',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
  }
});
