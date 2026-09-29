import type { Transaction, TxCategory } from '../types/domain'
import { addMonths, startOfMonth } from './date'

/**
 * Аналитика стоимости владения.
 *
 * Владельцы в бортжурналах считают не «сколько всего потрачено», а три числа:
 * расходы в месяц, стоимость километра и прогноз на год вперёд. Именно их
 * приводят и профильные исследования (НАПИ: Granta Sport — 13,65 ₽/км,
 * ≈205 тыс. ₽ в год в Москве при пробеге 15 000 км/год).
 */

export interface MonthPoint {
  /** Ключ 'YYYY-MM' */
  key: string
  /** Подпись для оси: «окт», «янв 26» */
  label: string
  total: number
  byCategory: Record<TxCategory, number>
}

const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]

const emptyByCategory = (): Record<TxCategory, number> => ({
  fuel: 0,
  loan: 0,
  maintenance: 0,
  insurance: 0,
  other: 0,
})

/** Расходы по месяцам за последние `months` месяцев (включая текущий) */
export function monthlySeries(
  transactions: Transaction[],
  months = 12,
  from: Date = new Date(),
): MonthPoint[] {
  const points: MonthPoint[] = []
  const index = new Map<string, MonthPoint>()

  for (let i = months - 1; i >= 0; i--) {
    const d = addMonths(startOfMonth(from), -i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const sameYear = d.getFullYear() === from.getFullYear()
    const point: MonthPoint = {
      key,
      label: sameYear
        ? MONTHS_SHORT[d.getMonth()]
        : `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      total: 0,
      byCategory: emptyByCategory(),
    }
    points.push(point)
    index.set(key, point)
  }

  for (const t of transactions) {
    const d = new Date(t.date)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const point = index.get(key)
    if (!point) continue
    point.total += t.amount
    point.byCategory[t.category] += t.amount
  }

  return points
}

export interface OwnershipCost {
  /** Сколько месяцев истории реально покрыто записями */
  windowMonths: number
  /** Сумма расходов за окно, ₽ */
  total: number
  perMonth: number
  perYear: number
  /** Пробег за окно по чекам с одометром, км */
  kmInWindow: number | null
  /** Стоимость километра за окно, ₽ */
  perKm: number | null
  /** То же без платежей по кредиту — так считают стоимость владения исследования */
  totalExLoan: number
  perMonthExLoan: number
  perKmExLoan: number | null
  byCategory: Array<{ category: TxCategory; sum: number; share: number }>
}

/**
 * Стоимость владения за последние `windowMonths` месяцев.
 *
 * Считается именно по окну с данными, а не «за всё время»: если владелец завёл
 * учёт на третий год, деление всех трат на весь пробег занижает ₽/км в разы.
 */
export function ownershipCost(
  transactions: Transaction[],
  windowMonths = 12,
  from: Date = new Date(),
): OwnershipCost {
  const since = addMonths(startOfMonth(from), -(windowMonths - 1))
  const inWindow = transactions.filter((t) => {
    const d = new Date(t.date)
    return !Number.isNaN(d.getTime()) && d >= since
  })

  const total = inWindow.reduce((s, t) => s + t.amount, 0)

  // фактически покрытый период: от самой ранней записи в окне до сегодня
  let covered = windowMonths
  if (inWindow.length) {
    const earliest = inWindow.reduce(
      (min, t) => (new Date(t.date) < min ? new Date(t.date) : min),
      new Date(inWindow[0].date),
    )
    const days = (from.getTime() - earliest.getTime()) / 86_400_000
    covered = Math.min(windowMonths, Math.max(1, days / 30.4))
  }

  const mileages = inWindow
    .map((t) => t.mileage_at_transaction)
    .filter((m): m is number => typeof m === 'number' && m > 0)
  const kmInWindow =
    mileages.length >= 2 ? Math.max(...mileages) - Math.min(...mileages) : null

  const byCategoryMap = new Map<TxCategory, number>()
  for (const t of inWindow) {
    byCategoryMap.set(t.category, (byCategoryMap.get(t.category) ?? 0) + t.amount)
  }

  const totalExLoan = inWindow
    .filter((t) => t.category !== 'loan')
    .reduce((s, t) => s + t.amount, 0)

  return {
    windowMonths: covered,
    total,
    perMonth: covered > 0 ? total / covered : 0,
    perYear: covered > 0 ? (total / covered) * 12 : 0,
    kmInWindow,
    perKm: kmInWindow && kmInWindow > 0 ? total / kmInWindow : null,
    totalExLoan,
    perMonthExLoan: covered > 0 ? totalExLoan / covered : 0,
    perKmExLoan: kmInWindow && kmInWindow > 0 ? totalExLoan / kmInWindow : null,
    byCategory: [...byCategoryMap.entries()]
      .map(([category, sum]) => ({ category, sum, share: total > 0 ? sum / total : 0 }))
      .sort((a, b) => b.sum - a.sum),
  }
}

export interface YearForecast {
  loan: number
  fuel: number
  service: number
  insurance: number
  tax: number
  total: number
  perMonth: number
  perKm: number | null
  kmPerYear: number
}

export interface YearForecastInput {
  /** Платёж по кредиту и сколько платежей осталось */
  loanPayment?: number | null
  loanMonthsLeft?: number
  /** Пробег в год, км */
  kmPerYear: number
  /** Расход л/100 км и цена литра */
  per100?: number | null
  fuelPrice: number
  /** Средняя стоимость работ ТО, которые подойдут за год, ₽ */
  service: number
  /** Страховка за год (ОСАГО по факту прошлого года или ориентир), ₽ */
  insurance: number
  /** Транспортный налог за год, ₽ */
  tax: number
}

/** Прогноз расходов на 12 месяцев вперёд */
export function forecastYear(input: YearForecastInput): YearForecast {
  const loan = Math.max(0, Math.min(12, input.loanMonthsLeft ?? 0)) * (input.loanPayment ?? 0)
  const per100 = input.per100 && input.per100 > 0 ? input.per100 : 7.8 // паспортный смешанный расход Granta
  const fuel = (input.kmPerYear / 100) * per100 * input.fuelPrice
  const total = loan + fuel + input.service + input.insurance + input.tax
  return {
    loan,
    fuel,
    service: input.service,
    insurance: input.insurance,
    tax: input.tax,
    total,
    perMonth: total / 12,
    perKm: input.kmPerYear > 0 ? total / input.kmPerYear : null,
    kmPerYear: input.kmPerYear,
  }
}

/**
 * Ориентир НАПИ по стоимости владения Lada Granta (Москва, 15 000 км/год,
 * включая страховку, шины, топливо, ТО, ремонт и налоги).
 */
export const TCO_BENCHMARK = {
  perKm: 13.65,
  perMonth: 17_100,
  perYear: 204_800,
  source: 'НАПИ, Lada Granta Sport, Москва, 15 000 км/год',
} as const
