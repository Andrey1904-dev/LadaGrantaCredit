import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getBackend } from '../lib'
import type { AuthSettings, AuthUser, SignUpResult } from '../lib/backend'
import { AuthProblem, toAuthProblem } from '../lib/authErrors'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  mode: 'supabase' | 'demo'
  /** Публичные настройки Auth проекта (null — пока не загружены / недоступны) */
  settings: AuthSettings | null
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<SignUpResult>
  signOut(): Promise<void>
  enterDemo(): Promise<void>
  resendConfirmation(email: string): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Локальный анти-спам: Supabase разрешает повторную отправку письма одному
 * пользователю не чаще раза в минуту, а встроенный отправитель — всего
 * 2 письма в час на проект. Поэтому «лишние» попытки гасим ещё на клиенте,
 * чтобы не тратить лимит и не получать 429 (email rate limit exceeded).
 */
const COOLDOWN_KEY = 'lada.auth.lastMailAt'
const COOLDOWN_SEC = 60

export function mailCooldownLeft(): number {
  try {
    const last = Number(localStorage.getItem(COOLDOWN_KEY) ?? 0)
    if (!last) return 0
    const left = Math.ceil((last + COOLDOWN_SEC * 1000 - Date.now()) / 1000)
    return left > 0 ? left : 0
  } catch {
    return 0
  }
}

function markMailSent() {
  try {
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()))
  } catch {
    /* localStorage может быть недоступен */
  }
}

function guardCooldown() {
  const left = mailCooldownLeft()
  if (left > 0) {
    throw new AuthProblem('too_soon', `Письмо уже отправлено — повторите через ${left} с`, {
      detail:
        'Supabase принимает повторную отправку не чаще раза в минуту. ' +
        'Проверьте входящие и папку «Спам».',
      retryAfterSec: left,
      mailIssue: true,
    })
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const backend = useMemo(() => getBackend(), [])
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<AuthSettings | null>(null)

  useEffect(() => {
    let alive = true
    backend.auth
      .getUser()
      .then((u) => {
        if (alive) setUser(u)
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false)
      })
    backend.auth
      .getSettings()
      .then((s) => {
        if (alive) setSettings(s)
      })
      .catch(() => {})
    const unsub = backend.auth.onChange((u) => setUser(u))
    return () => {
      alive = false
      unsub()
    }
  }, [backend])

  const value: AuthContextValue = {
    user,
    loading,
    mode: backend.mode,
    settings,
    async signIn(email, password) {
      setUser(await backend.auth.signIn(email, password))
    },
    async signUp(email, password) {
      // регистрация с включённым подтверждением = отправка письма
      if (settings?.autoconfirm !== true) guardCooldown()
      let result: SignUpResult
      try {
        result = await backend.auth.signUp(email, password)
      } catch (e) {
        const problem = toAuthProblem(e)
        // лимит писем израсходован — следующая попытка раньше чем через минуту
        // всё равно упрётся в лимит, поэтому взводим локальный таймер
        if (problem.mailIssue) markMailSent()
        throw problem
      }
      if (result.confirmationSent) markMailSent()
      // если в проекте включено подтверждение email, сессии пока нет —
      // пользователя пускаем в приложение только после подтверждения и входа
      if (result.session) setUser(result.user)
      return result
    },
    async signOut() {
      await backend.auth.signOut()
      setUser(null)
    },
    async enterDemo() {
      setUser(await backend.auth.signIn('demo@lada.ru', 'demo'))
    },
    async resendConfirmation(email) {
      guardCooldown()
      try {
        await backend.auth.resendConfirmation(email)
        markMailSent()
      } catch (e) {
        const problem = toAuthProblem(e)
        if (problem.mailIssue) markMailSent()
        throw problem
      }
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return ctx
}
