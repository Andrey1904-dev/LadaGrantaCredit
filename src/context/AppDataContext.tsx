import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getBackend } from '../lib'
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
  const { user } = useAuth()
  const backend = useMemo(() => getBackend(), [])
  const [car, setCar] = useState<Car | null>(null)
  const [loan, setLoan] = useState<Loan | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
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
    }
  }, [user, refresh])

  const value: AppDataValue = {
    car,
    loan,
    transactions,
    maintenance,
    loading,

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
