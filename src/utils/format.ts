/** Форматирование денег, дат и чисел в русской локали */

const rubFmt = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

const rubFmt2 = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const fmtMoney = (n: number): string => rubFmt.format(Math.round(n))

export const fmtMoneyExact = (n: number): string => rubFmt2.format(n)

export const fmtNumber = (n: number): string =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n)

export const fmtMileage = (n: number): string =>
  `${new Intl.NumberFormat('ru-RU').format(Math.round(n))} км`

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })

export const fmtDate = (iso: string | Date): string => dateFmt.format(new Date(iso))
export const fmtDateShort = (iso: string | Date): string => shortDateFmt.format(new Date(iso))

/** Парсинг числа из инпута: допускает пробелы и запятую как разделитель */
export function parseLocaleNumber(raw: string): number {
  const cleaned = raw.replace(/[\s ]/g, '').replace(',', '.')
  if (cleaned === '') return NaN
  return Number(cleaned)
}

/** Склонение: plural(5, ['месяц', 'месяца', 'месяцев']) → «месяцев» */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}

/** «5 месяцев» */
export const pluralMonths = (n: number): string =>
  `${fmtNumber(n)} ${plural(Math.round(n), ['месяц', 'месяца', 'месяцев'])}`

/** Преобразование Date → 'YYYY-MM-DD' для input[type=date] в локальной TZ */
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
