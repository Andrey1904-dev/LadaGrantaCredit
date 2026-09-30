// `node:crypto` поддерживают и Node.js, и Deno (Supabase Edge Functions),
// поэтому файл без изменений копируется в supabase/functions/telegram-api/.
import { createHash } from 'node:crypto'

/** Криптостойкие случайные байты без зависимости от Buffer. */
function secureRandomBytes(size) {
  const bytes = new Uint8Array(size)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

const moneyFormat = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})
const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Moscow',
})

export function normalizeLinkCode(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function hashLinkCode(value) {
  return createHash('sha256').update(normalizeLinkCode(value), 'utf8').digest('hex')
}

/**
 * Канонический код привязки: 10 символов A-Z0-9 без разделителя.
 * Дефис для читаемости добавляет транспорт в тексте сообщения — раньше
 * форматирование происходило дважды и в Telegram уходил код вида `A4K9P--72QX8`.
 */
export function createLinkCode(randomBytes = secureRandomBytes) {
  let hex = ''
  for (const byte of randomBytes(5)) {
    hex += Number(byte).toString(16).padStart(2, '0')
  }
  return hex.toUpperCase()
}

export function formatMoney(value) {
  return moneyFormat.format(Math.round(Number(value) || 0))
}

export function formatMileage(value) {
  return `${numberFormat.format(Math.max(0, Math.round(Number(value) || 0)))} км`
}

export function formatDate(value) {
  if (!value) return 'не указана'
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return 'не указана'
  return dateFormat.format(date)
}

export function daysUntil(value, now = new Date()) {
  if (!value) return null
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  const target = Date.UTC(year, month - 1, day)
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((target - today) / 86_400_000)
}

export function nextPaymentDate(startDate, from = new Date()) {
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(start.getTime())) return null
  const payDay = start.getUTCDate()
  const today = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const candidate = (year, month) => {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    return new Date(Date.UTC(year, month, Math.min(payDay, lastDay)))
  }
  let next = candidate(today.getUTCFullYear(), today.getUTCMonth())
  if (next < today) next = candidate(today.getUTCFullYear(), today.getUTCMonth() + 1)
  return next
}

export function remainingLoanBalance(principal, annualRate, termMonths, paidMonths, scheduledPayment = null) {
  const amount = Number(principal)
  const rate = Number(annualRate) / 12 / 100
  const term = Math.round(Number(termMonths))
  const paid = Math.round(Number(paidMonths))
  if (!Number.isFinite(amount) || amount <= 0 || term <= 0) return 0
  if (paid <= 0) return amount
  if (paid >= term) return 0
  const payment = Number.isFinite(Number(scheduledPayment)) && Number(scheduledPayment) > 0
    ? Number(scheduledPayment)
    : rate === 0
      ? amount / term
      : amount * (rate * (1 + rate) ** term) / ((1 + rate) ** term - 1)
  if (rate === 0) return Math.max(0, amount - payment * paid)
  const factor = (1 + rate) ** paid
  return Math.max(0, amount * factor - payment * (factor - 1) / rate)
}

export function monthTransactions(transactions, now = new Date()) {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  return transactions.filter((item) => {
    const time = new Date(item.date).getTime()
    return Number.isFinite(time) && time >= start && time <= now.getTime()
  })
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function plural(value, one, few, many) {
  const n = Math.abs(Number(value)) % 100
  const last = n % 10
  if (n > 10 && n < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

/* ------------------------------------------------------- Telegram Mini App --- */

/**
 * Короткие ключи разделов, которые сайт принимает в `?screen=` (кнопки web_app)
 * и в `startapp` (прямые ссылки). Должны совпадать с START_ROUTES в
 * src/lib/telegram-mini-app.ts.
 */
export const MINI_APP_SCREENS = Object.freeze(['home', 'credit', 'expenses', 'service', 'garage', 'telegram'])

/** Текст кнопки меню бота, открывающей Mini App. */
export const MINI_APP_MENU_TEXT = 'Кабинет'

const LOCAL_HOST_RE = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1?\])$/i

/**
 * Проверяет и нормализует публичный адрес сайта для кнопок `web_app`.
 * Telegram открывает Mini App только по HTTPS; hash убирается, потому что в нём
 * Telegram передаёт параметры запуска (а сайт использует HashRouter).
 * Возвращает '' для пустого, не-HTTPS, локального или некорректного адреса.
 */
export function normalizeMiniAppUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return ''
  let url
  try {
    url = new URL(value.trim())
  } catch {
    return ''
  }
  if (url.protocol !== 'https:' || url.username || url.password) return ''
  if (!url.hostname || LOCAL_HOST_RE.test(url.hostname)) return ''
  url.hash = ''
  return url.toString()
}

/**
 * Адрес Mini App (опционально — с разделом `?screen=<key>` из белого списка).
 * Неизвестный раздел игнорируется: открывается стартовый экран.
 */
export function miniAppUrl(webAppUrl, screen = '') {
  const base = normalizeMiniAppUrl(webAppUrl)
  if (!base) return ''
  if (!screen || !MINI_APP_SCREENS.includes(screen)) return base
  const url = new URL(base)
  url.searchParams.set('screen', screen)
  return url.toString()
}

/**
 * Кнопка меню бота для setChatMenuButton: Mini App, если адрес корректен,
 * иначе — стандартный список команд (с явным признаком для логов).
 */
export function miniAppMenuButton(webAppUrl, text = MINI_APP_MENU_TEXT) {
  const url = normalizeMiniAppUrl(webAppUrl)
  if (!url) return { type: 'commands' }
  return { type: 'web_app', text, web_app: { url } }
}
