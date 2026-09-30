/**
 * Supabase Edge Function «telegram-api» — API бота LADA Assistant.
 *
 * Тот же контракт, что у Node-сервиса из `bot/server.mjs`:
 *   GET    /health                     — статус бота (без авторизации);
 *   GET    /api/telegram/link/status   — привязан ли Telegram к аккаунту сайта;
 *   POST   /api/telegram/link/confirm  — подтвердить одноразовый код;
 *   DELETE /api/telegram/link          — отозвать доступ;
 *   POST   /                           — webhook Telegram (заголовок X-Telegram-Bot-Api-Secret-Token).
 *
 * Авторизация браузерных запросов — тот же access token Supabase, что и у сайта.
 * Токен BotFather живёт только в секретах функции и никогда не попадает в сборку сайта.
 *
 * Разворачивается командой `supabase functions deploy telegram-api`
 * (verify_jwt выключен в supabase/config.toml: JWT проверяет сама функция).
 */
import { ApiError, createBot, readBearerToken } from './core.mjs'

const FUNCTION_SLUG = 'telegram-api'
const MAX_BODY_BYTES = 4 * 1024
const RATE_WINDOW_MS = 10 * 60 * 1000
const IP_RATE_LIMIT = 60
const USER_RATE_LIMIT = 8
const rateBuckets = new Map()

let webhookCache = { at: 0, info: null }

function readEnv(name) {
  const fromDeno = typeof Deno !== 'undefined' ? Deno.env.get(name) : undefined
  const fromProcess = globalThis.process?.env?.[name]
  return String(fromDeno ?? fromProcess ?? '').trim()
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extraHeaders,
    },
  })
}

export function createApp(config = {}) {
  const supabaseUrl = config.supabaseUrl ?? readEnv('SUPABASE_URL')
  const supabaseAnonKey = config.supabaseAnonKey ?? readEnv('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = config.supabaseServiceRoleKey ?? readEnv('SUPABASE_SERVICE_ROLE_KEY')
  const telegramToken = config.telegramToken ?? readEnv('TELEGRAM_BOT_TOKEN')
  const webhookSecret = config.webhookSecret ?? readEnv('TELEGRAM_WEBHOOK_SECRET')
  const webAppUrl = config.webAppUrl ?? readEnv('WEB_APP_URL')
  const now = config.now ?? (() => Date.now())
  const fetchImpl = config.fetchImpl ?? fetch
  const logger = config.logger ?? console

  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...String(config.corsAllowedOrigins ?? readEnv('CORS_ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
  ])
  if (webAppUrl) {
    try {
      allowedOrigins.add(new URL(webAppUrl).origin)
    } catch {
      logger.warn?.('[cors] WEB_APP_URL не является корректным URL')
    }
  }

  const bot = createBot({
    telegramToken: telegramToken || 'not-configured',
    supabaseUrl: supabaseUrl || 'https://not-configured.supabase.co',
    supabaseAnonKey: supabaseAnonKey || 'not-configured',
    supabaseServiceRoleKey: supabaseServiceRoleKey || 'not-configured',
    webAppUrl,
    fetchImpl,
    logger,
    now,
  })

  const corsHeaders = (request) => {
    const origin = request.headers.get('origin')
    if (!origin || !allowedOrigins.has(origin)) return null
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    }
  }

  /** Путь внутри функции: убираем префикс /functions/v1/<slug>. */
  function routePath(pathname) {
    const markers = [
      `/functions/v1/${FUNCTION_SLUG}`,
      `/${FUNCTION_SLUG}`,
    ]

    for (const marker of markers) {
      if (pathname === marker) return '/'
      if (pathname.startsWith(`${marker}/`)) {
        return pathname.slice(marker.length) || '/'
      }
    }

    return pathname || '/'
  }

  function consumeRateLimit(key, limit) {
    const stamp = now()
    const current = rateBuckets.get(key)
    if (!current || stamp - current.startedAt >= RATE_WINDOW_MS) {
      rateBuckets.set(key, { startedAt: stamp, count: 1 })
      if (rateBuckets.size > 2_000) {
        for (const [bucket, state] of rateBuckets) {
          if (stamp - state.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(bucket)
        }
      }
      return true
    }
    if (current.count >= limit) return false
    current.count += 1
    return true
  }

  async function readJson(request) {
    const contentType = String(request.headers.get('content-type') ?? '').toLowerCase()
    if (!contentType.includes('application/json')) throw new ApiError(415, 'Ожидается JSON-запрос.')
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) throw new ApiError(413, 'Слишком большой запрос.')
    try {
      return JSON.parse(text)
    } catch {
      throw new ApiError(400, 'Некорректный JSON.')
    }
  }

  /** Статус webhook в Telegram Bot API (кэш на минуту, чтобы не дёргать API на каждый заход). */
  async function webhookInfo() {
    if (!telegramToken) return null
    if (webhookCache.info && now() - webhookCache.at < 60_000) return webhookCache.info
    try {
      const info = await bot.telegramCall('getWebhookInfo')
      webhookCache = { at: now(), info }
      return info
    } catch (error) {
      logger.warn?.('[health] getWebhookInfo failed:', error instanceof Error ? error.message : 'unknown error')
      return null
    }
  }

  async function healthResponse() {
    if (!telegramToken) {
      return json(503, {
        ok: false,
        service: 'lada-telegram-api',
        mode: 'webhook',
        configured: false,
        botPolling: 'stopped',
        lastSuccessfulPollAt: null,
        error: 'Не задан секрет TELEGRAM_BOT_TOKEN у функции telegram-api.',
      })
    }

    const info = await webhookInfo()
    const url = String(info?.url ?? '')
    const lastErrorAt = Number(info?.last_error_date ?? 0) * 1000
    const hasFreshError = lastErrorAt > 0 && now() - lastErrorAt < 10 * 60 * 1000
    const online = url.length > 0
    return json(online && !hasFreshError ? 200 : 503, {
      ok: online && !hasFreshError,
      service: 'lada-telegram-api',
      mode: 'webhook',
      configured: true,
      botPolling: !url ? 'stopped' : hasFreshError ? 'degraded' : 'online',
      lastSuccessfulPollAt: null,
      webhook: {
        url,
        pendingUpdates: Number(info?.pending_update_count ?? 0),
        lastError: hasFreshError ? String(info?.last_error_message ?? '') : '',
      },
      hint: url
        ? undefined
        : 'Webhook не установлен: выполните scripts/telegram-bot-setup.mjs или setWebhook в Telegram Bot API.',
    })
  }

  async function handleWebhook(request) {
    const provided = request.headers.get('x-telegram-bot-api-secret-token') ?? ''
    if (!webhookSecret || provided !== webhookSecret) {
      return json(403, { error: 'Webhook secret mismatch.' })
    }
    let update = null
    try {
      update = await request.json()
    } catch {
      return json(400, { error: 'Malformed update.' })
    }
    try {
      await bot.handleUpdate(update)
    } catch (error) {
      logger.error?.('[telegram] update handler failed:', error instanceof Error ? error.message : 'unknown error')
      const chatId = update?.message?.chat?.id ?? update?.callback_query?.message?.chat?.id
      if (chatId) {
        try {
          await bot.sendMessage(chatId, 'Сервис временно недоступен. Попробуйте ещё раз чуть позже.')
        } catch {
          // Telegram недоступен — update будет повторён вебхуком.
        }
      }
    }
    // Telegram считает доставку успешной только при 2xx: 200 отдаём даже при сбое обработки,
    // иначе апдейт придёт повторно и пользователь получит дубли.
    return json(200, { ok: true })
  }

  async function handleApi(request, route) {
    if (route === '/health') return healthResponse()

    if (route === '/api/telegram/link/status') {
      const status = await bot.linkStatus(readBearerToken(request.headers.get('authorization')))
      return json(200, status, cors(request) ?? {})
    }

    if (route === '/api/telegram/link/confirm') {
      const origin = request.headers.get('origin')
      if (!consumeRateLimit(`ip:${origin ?? 'unknown'}`, IP_RATE_LIMIT)) {
        throw new ApiError(429, 'Слишком много попыток. Подождите несколько минут.')
      }
      const user = await bot.verifySiteSession(readBearerToken(request.headers.get('authorization')))
      if (!consumeRateLimit(`user:${user.id}`, USER_RATE_LIMIT)) {
        throw new ApiError(429, 'Лимит попыток для аккаунта исчерпан. Запросите новый код позже.')
      }
      const body = await readJson(request)
      return json(200, await bot.confirmLinkForUser(user.id, body?.code), cors(request) ?? {})
    }

    if (route === '/api/telegram/link/delete' || route === '/api/telegram/link') {
      return json(200, await bot.unlink(readBearerToken(request.headers.get('authorization'))), cors(request) ?? {})
    }

    throw new ApiError(404, 'Маршрут не найден.')
  }

  function cors(request) {
    return corsHeaders(request)
  }

  return async function handler(request) {
    const url = new URL(request.url)
    const route = routePath(url.pathname)
    const headers = corsHeaders(request)

    if (request.headers.get('origin') && !headers) {
      return json(403, { error: 'Origin is not allowed.' })
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: headers ?? {} })
    }

    try {
      // Webhook Telegram: POST на корень функции или на /telegram.
      if (request.method === 'POST' && (route === '/' || route === '/telegram')) {
        return await handleWebhook(request)
      }
      const response = await handleApi(request, route)
      for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value)
      return response
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500
      if (status >= 500) {
        logger.error?.('[api] request failed:', error instanceof Error ? error.message : 'unknown error')
      }
      return json(
        status,
        { error: error instanceof Error ? error.message : 'Внутренняя ошибка сервера.' },
        headers ?? {},
      )
    }
  }
}

// Deno-рантайм Supabase Edge Functions; в Node (тесты) модуль просто экспортирует createApp.
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(createApp())
}
