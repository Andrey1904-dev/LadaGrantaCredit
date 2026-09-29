import type {
  Car,
  Loan,
  MaintenanceRecord,
  NewMaintenance,
  NewTransaction,
  Transaction,
} from '../types/domain'
import { annuityPayment } from '../utils/loan'
import { addMonths, startOfMonth } from '../utils/date'
import { toDateInputValue } from '../utils/format'
import type { AuthApi, AuthUser, Backend, CarPatch, DataApi, LoanPatch } from './backend'

/**
 * Локальный бэкенд на localStorage.
 * Используется, когда переменные VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * не заданы — приложение работает в демо-режиме с тем же API, что и Supabase.
 */

const KEYS = {
  session: 'lgc_session',
  car: 'lgc_car',
  loan: 'lgc_loan',
  transactions: 'lgc_transactions',
  maintenance: 'lgc_maintenance',
  seeded: 'lgc_seeded_v1',
}

export const DEMO_USER: AuthUser = { id: 'demo-user', email: 'demo@lada.ru' }

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

/* ---------- Начальные демо-данные ---------- */

function seed(): void {
  if (localStorage.getItem(KEYS.seeded)) return
  const now = new Date()

  const car: Car = {
    id: uid(),
    user_id: DEMO_USER.id,
    plate_number: 'А 123 БВ 77',
    vin_number: 'XTA211500R1234567',
    current_mileage: 18450,
    initial_mileage: 12,
    insurance_until: toDateInputValue(addMonths(now, 4)),
  }

  const loanStart = addMonths(startOfMonth(now), -8)
  loanStart.setDate(15)
  const loan: Loan = {
    id: uid(),
    user_id: DEMO_USER.id,
    total_amount: 1_050_000,
    interest_rate: 16.9,
    monthly_payment: Math.round(annuityPayment(1_050_000, 16.9, 60) * 100) / 100,
    term_months: 60,
    start_date: toDateInputValue(loanStart),
  }

  /* Транзакции за ~8 месяцев: кредит, топливо, страховка, ТО, прочее */
  const txs: Transaction[] = []
  let mileage = 1500
  let cursor = addMonths(now, -8)

  while (cursor <= now) {
    // 2–3 заправки в месяц
    const fills = 2 + (cursor.getMonth() % 2)
    for (let i = 0; i < fills; i++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), 3 + i * 9 + Math.floor(Math.random() * 4))
      if (d > now) continue
      mileage += 620 + Math.floor(Math.random() * 400)
      if (mileage > car.current_mileage) mileage = car.current_mileage
      txs.push({
        id: uid(),
        user_id: DEMO_USER.id,
        amount: 2450 + Math.floor(Math.random() * 900),
        category: 'fuel',
        date: d.toISOString(),
        mileage_at_transaction: mileage,
      })
    }
    // платёж по кредиту 15-го числа
    const payDay = new Date(cursor.getFullYear(), cursor.getMonth(), 15)
    if (payDay <= now) {
      txs.push({
        id: uid(),
        user_id: DEMO_USER.id,
        amount: loan.monthly_payment,
        category: 'loan',
        date: payDay.toISOString(),
        mileage_at_transaction: null,
      })
    }
    cursor = addMonths(cursor, 1)
  }

  const extra: Array<[number, Transaction['category'], number, number | null]> = [
    [12_400, 'insurance', -3, null],
    [8_900, 'maintenance', -2, 15_020],
    [1_500, 'other', -2, null],
    [900, 'other', -1, null],
    [4_200, 'maintenance', -1, 17_300],
  ]
  for (const [amount, category, monthOffset, m] of extra) {
    const d = addMonths(now, monthOffset)
    d.setDate(Math.min(20, d.getDate()))
    txs.push({
      id: uid(),
      user_id: DEMO_USER.id,
      amount,
      category,
      date: d.toISOString(),
      mileage_at_transaction: m,
    })
  }
  txs.sort((a, b) => b.date.localeCompare(a.date))

  const maintenance: MaintenanceRecord[] = [
    {
      id: uid(),
      user_id: DEMO_USER.id,
      date: toDateInputValue(addMonths(now, -6)),
      mileage: 7500,
      description: 'ТО-0: замена масла двигателя и масляного фильтра',
    },
    {
      id: uid(),
      user_id: DEMO_USER.id,
      date: toDateInputValue(addMonths(now, -2)),
      mileage: 15_020,
      description: 'ТО-1: масло, фильтры, диагностика ходовой, замена свечей',
    },
  ]

  write(KEYS.car, car)
  write(KEYS.loan, loan)
  write(KEYS.transactions, txs)
  write(KEYS.maintenance, maintenance)
  localStorage.setItem(KEYS.seeded, '1')
}

/* ---------- Auth ---------- */

const localAuth: AuthApi = {
  async getUser() {
    return localStorage.getItem(KEYS.session) ? DEMO_USER : null
  },
  async signIn() {
    localStorage.setItem(KEYS.session, '1')
    return DEMO_USER
  },
  async signUp() {
    localStorage.setItem(KEYS.session, '1')
    return DEMO_USER
  },
  async signOut() {
    localStorage.removeItem(KEYS.session)
  },
  onChange() {
    return () => {}
  },
}

/* ---------- Data ---------- */

const localData: DataApi = {
  async getCar() {
    return read<Car | null>(KEYS.car, null)
  },
  async createCar(_uid, patch: CarPatch) {
    const car: Car = {
      id: uid(),
      user_id: DEMO_USER.id,
      plate_number: patch.plate_number ?? '',
      vin_number: patch.vin_number ?? '',
      current_mileage: patch.current_mileage ?? 0,
      initial_mileage: patch.initial_mileage ?? 0,
      insurance_until: patch.insurance_until ?? null,
    }
    write(KEYS.car, car)
    return car
  },
  async updateCar(id: string, patch: CarPatch) {
    const car = read<Car | null>(KEYS.car, null)
    if (!car || car.id !== id) throw new Error('Автомобиль не найден')
    const next = { ...car, ...patch }
    write(KEYS.car, next)
    return next
  },

  async getLoan() {
    return read<Loan | null>(KEYS.loan, null)
  },
  async createLoan(_uid, patch: Required<LoanPatch>) {
    const loan: Loan = { id: uid(), user_id: DEMO_USER.id, ...patch }
    write(KEYS.loan, loan)
    return loan
  },
  async updateLoan(id: string, patch: LoanPatch) {
    const loan = read<Loan | null>(KEYS.loan, null)
    if (!loan || loan.id !== id) throw new Error('Кредит не найден')
    const next = { ...loan, ...patch }
    write(KEYS.loan, next)
    return next
  },

  async listTransactions() {
    return read<Transaction[]>(KEYS.transactions, [])
  },
  async addTransaction(_uid, tx: NewTransaction) {
    const list = read<Transaction[]>(KEYS.transactions, [])
    const item: Transaction = { id: uid(), user_id: DEMO_USER.id, ...tx }
    const next = [item, ...list].sort((a, b) => b.date.localeCompare(a.date))
    write(KEYS.transactions, next)
    return item
  },
  async removeTransaction(id: string) {
    const list = read<Transaction[]>(KEYS.transactions, [])
    write(
      KEYS.transactions,
      list.filter((t) => t.id !== id),
    )
  },

  async listMaintenance() {
    return read<MaintenanceRecord[]>(KEYS.maintenance, [])
  },
  async addMaintenance(_uid, m: NewMaintenance) {
    const list = read<MaintenanceRecord[]>(KEYS.maintenance, [])
    const item: MaintenanceRecord = { id: uid(), user_id: DEMO_USER.id, ...m }
    const next = [item, ...list].sort((a, b) => b.date.localeCompare(a.date))
    write(KEYS.maintenance, next)
    return item
  },
  async removeMaintenance(id: string) {
    const list = read<MaintenanceRecord[]>(KEYS.maintenance, [])
    write(
      KEYS.maintenance,
      list.filter((m) => m.id !== id),
    )
  },
}

export function createLocalBackend(): Backend {
  seed()
  return { mode: 'demo', auth: localAuth, data: localData }
}
