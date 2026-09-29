import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Button, Field } from '../components/ui'

/** Экран 0: Авторизация (Email + Пароль через Supabase Auth) */
export default function AuthPage() {
  const { signIn, signUp, enterDemo, mode } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError('')
    setNotice('')
    if (!email.includes('@')) {
      setError('Введите корректный email')
      return
    }
    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов')
      return
    }
    setBusy(true)
    try {
      if (isRegister) {
        const result = await signUp(email, password)
        if (!result.session) {
          // Supabase требует подтверждения email
          setNotice(
            `Аккаунт создан! Мы отправили письмо со ссылкой подтверждения на ${email}. Подтвердите email и войдите.`,
          )
          setIsRegister(false)
          setPassword('')
        }
      } else {
        await signIn(email, password)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка авторизации')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-white px-6 shadow-[0_0_40px_rgba(0,0,0,0.08)]">
      <div className="flex flex-1 flex-col justify-center py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="./favicon.svg" alt="LADA" className="mb-4 h-20 w-20 rounded-2xl shadow-lg shadow-lada/25" />
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink">
            LADA <span className="text-lada">Кредит&nbsp;&&nbsp;Гараж</span>
          </h1>
          <p className="mt-1.5 max-w-[280px] text-[13px] leading-relaxed text-muted">
            Учёт расходов, ТО и умное управление автокредитом вашей LADA Granta
          </p>
        </div>

        {mode === 'demo' ? (
          /* Демо-режим: настоящий вход и регистрация невозможны —
             не показываем форму, которая молча заводила в демо */
          <div className="flex flex-col gap-3.5">
            <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3.5">
              <p className="text-[14px] font-bold text-[#9a6700]">Вход и регистрация отключены</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#9a6700]">
                Эта сборка приложения сделана без ключей Supabase, поэтому создать настоящий
                аккаунт или войти по email невозможно — данные было бы некуда сохранять.
                Доступен только демо-режим: данные хранятся в браузере и не синхронизируются.
              </p>
              <p className="mt-2.5 text-[12px] leading-relaxed text-[#9a6700]">
                <span className="font-bold">Как включить:</span> локально — скопируйте{' '}
                <code>.env.example</code> в <code>.env</code> и укажите ключи проекта Supabase;
                на GitHub Pages — добавьте секреты <code>VITE_SUPABASE_URL</code> и{' '}
                <code>VITE_SUPABASE_ANON_KEY</code> в Settings → Secrets and variables → Actions
                и запустите деплой заново.
              </p>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => void enterDemo()}>
              Войти в демо-режим
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <Field
              label="Email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label="Пароль"
              type="password"
              placeholder="Минимум 6 символов"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />

            {error && (
              <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13px] font-medium text-danger">{error}</p>
            )}
            {notice && (
              <p className="rounded-xl bg-success/10 px-3.5 py-2.5 text-[13px] font-medium text-success">{notice}</p>
            )}

            <Button onClick={submit} disabled={busy} className="mt-1 w-full">
              {busy ? 'Подождите…' : isRegister ? 'Создать аккаунт' : 'Войти'}
            </Button>

            <button
              onClick={() => {
                setIsRegister(!isRegister)
                setError('')
                setNotice('')
              }}
              className="text-center text-[13px] font-semibold text-lada"
            >
              {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
