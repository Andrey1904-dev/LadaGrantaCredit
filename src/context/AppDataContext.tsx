import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { CarPatch, LoanPatch } from '../lib/backend'
import type {
  Car,
  Loan,
  MaintenanceRecord,
  NewMaintenance,
  NewTransaction,
  Transaction,
} from '../types/domain'
import { useAuth } from './AuthContext'

interface AppDataValue {
  car: Car | null
  loan: Loan | null
  transactions: Transaction[]
  maintenance: MaintenanceRecord[]
  loading: boolean
  /** Ошибка загрузки данных (например, таблицы ещё не созданы в Supabase) */
  error: string | null
  refresh(): Promise<void>
  saveCar(patch: CarPatch): Promise<Car>
  saveLoan(patch: Required<LoanPatch>): Promise<Loan>
  addTransaction(tx: NewTransaction): Promise<Transaction>
  removeTransaction(id: string): Promise<void>
  addMaintenance(m: NewMaintenance): Promise<MaintenanceRecord>
  removeMaintenance(id: string): Promise<void>
}

const AppDataContext = createContext<AppDataValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  // бэкенд берём из AuthContext: при входе в демо-режим он меняется на лету,
  // и данные обязаны читаться из того же хранилища, где выполнен вход
  const { user, backend } = useAuth()
  const [car, setCar] = useState<Car | null>(null)
  const [loan, setLoan] = useState<Loan | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // гарантируем профиль (если пользователь создан до применения схемы)
      await backend.data.ensureProfile(user).catch(() => {})
      const [c, l, tx, m] = await Promise.all([
        backend.data.getCar(user.id),
        backend.data.getLoan(user.id),
        backend.data.listTransactions(user.id),
        backend.data.listMaintenance(user.id),
      ])
      setCar(c)
      setLoan(l)
      setTransactions(tx)
      setMaintenance(m)
      setError(null)
    } catch (e) {
      setError(describeDataError(e))
    } finally {
      setLoading(false)
    }
  }, [backend, user])

  useEffect(() => {
    if (user) {
      void refresh()
    } else {
      setCar(null)
      setLoan(null)
      setTransactions([])
      setMaintenance([])
      setLoading(false)
      setError(null)
    }
  }, [user, refresh])

  const value: AppDataValue = {
    car,
    loan,
    transactions,
    maintenance,
    loading,
    error,

    refresh,

    async saveCar(patch) {
      const saved = car
        ? await backend.data.updateCar(car.id, patch)
        : await backend.data.createCar(user!.id, patch)
      setCar(saved)
      return saved
    },

    async saveLoan(patch) {
      const saved = loan
        ? await backend.data.updateLoan(loan.id, patch)
        : await backend.data.createLoan(user!.id, patch)
      setLoan(saved)
      return saved
    },

    async addTransaction(tx) {
      const saved = await backend.data.addTransaction(user!.id, tx)
      setTransactions((prev) =>
        [saved, ...prev].sort((a, b) => b.date.localeCompare(a.date)),
      )
      return saved
    },

    async removeTransaction(id) {
      await backend.data.removeTransaction(id)
      setTransactions((prev) => prev.filter((t) => t.id !== id))
    },

    async addMaintenance(m) {
      const saved = await backend.data.addMaintenance(user!.id, m)
      setMaintenance((prev) =>
        [saved, ...prev].sort((a, b) => b.date.localeCompare(a.date)),
      )
      return saved
    },

    async removeMaintenance(id) {
      await backend.data.removeMaintenance(id)
      setMaintenance((prev) => prev.filter((m) => m.id !== id))
    },
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData должен использоваться внутри AppDataProvider')
  return ctx
}

/** Переводит ошибки PostgREST/сети в понятные сообщения */
function describeDataError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('schema cache') || msg.includes('PGRST205') || msg.includes('does not exist')) {
    return 'Таблицы в базе данных ещё не созданы. Выполните скрипт supabase/schema.sql в SQL Editor вашего проекта Supabase, затем нажмите «Повторить».'
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Нет соединения с Supabase. Проверьте интернет и попробуйте снова.'
  }
  if (msg.includes('JWT')) {
    return 'Сессия истекла. Выйдите из аккаунта и войдите снова.'
  }
  return msg
}
