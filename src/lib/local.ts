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
 *
 * Используется в демо-режиме: либо когда переменные VITE_SUPABASE_* не заданы,
 * либо когда пользователь сам нажал «Войти в демо-режим» (см. src/lib/index.ts).
 * API полностью совпадает с Supabase-бэкендом, поэтому страницы не знают,
 * с каким хранилищем работают.
 */

const KEYS = {
  session: 'lgc_session',
  car: 'lgc_car',
  loan: 'lgc_loan',
  transactions: 'lgc_transactions',
  maintenance: 'lgc_maintenance',
  seeded: 'lgc_seeded_v2',
}

export const DEMO_USER: AuthUser = { id: 'demo-user', email: 'demo@lada.ru' }

/** Учётка демо-кабинета (пароль не проверяется — данные лежат в браузере) */
export const DEMO_CREDENTIALS = { email: 'demo@lada.ru', password: 'demo' } as const

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
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* хранилище может быть переполнено или недоступно */
  }
}

/* ---------- Начальные демо-данные ---------- */

/** Детерминированный псевдослучайный генератор: демо выглядит одинаково при каждом сбросе */
function rng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const DEMO_MILEAGE = 47_800
const DEMO_MONTHS = 26 // автомобиль во владении ~2 года

function buildDemoData(): {
  car: Car
  loan: Loan
  transactions: Transaction[]
  maintenance: MaintenanceRecord[]
} {
  const now = new Date()
  const random = rng(20_240_513)

  const car: Car = {
    id: uid(),
    user_id: DEMO_USER.id,
    plate_number: 'А 123 БВ 77',
    vin_number: 'XTA211500R1234567',
    current_mileage: DEMO_MILEAGE,
    initial_mileage: 12,
    insurance_until: toDateInputValue(addMonths(now, 1)), // скоро истекает — виден индикатор
  }

  const loanStart = addMonths(startOfMonth(now), -DEMO_MONTHS)
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

  /* Транзакции за последние 12 месяцев: топливо, кредит, страховка, ТО, прочее */
  const txs: Transaction[] = []
  const historyMonths = 12
  const kmPerMonth = 1_500
  let mileage = DEMO_MILEAGE - historyMonths * kmPerMonth
  let cursor = addMonths(now, -historyMonths)

  while (cursor <= now) {
    const fills = 3
    for (let i = 0; i < fills; i++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), 4 + i * 9 + Math.floor(random() * 3))
      if (d > now) continue
      mileage = Math.min(DEMO_MILEAGE, mileage + Math.round(kmPerMonth / fills + random() * 180))
      txs.push({
        id: uid(),
        user_id: DEMO_USER.id,
        amount: 2_600 + Math.floor(random() * 900),
        category: 'fuel',
        date: d.toISOString(),
        mileage_at_transaction: mileage,
      })
    }
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
    [13_800, 'insurance', -11, null],
    [9_400, 'maintenance', -8, 30_400], // ТО-2
    [4_900, 'maintenance', -5, 36_500], // стойки стабилизатора
    [7_200, 'maintenance', -2, 41_000], // задние ступичные подшипники
    [1_500, 'other', -2, null],
    [900, 'other', -1, null],
    [6_400, 'other', -6, null], // сезонная смена шин + хранение
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

  /**
   * Журнал ТО демо-гаража. Формулировки намеренно совпадают с названиями
   * регламентных работ (src/lib/service.ts) — по ним раздел «ТО» определяет,
   * что и когда менялось, и считает остаток до следующей замены.
   */
  const maintenance: MaintenanceRecord[] = [
    {
      id: uid(),
      user_id: DEMO_USER.id,
      date: toDateInputValue(addMonths(now, -24)),
      mileage: 2_600,
      description: 'ТО-0 (2 500 км): моторное масло и масляный фильтр, протяжка крепежа',
    },
    {
      id: uid(),
      user_id: DEMO_USER.id,
      date: toDateInputValue(addMonths(now, -17)),
      mileage: 15_200,
      description:
        'ТО-1 (15 000 км): моторное масло и масляный фильтр, салонный фильтр, воздушный фильтр, диагностика ходовой',
    },
    {
      id: uid(),
      user_id: DEMO_USER.id,
      date: toDateInputValue(addMonths(now, -8)),
      mileage: 30_400,
      description:
        'ТО-2 (30 000 км): моторное масло и масляный фильтр, воздушный фильтр, салонный фильтр, свечи зажигания, топливный фильтр',
    },
    {
      id: uid(),
      user_id: DEMO_USER.id,
      date: toDateInputValue(addMonths(now, -5)),
      mileage: 36_500,
      description: 'Замена стоек стабилизатора (стук на мелких неровностях), развал-схождение',
    },
    {
      id: uid(),
      user_id: DEMO_USER.id,
      date: toDateInputValue(addMonths(now, -2)),
      mileage: 41_000,
      description: 'Замена задних ступичных подшипников (гул с 38 000 км)',
    },
  ]
  maintenance.sort((a, b) => b.date.localeCompare(a.date))

  return { car, loan, transactions: txs, maintenance }
}

function seed(force = false): void {
  if (!force && localStorage.getItem(KEYS.seeded)) return
  const { car, loan, transactions, maintenance } = buildDemoData()
  write(KEYS.car, car)
  write(KEYS.loan, loan)
  write(KEYS.transactions, transactions)
  write(KEYS.maintenance, maintenance)
  try {
    localStorage.setItem(KEYS.seeded, '1')
  } catch {
    /* ignore */
  }
}

/** Пересоздаёт демо-данные (кнопка «Сбросить демо-данные» в шапке) */
export function resetDemoData(): void {
  seed(true)
}

/* ---------- Auth ---------- */

const localAuth: AuthApi = {
  async getUser() {
    return localStorage.getItem(KEYS.session) ? DEMO_USER : null
  },
  async getAccessToken() {
    // Локальный демонстрационный пользователь не имеет JWT и не может
    // безопасно связать браузерные данные с Telegram-аккаунтом.
    return null
  },
  async signIn() {
    // Демо-кабинет открыт без проверки пароля: данные и так лежат только
    // в этом браузере. Сид гарантирует, что кабинет не будет пустым.
    seed()
    try {
      localStorage.setItem(KEYS.session, '1')
    } catch {
      /* приватный режим — сессия проживёт до перезагрузки */
    }
    return DEMO_USER
  },
  async signUp() {
    // В демо-режиме настоящую регистрацию выполнить невозможно:
    // молча заходить в демо (как раньше) — обман пользователя,
    // поэтому явно отказываем.
    throw new Error(
      'Регистрация недоступна: приложение работает в локальном демо-режиме. ' +
        'Выйдите из демо или укажите VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.',
    )
  },
  async signOut() {
    localStorage.removeItem(KEYS.session)
  },
  onChange() {
    return () => {}
  },
  async getSettings() {
    return null
  },
  async resendConfirmation() {
    /* в демо-режиме письма не отправляются */
  },
}

/* ---------- Data ---------- */

const localData: DataApi = {
  async ensureProfile() {
    /* в демо-режиме профиль не нужен */
  },

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
  async updateTransaction(id: string, tx: NewTransaction) {
    const list = read<Transaction[]>(KEYS.transactions, [])
    const index = list.findIndex((item) => item.id === id)
    if (index < 0) throw new Error('Расход не найден')
    const updated = { ...list[index], ...tx }
    list[index] = updated
    write(KEYS.transactions, list.sort((a, b) => b.date.localeCompare(a.date)))
    return updated
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
