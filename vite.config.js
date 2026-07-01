import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'myholidaypilot',
        short_name: 'holidaypilot',
        description: 'Handcrafted travel guides, region by region — where to go, what to eat, and the stories behind it.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f2f1ec',
        theme_color: '#a9762a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],   // never serve the app shell for API calls
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          { // site data (regions, places, guides, hub) — fresh when online, available offline
            urlPattern: ({ url }) => url.pathname.startsWith('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'mhp-data', expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
          { // self-hosted uploaded images
            urlPattern: ({ url }) => url.pathname.startsWith('/images/'),
            handler: 'CacheFirst',
            options: { cacheName: 'mhp-images', expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          { // remote photos (Unsplash)
            urlPattern: ({ url }) => url.origin === 'https://images.unsplash.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'mhp-remote-img', expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
      devOptions: { enabled: false },   // don't run the SW during `npm run dev`
    }),
  ],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
})
