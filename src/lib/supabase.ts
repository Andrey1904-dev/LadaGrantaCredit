import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { Car, Loan, MaintenanceRecord, NewMaintenance, NewTransaction, Transaction } from '../types/domain'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'
import type { AuthApi, AuthSettings, AuthUser, Backend, CarPatch, DataApi, LoanPatch } from './backend'
import { AuthProblem, toAuthProblem } from './authErrors'
import { normalizeEmail } from './email'

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

/** Кэш публичных настроек Auth (нужен, чтобы знать, шлёт ли проект письма) */
let settingsCache: AuthSettings | null | undefined

/** Ссылка, на которую вернётся пользователь из письма-подтверждения */
const emailRedirectTo = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined

const supabaseAuth: AuthApi = {
  async getUser() {
    const { data } = await getSupabase().auth.getUser()
    return toAuthUser(data.user)
  },

  async signIn(email, password) {
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    })
    if (error) throw toAuthProblem(error)
    return toAuthUser(data.user)!
  },

  async signUp(email, password) {
    const address = normalizeEmail(email)
    const { data, error } = await getSupabase().auth.signUp({
      email: address,
      password,
      options: { emailRedirectTo },
    })
    if (error) throw toAuthProblem(error)
    if (!data.user) throw new AuthProblem('unknown', 'Не удалось создать аккаунт')

    // Supabase скрывает факт существования аккаунта: при повторной регистрации
    // возвращается пользователь с пустым списком identities и без сессии.
    const alreadyRegistered = Array.isArray(data.user.identities) && data.user.identities.length === 0
    if (alreadyRegistered) {
      throw new AuthProblem('user_exists', 'Этот email уже зарегистрирован', {
        detail: 'Войдите с этим адресом и паролем — регистрироваться заново не нужно.',
      })
    }

    const session = data.session !== null
    return { user: toAuthUser(data.user)!, session, confirmationSent: !session }
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

  async getSettings() {
    if (settingsCache !== undefined) return settingsCache
    try {
      const res = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/settings`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      })
      if (!res.ok) throw new Error(String(res.status))
      const json = (await res.json()) as { mailer_autoconfirm?: boolean; disable_signup?: boolean }
      settingsCache = {
        autoconfirm: json.mailer_autoconfirm === true,
        signupDisabled: json.disable_signup === true,
      }
    } catch {
      settingsCache = null
    }
    return settingsCache
  },

  async resendConfirmation(email) {
    const { error } = await getSupabase().auth.resend({
      type: 'signup',
      email: normalizeEmail(email),
      options: { emailRedirectTo },
    })
    if (error) throw toAuthProblem(error)
  },
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
