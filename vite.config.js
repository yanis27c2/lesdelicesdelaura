import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/les-delices-de-laura/',
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
        start_url: '/les-delices-de-laura/',
        scope: '/les-delices-de-laura/',
        icons: [
          { src: '/les-delices-de-laura/logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/les-delices-de-laura/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true
      }
    })
  ],
  server: {
    port: 5173,
  }
})
