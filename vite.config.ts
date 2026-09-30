import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Браузер обращается к тому же origin; только Vite проксирует запросы к API.
// В опубликованной сборке задайте VITE_TELEGRAM_API_URL на внешний HTTPS endpoint.
const telegramApiProxy = () => ({
  '/telegram-api': {
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/telegram-api/, ''),
  },
})

// base '/LadaGrantaCredit/' нужен только для продакшн-билда на GitHub Pages
// (https://<user>.github.io/LadaGrantaCredit/). В dev-режиме используем '/',
// чтобы превью было доступно сразу с корневого URL.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'build' ? '/LadaGrantaCredit/' : '/',
  server: {
    // разрешаем превью-хосты песочницы (*.e2b.app)
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
    proxy: telegramApiProxy(),
  },
  preview: {
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
    proxy: telegramApiProxy(),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
}))
