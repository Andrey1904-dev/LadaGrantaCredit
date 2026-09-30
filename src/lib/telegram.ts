export type TelegramLinkStatus = {
  linked: boolean
  linkedAt?: string
}

export type TelegramApiHealth = {
  ok: boolean
  service?: string
  configured?: boolean
  botPolling?: 'starting' | 'online' | 'degraded' | 'stopped'
  lastSuccessfulPollAt?: string | null
}

const rawBotUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '') ?? ''
const rawApiUrl = import.meta.env.VITE_TELEGRAM_API_URL?.trim() ?? ''

/** Публичное имя бота и адрес API — токен Telegram здесь никогда не хранится. */
export const TELEGRAM_BOT_USERNAME = /^[A-Za-z0-9_]{5,32}$/.test(rawBotUsername)
  ? rawBotUsername
  : ''
export const TELEGRAM_API_URL = rawApiUrl.replace(/\/+$/, '')
export const TELEGRAM_BOT_URL = TELEGRAM_BOT_USERNAME
  ? `https://t.me/${TELEGRAM_BOT_USERNAME}?start=site`
  : ''
export const isTelegramConfigured = Boolean(TELEGRAM_BOT_URL && TELEGRAM_API_URL)

export async function checkTelegramHealth(): Promise<TelegramApiHealth> {
  if (!TELEGRAM_API_URL) throw new Error('API Telegram-бота не настроен')

  let response: Response
  try {
    response = await fetch(`${TELEGRAM_API_URL}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    throw new Error('Сервер Telegram-бота не отвечает. Проверьте публичный HTTPS-адрес API.')
  }

  const payload = (await response.json().catch(() => null)) as TelegramApiHealth | null
  if (!payload || typeof payload.ok !== 'boolean') {
    throw new Error(`Не удалось проверить Telegram API (${response.status})`)
  }
  return payload
}

export async function requestTelegram<T>(
  path: string,
  accessToken: string,
  init: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  if (!TELEGRAM_API_URL) throw new Error('API Telegram-бота не настроен')

  const response = await fetch(`${TELEGRAM_API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    signal: AbortSignal.timeout(12_000),
  })

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Не удалось связаться с ботом (${response.status})`)
  }

  return payload as T
}
