/** Категории расходов (соответствуют CHECK-ограничению в таблице transactions) */
export type TxCategory = 'fuel' | 'loan' | 'maintenance' | 'insurance' | 'other'

export const TX_CATEGORIES: TxCategory[] = ['fuel', 'loan', 'maintenance', 'insurance', 'other']

export interface Profile {
  id: string
  email: string
}

export interface Car {
  id: string
  user_id: string
  plate_number: string
  vin_number: string
  current_mileage: number
  initial_mileage: number
  insurance_until: string | null
}

export interface Loan {
  id: string
  user_id: string
  total_amount: number
  interest_rate: number
  monthly_payment: number
  term_months: number
  start_date: string
}

export interface Transaction {
  id: string
  user_id: string
  amount: number
  category: TxCategory
  date: string // ISO timestamp
  mileage_at_transaction: number | null
}

export interface MaintenanceRecord {
  id: string
  user_id: string
  date: string // ISO date
  mileage: number
  description: string
}

export type NewTransaction = Omit<Transaction, 'id' | 'user_id'>
export type NewMaintenance = Omit<MaintenanceRecord, 'id' | 'user_id'>
