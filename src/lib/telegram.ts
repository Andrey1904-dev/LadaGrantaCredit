type TelegramLinkStatus = {
  linked: boolean
  linkedAt?: string
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
  })

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Не удалось связаться с ботом (${response.status})`)
  }

  return payload as T
}

export type { TelegramLinkStatus }
