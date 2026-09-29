import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { Car, Loan, MaintenanceRecord, NewMaintenance, NewTransaction, Transaction } from '../types/domain'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'
import type { AuthApi, AuthUser, Backend, CarPatch, DataApi, LoanPatch } from './backend'

let client: SupabaseClient<Database> | null = null

/** Ленивая инициализация клиента Supabase */
export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  }
  return client
}

const toAuthUser = (u: { id: string; email?: string } | null): AuthUser | null =>
  u ? { id: u.id, email: u.email ?? '' } : null

const supabaseAuth: AuthApi = {
  async getUser() {
    const { data } = await getSupabase().auth.getUser()
    return toAuthUser(data.user)
  },
  async signIn(email, password) {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password })
    if (error) throw new Error(translateAuthError(error.message))
    return toAuthUser(data.user)!
  },
  async signUp(email, password) {
    const { data, error } = await getSupabase().auth.signUp({ email, password })
    if (error) throw new Error(translateAuthError(error.message))
    if (!data.user) throw new Error('Не удалось создать аккаунт')
    return { user: toAuthUser(data.user)!, session: data.session !== null }
  },
  async signOut() {
    await getSupabase().auth.signOut()
  },
  onChange(cb) {
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      cb(toAuthUser(session?.user ?? null))
    })
    return () => data.subscription.unsubscribe()
  },
}

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Неверный email или пароль'
  if (msg.includes('User already registered')) return 'Пользователь с таким email уже зарегистрирован'
  if (msg.includes('Password should be')) return 'Пароль должен содержать минимум 6 символов'
  if (msg.includes('Unable to validate email')) return 'Некорректный email'
  if (msg.includes('Email not confirmed'))
    return 'Email не подтверждён. Проверьте почту или отключите подтверждение email в настройках Supabase Auth'
  return msg
}

const supabaseData: DataApi = {
  async ensureProfile(user: AuthUser) {
    // idempotent: INSERT ... ON CONFLICT DO NOTHING (ignoreDuplicates)
    await getSupabase()
      .from('profiles')
      .upsert({ id: user.id, email: user.email }, { ignoreDuplicates: true })
  },

  async getCar(uid) {
    const { data, error } = await getSupabase()
      .from('cars')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },
  async createCar(uid, patch: CarPatch) {
    const { data, error } = await getSupabase()
      .from('cars')
      .insert({ user_id: uid, ...patch })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },
  async updateCar(id: string, patch: CarPatch) {
    const { data, error } = await getSupabase().from('cars').update(patch).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data as Car
  },

  async getLoan(uid) {
    const { data, error } = await getSupabase()
      .from('loans')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },
  async createLoan(uid, patch: Required<LoanPatch>) {
    const { data, error } = await getSupabase()
      .from('loans')
      .insert({ user_id: uid, ...patch })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },
  async updateLoan(id: string, patch: LoanPatch) {
    const { data, error } = await getSupabase().from('loans').update(patch).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data as Loan
  },

  async listTransactions(uid) {
    const { data, error } = await getSupabase()
      .from('transactions')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as Transaction[]
  },
  async addTransaction(uid, tx: NewTransaction) {
    const { data, error } = await getSupabase()
      .from('transactions')
      .insert({ user_id: uid, ...tx })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Transaction
  },
  async removeTransaction(id: string) {
    const { error } = await getSupabase().from('transactions').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async listMaintenance(uid) {
    const { data, error } = await getSupabase()
      .from('maintenance')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as MaintenanceRecord[]
  },
  async addMaintenance(uid, m: NewMaintenance) {
    const { data, error } = await getSupabase()
      .from('maintenance')
      .insert({ user_id: uid, ...m })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as MaintenanceRecord
  },
  async removeMaintenance(id: string) {
    const { error } = await getSupabase().from('maintenance').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}

export const supabaseBackend: Backend = { mode: 'supabase', auth: supabaseAuth, data: supabaseData }
