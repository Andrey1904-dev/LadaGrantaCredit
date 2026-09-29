import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getBackend } from '../lib'
import type { AuthUser, SignUpResult } from '../lib/backend'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  mode: 'supabase' | 'demo'
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<SignUpResult>
  signOut(): Promise<void>
  enterDemo(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const backend = useMemo(() => getBackend(), [])
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

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
    async signIn(email, password) {
      setUser(await backend.auth.signIn(email, password))
    },
    async signUp(email, password) {
      const result = await backend.auth.signUp(email, password)
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
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return ctx
}
