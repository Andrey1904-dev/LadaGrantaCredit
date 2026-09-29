/**
 * Заглушки контекстов для smoke-теста: рендерим страницы с заполненными
 * данными, чтобы проверить ветки с графиками, таблицами и виджетами —
 * именно в них находится основная часть дизайна.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { Car, Loan, MaintenanceRecord, Transaction } from '../src/types/domain.ts';

const today = new Date();
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => iso(new Date(today.getTime() - n * 86400000));

export const DEMO_CAR: Car = {
  id: 'car-1',
  user_id: 'u1',
  plate_number: 'А123ВС77',
  vin_number: 'XTA219050E0123456',
  current_mileage: 48_320,
  initial_mileage: 12_000,
  insurance_until: new Date(today.getTime() + 9 * 86400000).toISOString().slice(0, 10),
};

export const DEMO_LOAN: Loan = {
  id: 'loan-1',
  user_id: 'u1',
  total_amount: 1_050_000,
  interest_rate: 18.5,
  monthly_payment: 27_400,
  term_months: 60,
  start_date: daysAgo(400).slice(0, 10),
};

export const DEMO_TX: Transaction[] = [
  { id: 't1', user_id: 'u1', amount: 2450, category: 'fuel', date: daysAgo(2), mileage_at_transaction: 48_100 },
  { id: 't2', user_id: 'u1', amount: 27_400, category: 'loan', date: daysAgo(9), mileage_at_transaction: null },
  { id: 't3', user_id: 'u1', amount: 5900, category: 'maintenance', date: daysAgo(21), mileage_at_transaction: 46_800 },
  { id: 't4', user_id: 'u1', amount: 4300, category: 'insurance', date: daysAgo(40), mileage_at_transaction: null },
  { id: 't5', user_id: 'u1', amount: 600, category: 'other', date: daysAgo(55), mileage_at_transaction: null },
  { id: 't6', user_id: 'u1', amount: 2380, category: 'fuel', date: daysAgo(70), mileage_at_transaction: 45_900 },
];

export const DEMO_MAINT: MaintenanceRecord[] = [
  { id: 'm1', user_id: 'u1', date: daysAgo(21).slice(0, 10), mileage: 46_800, description: 'ТО-3: моторное масло и масляный фильтр, воздушный фильтр, свечи зажигания' },
  { id: 'm2', user_id: 'u1', date: daysAgo(120).slice(0, 10), mileage: 41_000, description: 'Замена передних тормозных колодок и тормозной жидкости' },
  { id: 'm3', user_id: 'u1', date: daysAgo(320).slice(0, 10), mileage: 30_100, description: 'Ремень ГРМ с роликами и помпа, антифриз' },
];

const noop = async () => {};

/** SMOKE_BLANK=1 — «новый пользователь»: экраны должны показать пустые состояния, а не упасть */
const blank = process.env.SMOKE_BLANK === '1';

const appData = {
  car: blank ? null : DEMO_CAR,
  loan: blank ? null : DEMO_LOAN,
  transactions: blank ? [] : DEMO_TX,
  maintenance: blank ? [] : DEMO_MAINT,
  loading: false,
  error: null,
  refresh: noop,
  saveCar: noop,
  saveLoan: noop,
  addTransaction: noop,
  removeTransaction: noop,
  addMaintenance: noop,
  removeMaintenance: noop,
};

const auth = {
  user: { id: 'u1', email: 'owner@example.com' },
  loading: false,
  mode: 'demo' as const,
  demoOnly: false,
  backend: { mode: 'demo' as const },
  settings: null,
  signIn: noop,
  signUp: noop,
  signOut: noop,
  enterDemo: noop,
  resendConfirmation: noop,
};

const AppDataCtx = createContext(appData);
const AuthCtx = createContext(auth);

export const AppDataProvider = ({ children }: { children: ReactNode }) => (
  <AppDataCtx.Provider value={appData}>{children}</AppDataCtx.Provider>
);
export const useAppData = () => useContext(AppDataCtx);
export const AuthProvider = ({ children }: { children: ReactNode }) => (
  <AuthCtx.Provider value={auth}>{children}</AuthCtx.Provider>
);
export const useAuth = () => useContext(AuthCtx);
export function mailCooldownLeft() {
  return 0;
}
