import type { Car, Loan, MaintenanceRecord, NewMaintenance, NewTransaction, Transaction } from '../types/domain'

export interface AuthUser {
  id: string
  email: string
}

export interface SignUpResult {
  user: AuthUser
  /** false — требуется подтверждение email, сессия ещё не создана */
  session: boolean
}

export interface AuthApi {
  getUser(): Promise<AuthUser | null>
  signIn(email: string, password: string): Promise<AuthUser>
  signUp(email: string, password: string): Promise<SignUpResult>
  signOut(): Promise<void>
  onChange(cb: (user: AuthUser | null) => void): () => void
}

export interface CarPatch {
  plate_number?: string
  vin_number?: string
  current_mileage?: number
  initial_mileage?: number
  insurance_until?: string | null
}

export interface LoanPatch {
  total_amount?: number
  interest_rate?: number
  monthly_payment?: number
  term_months?: number
  start_date?: string
}

export interface DataApi {
  /** Гарантирует наличие строки профиля (нужно, если пользователь
      зарегистрировался до создания схемы — триггер по нему не отработал) */
  ensureProfile(user: AuthUser): Promise<void>

  getCar(uid: string): Promise<Car | null>
  createCar(uid: string, data: CarPatch): Promise<Car>
  updateCar(id: string, data: CarPatch): Promise<Car>

  getLoan(uid: string): Promise<Loan | null>
  createLoan(uid: string, data: Required<LoanPatch>): Promise<Loan>
  updateLoan(id: string, data: LoanPatch): Promise<Loan>

  listTransactions(uid: string): Promise<Transaction[]>
  addTransaction(uid: string, tx: NewTransaction): Promise<Transaction>
  removeTransaction(id: string): Promise<void>

  listMaintenance(uid: string): Promise<MaintenanceRecord[]>
  addMaintenance(uid: string, m: NewMaintenance): Promise<MaintenanceRecord>
  removeMaintenance(id: string): Promise<void>
}

export interface Backend {
  mode: 'supabase' | 'demo'
  auth: AuthApi
  data: DataApi
}
