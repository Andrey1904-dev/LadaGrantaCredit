import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base '/LadaGrantaCredit/' нужен только для продакшн-билда на GitHub Pages
// (https://<user>.github.io/LadaGrantaCredit/). В dev-режиме используем '/',
// чтобы превью было доступно сразу с корневого URL.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'build' ? '/LadaGrantaCredit/' : '/',
  server: {
    // разрешаем превью-хосты песочницы (*.e2b.app)
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
  },
  preview: {
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
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
