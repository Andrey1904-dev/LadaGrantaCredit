/** Работа с датами (месяцы, следующие платежи) */

/** Добавляет n месяцев к дате, сохраняя день месяца (с учётом конца месяца) */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime())
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return d
}

/** Целое число полных месяцев между двумя датами (from → to) */
export function monthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) months -= 1
  return months
}

/**
 * Дата следующего платежа: тот же день месяца, что и startDate,
 * ближайший в будущем (или сегодня, если сегодня день платежа).
 */
export function nextPaymentDate(startDate: string, from: Date = new Date()): Date {
  const start = new Date(startDate + 'T00:00:00')
  const payDay = start.getDate()
  const candidate = (base: Date): Date => {
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
    return new Date(base.getFullYear(), base.getMonth(), Math.min(payDay, lastDay))
  }
  const todayStart = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  let c = candidate(todayStart)
  if (c.getTime() < todayStart.getTime()) {
    c = candidate(addMonths(todayStart, 1))
  }
  return c
}

/** Начало текущего месяца */
export function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** Разница в днях от сегодня до даты (отрицательная, если дата в прошлом) */
export function daysUntil(isoDate: string, from: Date = new Date()): number {
  const target = new Date(isoDate + 'T00:00:00')
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}
