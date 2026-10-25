import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(process.env.VERCEL ? [] : [cloudflare()]),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.svg'],
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallbackDenylist: [/^\/api\//, /^\/assets\//, /\.[a-zA-Z0-9]+$/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'CAREFARM POS',
        short_name: 'CAREFARM',
        description: 'CareFarm Point of Sale and Inventory Management',
        theme_color: '#0d1f1a',
        background_color: '#0d1f1a',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/maskable-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');

          if (normalized.includes('node_modules')) {
            if (
              normalized.includes('/react/') ||
              normalized.includes('/react-dom/') ||
              normalized.includes('/react-router-dom/') ||
              normalized.includes('recharts') ||
              normalized.includes('/d3-')
            ) return 'react';
            if (normalized.includes('@tanstack/react-query')) return 'query';
            if (normalized.includes('react-hook-form')) return 'forms';
            if (normalized.includes('lucide-react')) return 'ui';
            if (normalized.includes('socket.io-client')) return 'realtime';
            if (normalized.includes('dexie') || normalized.includes('zustand')) return 'storage';
            if (
              normalized.includes('@capacitor/') ||
              normalized.includes('@capacitor-mlkit/') ||
              normalized.includes('@aparajita/') ||
              normalized.includes('@capgo/')
            ) {
              return 'native';
            }
          }

          if (normalized.includes('/src/pages/')) {
            if (normalized.includes('/src/pages/pos/')) return 'pos-pages';
            if (normalized.includes('/src/pages/marketer/')) return 'marketer-pages';
            if (normalized.includes('/src/pages/admin/')) {
              if (normalized.includes('Report') || normalized.includes('Audit')) return 'admin-reports';
              if (
                normalized.includes('Finance') ||
                normalized.includes('Cash') ||
                normalized.includes('Salary') ||
                normalized.includes('Reconciliation')
              ) return 'admin-finance';
              if (
                normalized.includes('Product') ||
                normalized.includes('Inventory') ||
                normalized.includes('Stock') ||
                normalized.includes('Purchase') ||
                normalized.includes('Transfer') ||
                normalized.includes('Supplier')
              ) return 'admin-inventory';
              return 'admin-pages';
            }
          }

          return undefined;
        },
      },
    },
  },
})
