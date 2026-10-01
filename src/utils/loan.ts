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
  payment = annuityPayment(S, annualPercent, n),
): number {
  if (paidMonths <= 0) return S
  if (paidMonths >= n) return 0
  const r = monthlyRate(annualPercent)
  if (r === 0) return Math.max(0, S - payment * paidMonths)
  const f = Math.pow(1 + r, paidMonths)
  return Math.max(0, S * f - (payment * (f - 1)) / r)
}

/** Сколько процентов от платежа P уходит в проценты в первый месяц (для подсказок) */
export function firstMonthInterest(S: number, annualPercent: number): number {
  return S * monthlyRate(annualPercent)
}

/* ------------------------------------------------------------------ */
/*  Досрочное погашение                                                */
/* ------------------------------------------------------------------ */

export type PrepaymentMode = 'term' | 'payment'

export interface PrepaymentInput {
  /** Текущий остаток основного долга, ₽ */
  balance: number
  /** Годовая ставка, % */
  annualPercent: number
  /** Ежемесячный платёж по договору, ₽ */
  payment: number
  /** Сколько платежей осталось по графику */
  termLeft: number
  /** Разовый досрочный взнос сегодня, ₽ */
  oneTime?: number
  /** Регулярная доплата к каждому платежу, ₽ */
  monthly?: number
  /**
   * Что пересчитывает банк после досрочного взноса:
   *  • `term`    — платёж прежний, срок сокращается (выгоднее по процентам);
   *  • `payment` — срок прежний, платёж пересчитывается на остаток.
   */
  mode: PrepaymentMode
}

export interface PrepaymentPlan {
  /** Сколько месяцев осталось платить */
  months: number
  /** Переплата по процентам за оставшийся срок, ₽ */
  interest: number
  /** Сколько всего уйдёт банку (тело + проценты + досрочные взносы), ₽ */
  totalPaid: number
  /** Размер регулярного платежа после пересчёта, ₽ */
  payment: number
  /** Последний (неполный) платёж, ₽ */
  lastPayment: number
}

const MAX_MONTHS = 1200 // защита от бесконечного цикла при некорректных данных

/**
 * Помесячная симуляция погашения аннуитетного кредита с досрочными взносами.
 *
 * Проценты начисляются на остаток: `проценты = остаток · r`, остальное из
 * платежа идёт в тело долга. Именно поэтому сокращение срока выгоднее
 * уменьшения платежа — процент начисляется меньшее число месяцев.
 *
 * Возвращает null, если платёж не покрывает даже проценты (долг не гасится).
 */
export function simulatePrepayment(input: PrepaymentInput): PrepaymentPlan | null {
  const { annualPercent, mode } = input
  const oneTime = Math.max(0, input.oneTime ?? 0)
  const extra = Math.max(0, input.monthly ?? 0)
  const r = monthlyRate(annualPercent)

  let balance = Math.max(0, input.balance - oneTime)
  let termLeft = Math.max(1, Math.round(input.termLeft))
  let payment = input.payment

  // банк пересчитывает платёж под прежний срок
  if (mode === 'payment') {
    const recalculated = annuityPayment(balance, annualPercent, termLeft)
    if (Number.isFinite(recalculated)) payment = recalculated
  }

  if (balance <= 0) {
    return { months: 0, interest: 0, totalPaid: oneTime, payment: 0, lastPayment: 0 }
  }
  if (payment + extra <= balance * r) return null // платёж не покрывает проценты

  let interest = 0
  let paid = oneTime
  let months = 0
  let last = 0
  let current = payment

  while (balance > 0.005 && months < MAX_MONTHS) {
    const accrued = balance * r
    let due = current + extra
    if (due >= balance + accrued) due = balance + accrued // последний платёж — «в ноль»
    const principal = due - accrued
    if (principal <= 0) return null
    balance = Math.max(0, balance - principal)
    interest += accrued
    paid += due
    last = due
    months++
    if (mode === 'payment' && extra > 0 && balance > 0) {
      // при регулярной доплате банк каждый месяц пересчитывает платёж на прежний срок
      const left = Math.max(1, termLeft - months)
      const next = annuityPayment(balance, annualPercent, left)
      if (Number.isFinite(next)) current = next
    }
  }

  return {
    months,
    interest,
    totalPaid: paid,
    payment: mode === 'payment' ? payment : input.payment,
    lastPayment: last,
  }
}

/* ------------------------------------------------------------------ */
/*  ПДН: сколько нужно закрыть, чтобы снизить нагрузку                 */
/* ------------------------------------------------------------------ */

export interface PdnReliefInput {
  /** Среднемесячный доход, ₽ */
  income: number
  /** Сумма всех ежемесячных платежей по кредитам, ₽ */
  totalMonthlyDebt: number
  /** Целевой ПДН, % (пороги ЦБ: 30 и 50) */
  targetPercent: number
  /** Средняя годовая ставка по закрываемым кредитам, % (для оценки суммы) */
  annualPercent?: number
  /** Сколько платежей осталось по закрываемым кредитам */
  termLeft?: number
}

export interface PdnRelief {
  /** Целевой ПДН, % */
  targetPercent: number
  /** Максимально допустимый суммарный платёж при целевом ПДН, ₽/мес */
  allowedPayment: number
  /** На сколько нужно снизить суммарный платёж, ₽/мес (0 — цель уже достигнута) */
  paymentToCut: number
  /** Запас до цели, ₽/мес (0, если цель не достигнута) */
  headroom: number
  /** Цель уже выполнена? */
  reached: boolean
  /** Оценка остатка долга, который нужно погасить, ₽ (NaN, если данных мало) */
  principalToClose: number
}

/**
 * Совет по снижению ПДН: сколько рублей ежемесячного платежа нужно убрать
 * и какой примерно остаток долга для этого придётся закрыть досрочно.
 *
 * Сумма закрытия оценивается как тело аннуитета, дающего «лишний» платёж
 * при заданных ставке и остатке срока: S = P · ((1+r)^n − 1) / (r·(1+r)^n).
 */
export function pdnRelief(input: PdnReliefInput): PdnRelief | null {
  const income = input.income
  const debt = Math.max(0, input.totalMonthlyDebt)
  const target = input.targetPercent
  if (!(income > 0) || !(target > 0)) return null

  const allowedPayment = (income * target) / 100
  const paymentToCut = Math.max(0, debt - allowedPayment)
  const reached = paymentToCut <= 0.005

  let principalToClose = reached ? 0 : NaN
  if (!reached) {
    const rate = input.annualPercent ?? 0
    const n = input.termLeft ?? 0
    if (n > 0 && rate >= 0) {
      const s = principalFromPayment(Math.min(paymentToCut, debt), rate, n)
      if (Number.isFinite(s)) principalToClose = s
    }
  }

  return {
    targetPercent: target,
    allowedPayment,
    paymentToCut,
    headroom: reached ? allowedPayment - debt : 0,
    reached,
    principalToClose,
  }
}
