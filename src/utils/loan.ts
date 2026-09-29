/**
 * Математика аннуитетного кредита.
 *
 * Обозначения:
 *  S — сумма кредита (principal)
 *  P — ежемесячный платёж
 *  r — месячная ставка (годовая / 12 / 100)
 *  n — срок в месяцах
 */

export const monthlyRate = (annualPercent: number): number => annualPercent / 12 / 100

/** Аннуитетный платёж: P = S * (r * (1 + r)^n) / ((1 + r)^n − 1) */
export function annuityPayment(S: number, annualPercent: number, n: number): number {
  if (S <= 0 || n <= 0) return NaN
  const r = monthlyRate(annualPercent)
  if (r === 0) return S / n
  const f = Math.pow(1 + r, n)
  return (S * (r * f)) / (f - 1)
}

/** Срок: n = ln(P / (P − S·r)) / ln(1 + r). NaN, если платёж не покрывает проценты. */
export function termFromPayment(S: number, annualPercent: number, P: number): number {
  if (S <= 0 || P <= 0) return NaN
  const r = monthlyRate(annualPercent)
  if (r === 0) return S / P
  if (P <= S * r) return NaN // платёж меньше ежемесячных процентов — кредит не гасится
  return Math.log(P / (P - S * r)) / Math.log(1 + r)
}

/** Сумма кредита из платежа: S = P * ((1 + r)^n − 1) / (r * (1 + r)^n) */
export function principalFromPayment(P: number, annualPercent: number, n: number): number {
  if (P <= 0 || n <= 0) return NaN
  const r = monthlyRate(annualPercent)
  if (r === 0) return P * n
  const f = Math.pow(1 + r, n)
  return (P * (f - 1)) / (r * f)
}

/**
 * Ставка из платежа. Аналитического решения нет — решаем численно
 * бисекцией по месячной ставке (функция платежа монотонно растёт по r).
 * Возвращает годовую ставку в процентах.
 */
export function rateFromPayment(S: number, P: number, n: number): number {
  if (S <= 0 || P <= 0 || n <= 0) return NaN
  if (P * n <= S) return 0 // платежи не покрывают даже тело — ставка ≈ 0 или отрицательная
  let lo = 1e-9
  let hi = 0.5 // 50% в месяц — заведомо больше любой банковской ставки
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    const f = Math.pow(1 + mid, n)
    const pay = (S * (mid * f)) / (f - 1)
    if (pay < P) lo = mid
    else hi = mid
  }
  return ((lo + hi) / 2) * 12 * 100
}

/**
 * Остаток долга после k внесённых платежей:
 * B(k) = S·(1+r)^k − P·((1+r)^k − 1)/r
 */
export function remainingBalance(
  S: number,
  annualPercent: number,
  n: number,
  paidMonths: number,
): number {
  if (paidMonths <= 0) return S
  if (paidMonths >= n) return 0
  const r = monthlyRate(annualPercent)
  const P = annuityPayment(S, annualPercent, n)
  if (r === 0) return Math.max(0, S - P * paidMonths)
  const f = Math.pow(1 + r, paidMonths)
  return Math.max(0, S * f - (P * (f - 1)) / r)
}

/** Сколько процентов от платежа P уходит в проценты в первый месяц (для подсказок) */
export function firstMonthInterest(S: number, annualPercent: number): number {
  return S * monthlyRate(annualPercent)
}
