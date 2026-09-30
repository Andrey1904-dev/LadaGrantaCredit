export type TelegramLinkStatus = {
  linked: boolean
  linkedAt?: string
}

export type TelegramApiHealth = {
  ok: boolean
  service?: string
  mode?: 'polling' | 'webhook'
  configured?: boolean
  botPolling?: 'starting' | 'online' | 'degraded' | 'stopped'
  lastSuccessfulPollAt?: string | null
  webhook?: {
    url?: string
    pendingUpdates?: number
    lastError?: string
  }
  hint?: string
}

/** Что не так с публичными переменными сборки (пустая строка — всё в порядке). */
export type TelegramConfigIssue =
  | ''
  | 'missing-username'
  | 'missing-url'
  | 'bot-token'
  | 'relative-in-prod'
  | 'not-https'
  | 'invalid-url'

const BOT_TOKEN_LIKE = /^\d{6,12}:[A-Za-z0-9_-]{25,}$/
const BOT_USERNAME_LIKE = /^[A-Za-z0-9_]{5,32}$/

const rawBotUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? '').trim().replace(/^@/, '')
const rawApiUrl = (import.meta.env.VITE_TELEGRAM_API_URL ?? '').trim()
const isDev = Boolean(import.meta.env.DEV)

const CONFIG_MESSAGES: Record<Exclude<TelegramConfigIssue, ''>, string> = {
  'missing-username':
    'Задайте публичное имя бота (без @) в переменной сборки VITE_TELEGRAM_BOT_USERNAME.',
  'missing-url':
    'Задайте HTTPS-адрес API бота в переменной сборки VITE_TELEGRAM_API_URL — например, адрес Supabase Edge Function …/functions/v1/telegram-api.',
  'bot-token':
    'В переменных сборки оказался токен бота BotFather. Токен нельзя встраивать в сборку сайта: отзовите его командой /revoke в @BotFather и укажите в VITE_TELEGRAM_API_URL адрес сервиса бота.',
  'relative-in-prod':
    'VITE_TELEGRAM_API_URL — относительный путь. Такой адрес работает только в режиме разработки через прокси Vite. Для задеплоенного сайта укажите полный HTTPS-адрес API бота.',
  'not-https':
    'VITE_TELEGRAM_API_URL должен быть HTTPS-адресом: браузер не отправит авторизацию на HTTP-адрес.',
  'invalid-url': 'VITE_TELEGRAM_API_URL не является корректным URL. Укажите адрес вида https://example.com.',
}

type ApiUrlResult = { url: string; issue: TelegramConfigIssue }

/**
 * Проверяет адрес API до первого запроса.
 *
 * Раньше значение из переменной уходило в `fetch` как есть: если в него попадал
 * токен бота или относительный путь из `.env.example`, браузер слал запрос на
 * домен самого сайта (GitHub Pages) и получал 404/405 вместо ответа бота.
 */
export function normalizeTelegramApiUrl(value: string, dev = isDev): ApiUrlResult {
  const raw = value.trim()
  if (!raw) return { url: '', issue: 'missing-url' }
  if (BOT_TOKEN_LIKE.test(raw) || /^\d{6,12}:/.test(raw)) return { url: '', issue: 'bot-token' }
  if (raw.startsWith('/')) {
    return dev
      ? { url: raw.replace(/\/+$/, '') || '/', issue: '' }
      : { url: '', issue: 'relative-in-prod' }
  }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { url: '', issue: 'invalid-url' }
  }
  if (parsed.protocol !== 'https:') return { url: '', issue: 'not-https' }
  return { url: raw.replace(/\/+$/, ''), issue: '' }
}

const apiUrl = normalizeTelegramApiUrl(rawApiUrl)

/** Публичное имя бота; токен Telegram здесь никогда не хранится. */
export const TELEGRAM_BOT_USERNAME = BOT_USERNAME_LIKE.test(rawBotUsername) ? rawBotUsername : ''
export const TELEGRAM_API_URL = apiUrl.url
export const TELEGRAM_API_HOST = (() => {
  try {
    return new URL(TELEGRAM_API_URL).host
  } catch {
    // Относительный путь в dev-режиме — домен появится только во время запроса.
    return ''
  }
})()
export const TELEGRAM_BOT_URL = TELEGRAM_BOT_USERNAME
  ? `https://t.me/${TELEGRAM_BOT_USERNAME}?start=site`
  : ''

/** Одна понятная причина, почему интеграция не готова. */
export const TELEGRAM_CONFIG_ISSUE: TelegramConfigIssue = (() => {
  if (rawBotUsername && !TELEGRAM_BOT_USERNAME && BOT_TOKEN_LIKE.test(rawBotUsername)) return 'bot-token'
  if (apiUrl.issue === 'bot-token') return 'bot-token'
  if (apiUrl.issue) return apiUrl.issue
  if (!TELEGRAM_BOT_USERNAME) return 'missing-username'
  return ''
})()

export const TELEGRAM_CONFIG_MESSAGE = TELEGRAM_CONFIG_ISSUE ? CONFIG_MESSAGES[TELEGRAM_CONFIG_ISSUE] : ''
export const isTelegramConfigured = Boolean(TELEGRAM_BOT_URL && TELEGRAM_API_URL)

function hostLabel(): string {
  return TELEGRAM_API_HOST || 'указанный адрес'
}

/** Человеческое описание HTTP-ответа вместо голого кода. */
export function describeTelegramHttpError(status: number): string {
  if (status === 404) {
    return `API бота не найден по адресу ${hostLabel()} (404). Проверьте VITE_TELEGRAM_API_URL: там должен быть адрес сервиса бота, а не сайта.`
  }
  if (status === 405) {
    return `Адрес ${hostLabel()} не принимает запросы API (405). Так отвечает статический сайт — например, GitHub Pages. Проверьте VITE_TELEGRAM_API_URL: нужен адрес работающего сервиса бота.`
  }
  if (status === 401 || status === 403) {
    return 'Сервис бота отклонил сессию сайта. Войдите в аккаунт повторно и попробуйте ещё раз.'
  }
  if (status === 429) {
    return 'Слишком много попыток. Подождите несколько минут и повторите.'
  }
  if (status >= 500) {
    return `Сервис бота временно недоступен (${status}). Попробуйте ещё раз через минуту.`
  }
  return `Не удалось связаться с ботом (${status}).`
}

async function readJsonBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null)
}

export async function checkTelegramHealth(): Promise<TelegramApiHealth> {
  if (!TELEGRAM_API_URL) throw new Error(TELEGRAM_CONFIG_MESSAGE || 'API Telegram-бота не настроен')

  let response: Response
  try {
    response = await fetch(`${TELEGRAM_API_URL}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    throw new Error(`Сервер Telegram-бота не отвечает (${hostLabel()}). Проверьте публичный HTTPS-адрес API.`)
  }

  const payload = (await readJsonBody(response)) as TelegramApiHealth | null
  if (!payload || typeof payload.ok !== 'boolean') {
    throw new Error(
      response.ok
        ? `Адрес ${hostLabel()} отвечает, но это не API бота: ответ не в формате JSON.`
        : describeTelegramHttpError(response.status),
    )
  }
  return payload
}

export async function requestTelegram<T>(
  path: string,
  accessToken: string,
  init: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  if (!TELEGRAM_API_URL) throw new Error(TELEGRAM_CONFIG_MESSAGE || 'API Telegram-бота не настроен')

  const response = await fetch(`${TELEGRAM_API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    signal: AbortSignal.timeout(12_000),
  })

  const payload = (await readJsonBody(response)) as
    | { error?: string; message?: string }
    | null
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || describeTelegramHttpError(response.status))
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Адрес ${hostLabel()} вернул неожиданный ответ. Проверьте VITE_TELEGRAM_API_URL.`)
  }

  return payload as T
}
