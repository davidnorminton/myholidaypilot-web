import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    // mapbox-gl (~1.8MB) and jspdf are dynamically imported — they load only
    // when a map renders or a PDF is generated, so their size never blocks
    // first paint. The limit below acknowledges that instead of warning on
    // every deploy.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          // long-cache vendor chunks: these change far less often than app code
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'icons': ['lucide-react'],
        },
      },
    },
  },
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
        // Never serve the app shell for API calls, the sitemap/robots files, or
        // anything with a file extension (e.g. .xml, .txt) — let those hit the
        // server so the real static file is returned instead of "Lost the trail".
        navigateFallbackDenylist: [/^\/api\//, /^\/sitemap\.xml$/, /^\/robots\.txt$/, /\.[a-z0-9]+$/i],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          { // site data (regions, places, guides, hub) — fresh when online, available offline
            urlPattern: ({ url }) => url.pathname.startsWith('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'mhp-data', expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7, purgeOnQuotaError: true } },
          },
          { // self-hosted uploaded images
            urlPattern: ({ url }) => url.pathname.startsWith('/images/'),
            handler: 'CacheFirst',
            options: { cacheName: 'mhp-images', expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true } },
          },
          { // remote photos (Unsplash) — CacheFirst: once cached, serve from
            // cache with no network. purgeOnQuotaError lets it evict oldest
            // entries when storage is full instead of throwing QuotaExceeded.
            urlPattern: ({ url }) => url.origin === 'https://images.unsplash.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'mhp-remote-img',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          { // live image manifest from the DB — SWR so builder edits show up
            // but repeat navigations are instant from cache.
            urlPattern: ({ url }) => url.pathname === '/api/images',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'mhp-img-manifest', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24, purgeOnQuotaError: true } },
          },
          { // public site settings (hub images, hero, toggles) — SWR so the hub
            // cards render from cache instantly instead of waiting on the DB.
            // Only the public GET (no ?all); the admin view sends no-store.
            urlPattern: ({ url }) => url.pathname === '/api/settings' && !url.search.includes('all'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'mhp-settings', expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 } },
          },
          {
            // public trip-ideas list (per-country variants) — instant repeats, refreshed in background
            urlPattern: ({ url }) => url.pathname === '/api/gallery' && !url.search.includes('mine') && !url.search.includes('admin') && !url.search.includes('slug'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'mhp-gallery', expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24, purgeOnQuotaError: true } },
          },
          {
            // public blog posts (list, pages, single) — instant repeats, refreshed in background
            urlPattern: ({ url }) => url.pathname.startsWith('/api/posts') && !url.search.includes('all'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'mhp-posts', expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24, purgeOnQuotaError: true } },
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
