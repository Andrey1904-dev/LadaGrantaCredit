import type { Transaction } from '../types/domain'

/**
 * Топливная аналитика по чекам заправок.
 *
 * Литры в базе не хранятся (в таблице только сумма и пробег), поэтому объём
 * оценивается по цене литра из настроек: `литры = сумма / цена`. Это тот же
 * принцип, что используют популярные приложения учёта («Мой авто», AutoLog):
 * расход считается между соседними заправками методом «от полного до полного».
 */

export interface FuelLeg {
  /** Дата заправки, закрывающей отрезок */
  date: string
  /** Пройдено между заправками, км */
  km: number
  /** Залито (оценка), л */
  liters: number
  /** Стоимость заправки, ₽ */
  rub: number
  /** Расход, л/100 км */
  per100: number
  /** Стоимость километра по топливу, ₽/км */
  rubPerKm: number
}

export interface FuelStats {
  legs: FuelLeg[]
  /** Средний расход по всем отрезкам, л/100 км */
  avgPer100: number | null
  /** Расход по последним 3 заправкам — «текущая форма» */
  recentPer100: number | null
  /** Лучший и худший отрезок */
  bestPer100: number | null
  worstPer100: number | null
  /** Средняя стоимость километра по топливу, ₽/км */
  rubPerKm: number | null
  /** Сумма всех заправок, ₽ */
  totalRub: number
  /** Оценка залитых литров, л */
  totalLiters: number
  /** Средний чек заправки, ₽ */
  avgCheck: number | null
  /** Пробег на одном баке (оценка), км */
  rangePerTank: number | null
  /** Сколько заправок учтено */
  count: number
}

const EMPTY: FuelStats = {
  legs: [],
  avgPer100: null,
  recentPer100: null,
  bestPer100: null,
  worstPer100: null,
  rubPerKm: null,
  totalRub: 0,
  totalLiters: 0,
  avgCheck: null,
  rangePerTank: null,
  count: 0,
}

const avg = (xs: number[]): number | null =>
  xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null

export function computeFuelStats(
  transactions: Transaction[],
  fuelPrice: number,
  tankLiters = 50,
): FuelStats {
  const price = fuelPrice > 0 ? fuelPrice : 1
  const fills = transactions
    .filter((t) => t.category === 'fuel')
    .sort((a, b) => a.date.localeCompare(b.date))

  if (fills.length === 0) return EMPTY

  const totalRub = fills.reduce((s, t) => s + t.amount, 0)
  const totalLiters = totalRub / price

  const withMileage = fills.filter(
    (t) => typeof t.mileage_at_transaction === 'number' && t.mileage_at_transaction! > 0,
  )

  const legs: FuelLeg[] = []
  for (let i = 1; i < withMileage.length; i++) {
    const prev = withMileage[i - 1]
    const cur = withMileage[i]
    const km = (cur.mileage_at_transaction ?? 0) - (prev.mileage_at_transaction ?? 0)
    // отбрасываем шум: неверный одометр, долив «на пару сотен рублей»
    if (km < 50 || km > 2_000) continue
    const liters = cur.amount / price
    if (liters <= 0) continue
    const per100 = (liters / km) * 100
    if (per100 < 3 || per100 > 25) continue // заведомо нереальные значения
    legs.push({
      date: cur.date,
      km,
      liters,
      rub: cur.amount,
      per100,
      rubPerKm: cur.amount / km,
    })
  }

  const per100s = legs.map((l) => l.per100)
  const recent = legs.slice(-3).map((l) => l.per100)

  return {
    legs,
    avgPer100: avg(per100s),
    recentPer100: avg(recent),
    bestPer100: per100s.length ? Math.min(...per100s) : null,
    worstPer100: per100s.length ? Math.max(...per100s) : null,
    rubPerKm: avg(legs.map((l) => l.rubPerKm)),
    totalRub,
    totalLiters,
    avgCheck: totalRub / fills.length,
    rangePerTank: per100s.length ? (tankLiters / (avg(per100s) as number)) * 100 : null,
    count: fills.length,
  }
}

/** Средний пробег в месяц по чекам с одометром (нужен для прогноза даты ТО) */
export function monthlyMileage(transactions: Transaction[]): number | null {
  const points = transactions
    .filter((t) => typeof t.mileage_at_transaction === 'number' && t.mileage_at_transaction! > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (points.length < 2) return null
  const first = points[0]
  const last = points[points.length - 1]
  const km = (last.mileage_at_transaction ?? 0) - (first.mileage_at_transaction ?? 0)
  const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000
  if (km <= 0 || days < 20) return null
  return (km / days) * 30.4
}
