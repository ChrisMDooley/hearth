/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Two build targets:
 *  - default (`npm run build`): the installable PWA with a service worker,
 *    for real hosting (Netlify, Vercel, Cloudflare Pages, any static host).
 *  - `npm run build:preview`: one self-contained HTML file, used to publish a
 *    quick phone preview. No service worker in that mode.
 */
export default defineConfig(({ mode }) => {
  const singleFile = mode === 'singlefile'
  return {
    base: './',
    publicDir: singleFile ? false : 'public',
    plugins: [
      react(),
      singleFile
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            // The site is behind a login, so the manifest must be fetched with cookies.
            useCredentials: true,
            includeAssets: ['icons/icon.svg'],
            manifest: {
              name: 'Hearth — our family baking book',
              short_name: 'Hearth',
              description: 'Our family baking library: recipes, notes and bakes.',
              theme_color: '#FBF6EE',
              background_color: '#FBF6EE',
              display: 'standalone',
              start_url: './',
              icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              // App shell + fonts are cached; all recipe data already lives on the
              // device (IndexedDB), so the whole app works offline in v1.
              globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
              // The OCR engine (~15 MB) is fetched the first time someone imports
              // a photo, then cached — not downloaded on every install.
              globIgnores: ['ocr/**'],
              maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
              runtimeCaching: [
                {
                  urlPattern: ({ url }) => url.pathname.includes('/ocr/'),
                  handler: 'CacheFirst',
                  options: { cacheName: 'ocr', expiration: { maxEntries: 10 } },
                },
                {
                  urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: { cacheName: 'fonts', expiration: { maxEntries: 20 } },
                },
              ],
            },
          }),
    ],
    test: { environment: 'node' },
  }
})
