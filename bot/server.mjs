/**
 * Node.js-транспорт бота LADA Assistant: long polling + HTTP API для сайта.
 *
 * Вся логика (тексты, команды, работа с Supabase) живёт в `core.mjs`, чтобы
 * webhook-версия для Supabase Edge Functions использовала тот же код.
 *
 * Запуск: npm run bot:start (переменные окружения см. bot/.env.example)
 */
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { ApiError, createBot, readBearerToken } from './core.mjs'

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '')
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY ?? '').trim()
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim()
const WEB_APP_URL = (process.env.WEB_APP_URL ?? '').trim()
const PORT = Number(process.env.PORT || 3001)
const MAX_BODY_BYTES = 4 * 1024
const IP_RATE_WINDOW_MS = 10 * 60 * 1000
const IP_RATE_LIMIT = 40
const USER_RATE_LIMIT = 8
const rateBuckets = new Map()

let polling = true
let pollingStatus = 'starting'
let lastSuccessfulPollAt = null

function validateEnvironment() {
  const missing = []
  if (!SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY')
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!TELEGRAM_BOT_TOKEN) missing.push('TELEGRAM_BOT_TOKEN')
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) missing.push('PORT (1–65535)')
  if (missing.length) {
    throw new Error(`Не заданы переменные окружения: ${missing.join(', ')}. См. bot/.env.example.`)
  }
  if (!SUPABASE_URL.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(SUPABASE_URL)) {
    throw new Error('SUPABASE_URL должен быть HTTPS-адресом (локальный HTTP разрешён только для localhost).')
  }
}

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
])
if (WEB_APP_URL) {
  try {
    allowedOrigins.add(new URL(WEB_APP_URL).origin)
  } catch {
    // WEB_APP_URL is validated by the administrator's deployment configuration.
  }
}

function applyCors(request, response) {
  const origin = request.headers.origin
  if (origin && !allowedOrigins.has(origin)) return false
  response.setHeader('Vary', 'Origin')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    response.setHeader('Access-Control-Max-Age', '600')
  }
  return true
}

function json(response, status, body) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
  })
  response.end(payload)
}

async function readJson(request) {
  const contentType = String(request.headers['content-type'] ?? '').toLowerCase()
  if (!contentType.includes('application/json')) throw new ApiError(415, 'Ожидается JSON-запрос.')
  const declared = Number(request.headers['content-length'] ?? 0)
  if (declared > MAX_BODY_BYTES) throw new ApiError(413, 'Слишком большой запрос.')
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new ApiError(413, 'Слишком большой запрос.')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new ApiError(400, 'Некорректный JSON.')
  }
}

function clientIp(request) {
  // Не доверяем X-Forwarded-For: оно может быть подделано, если API открыт напрямую.
  return request.socket.remoteAddress || 'unknown'
}

function consumeRateLimit(key, limit) {
  const now = Date.now()
  const current = rateBuckets.get(key)
  if (!current || now - current.startedAt >= IP_RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 })
    if (rateBuckets.size > 5_000) {
      for (const [bucket, state] of rateBuckets) {
        if (now - state.startedAt >= IP_RATE_WINDOW_MS) rateBuckets.delete(bucket)
      }
    }
    return true
  }
  if (current.count >= limit) return false
  current.count += 1
  return true
}

export async function start() {
  validateEnvironment()
  const bot = createBot({
    telegramToken: TELEGRAM_BOT_TOKEN,
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    webAppUrl: WEB_APP_URL,
  })

  async function handleApi(request, response) {
    const url = new URL(request.url ?? '/', 'http://internal.invalid')
    const route = `${request.method} ${url.pathname}`

    if (route === 'GET /health') {
      const report = bot.healthReport({ mode: 'polling', pollingStatus, lastSuccessfulAt: lastSuccessfulPollAt })
      json(response, report.ok ? 200 : 503, report)
      return
    }

    if (route === 'GET /api/telegram/link/status') {
      json(response, 200, await bot.linkStatus(readBearerToken(request.headers.authorization)))
      return
    }

    if (route === 'POST /api/telegram/link/confirm') {
      if (!consumeRateLimit(`ip:${clientIp(request)}`, IP_RATE_LIMIT)) {
        throw new ApiError(429, 'Слишком много попыток. Подождите несколько минут.')
      }
      const user = await bot.verifySiteSession(readBearerToken(request.headers.authorization))
      if (!consumeRateLimit(`user:${user.id}`, USER_RATE_LIMIT)) {
        throw new ApiError(429, 'Лимит попыток для аккаунта исчерпан. Запросите новый код позже.')
      }
      const body = await readJson(request)
      json(response, 200, await bot.confirmLinkForUser(user.id, body?.code))
      return
    }

    if (route === 'DELETE /api/telegram/link') {
      json(response, 200, await bot.unlink(readBearerToken(request.headers.authorization)))
      return
    }

    throw new ApiError(404, 'Маршрут не найден.')
  }

  async function pollingLoop() {
    let offset = 0
    while (polling) {
      try {
        const updates = await bot.telegramCall('getUpdates', {
          offset,
          timeout: 45,
          allowed_updates: ['message', 'callback_query'],
        }, 55_000)
        lastSuccessfulPollAt = Date.now()
        pollingStatus = 'online'
        for (const update of updates ?? []) {
          offset = Math.max(offset, Number(update.update_id) + 1)
          try {
            await bot.handleUpdate(update)
          } catch (error) {
            console.error('[telegram] update handler failed:', error instanceof Error ? error.message : 'unknown error')
            const chatId = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id
            if (chatId) {
              try {
                await bot.sendMessage(chatId, 'Сервис временно недоступен. Попробуйте ещё раз чуть позже.')
              } catch {
                // Telegram API недоступен — следующий long-poll запрос повторит связь.
              }
            }
          }
        }
      } catch (error) {
        if (!polling) break
        pollingStatus = 'degraded'
        console.error('[telegram] polling failed:', error instanceof Error ? error.message : 'unknown error')
        await new Promise((resolve) => setTimeout(resolve, 3_000))
      }
    }
  }

  const botInfo = await bot.telegramCall('getMe')
  await bot.telegramCall('deleteWebhook', { drop_pending_updates: false })
  await bot.applyBotProfile()

  const server = createServer(async (request, response) => {
    if (!applyCors(request, response)) {
      json(response, 403, { error: 'Origin is not allowed.' })
      return
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Cache-Control': 'no-store' })
      response.end()
      return
    }
    try {
      await handleApi(request, response)
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500
      if (status >= 500) {
        console.error('[api] request failed:', error instanceof Error ? error.message : 'unknown error')
      }
      json(response, status, {
        error: error instanceof Error ? error.message : 'Внутренняя ошибка сервера.',
      })
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(PORT, '0.0.0.0', resolve)
  })

  console.log(`LADA Telegram API listening on 0.0.0.0:${PORT}`)
  console.log(`Telegram bot @${botInfo.username} is ready.`)
  if (!WEB_APP_URL) console.warn('WEB_APP_URL is empty: the bot will not show the website shortcut button.')
  void pollingLoop()

  const stop = () => {
    polling = false
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2_000).unref()
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  start().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Bot startup failed.')
    process.exitCode = 1
  })
}
