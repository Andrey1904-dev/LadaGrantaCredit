import { createHash, randomBytes as secureRandomBytes } from 'node:crypto'

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

export function createLinkCode(randomBytes = secureRandomBytes) {
  const hex = Buffer.from(randomBytes(5)).toString('hex').toUpperCase()
  return `${hex.slice(0, 5)}-${hex.slice(5, 10)}`
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
