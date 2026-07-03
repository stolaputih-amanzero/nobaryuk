import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-preview.png'],
      manifest: {
        name: 'AmantraX - Cinematix Elite',
        short_name: 'AmantraX',
        description: "Nobar's ticketing solution",
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'logo-preview.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo-preview.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo-preview.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true, // Tambahkan baris ini agar ngrok diizinkan
  }
});

