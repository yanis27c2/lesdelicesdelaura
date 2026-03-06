import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/lesdelicesdelaura/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Les délices de Laura',
        short_name: 'Délices Laura',
        description: 'Caisse enregistreuse — Les délices de Laura',
        theme_color: '#f9a8d4',
        background_color: '#fff0f6',
        display: 'standalone',
        start_url: '/lesdelicesdelaura/',
        scope: '/lesdelicesdelaura/',
        icons: [
          { src: '/lesdelicesdelaura/logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/lesdelicesdelaura/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        // Ne JAMAIS intercepter les requêtes vers Google Apps Script
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.includes('script.google.com'),
            handler: 'NetworkOnly',
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
  }
})
