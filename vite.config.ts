import { defineConfig, loadEnv } from 'vite'
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

/**
 * Токен BotFather в VITE_* — это утечка: Vite подставляет значение переменной
 * в открытый JS-бандл, и любой посетитель сайта получает управление ботом.
 * Поэтому сборка падает сразу, а не выкладывает секрет на Pages.
 * (Именно так появился запрос «Не удалось связаться с ботом (405)»: в
 * VITE_TELEGRAM_API_URL лежал токен, и браузер стучался на домен самого сайта.)
 */
function assertNoTelegramToken(env: Record<string, string>) {
  const tokenLike = /^\d{6,12}:[A-Za-z0-9_-]{25,}$/
  for (const key of ['VITE_TELEGRAM_API_URL', 'VITE_TELEGRAM_BOT_USERNAME']) {
    const value = (env[key] ?? '').trim()
    if (!tokenLike.test(value)) continue
    throw new Error(
      `\n\nПеременная ${key} содержит токен бота BotFather.\n` +
        'Токен нельзя передавать в браузерную сборку: он попадает в открытый JS на сайте.\n' +
        'Что сделать:\n' +
        '  1) отзовите токен командой /revoke в @BotFather (он уже скомпрометирован);\n' +
        '  2) в VITE_TELEGRAM_API_URL укажите HTTPS-адрес API бота,\n' +
        '     например https://<project-ref>.supabase.co/functions/v1/telegram-api;\n' +
        '  3) сам токен храните только в секретах сервиса бота (bot/.env, Supabase secrets).\n',
    )
  }
}

// base '/LadaGrantaCredit/' нужен только для продакшн-билда на GitHub Pages
// (https://<user>.github.io/LadaGrantaCredit/). В dev-режиме используем '/',
// чтобы превью было доступно сразу с корневого URL.
export default defineConfig(({ command, mode }) => {
  assertNoTelegramToken(loadEnv(mode, process.cwd(), 'VITE_'))
  return {
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
  }
})
