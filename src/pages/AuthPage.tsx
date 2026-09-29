import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { mailCooldownLeft, useAuth } from '../context/AuthContext'
import { Button, Field } from '../components/ui'
import { checkEmail, webmailUrl } from '../lib/email'
import { AuthProblem, toAuthProblem } from '../lib/authErrors'

/** Экран 0: Авторизация (Email + Пароль через Supabase Auth) */
export default function AuthPage() {
  const { signIn, signUp, enterDemo, resendConfirmation, mode, settings } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState<AuthProblem | null>(null)
  const [notice, setNotice] = useState('')
  /** адрес, на который ждём письмо (для кнопки «отправить ещё раз») */
  const [pendingEmail, setPendingEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(mailCooldownLeft())
  const passwordRef = useRef<HTMLInputElement>(null)

  /** живой отсчёт до следующей разрешённой отправки письма */
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(mailCooldownLeft()), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const check = useMemo(() => checkEmail(email), [email])
  /** проект отправляет письма с подтверждением (а значит, упирается в лимиты) */
  const needsConfirmation = settings !== null && settings.autoconfirm === false
  const signupBlocked = settings?.signupDisabled === true

  const reset = () => {
    setProblem(null)
    setNotice('')
  }

  const fail = (e: unknown) => {
    const p = toAuthProblem(e)
    setProblem(p)
    setNotice('')
    if (p.retryAfterSec) setCooldown(mailCooldownLeft())
  }

  const submit = async () => {
    reset()
    if (!check.ok) {
      setProblem(new AuthProblem('email_invalid', check.error ?? 'Введите корректный email'))
      return
    }
    if (password.length < 6) {
      setProblem(new AuthProblem('weak_password', 'Пароль должен содержать минимум 6 символов'))
      return
    }
    setBusy(true)
    try {
      if (isRegister) {
        const result = await signUp(check.email, password)
        setPendingEmail(check.email)
        setCooldown(mailCooldownLeft())
        if (!result.session) {
          // Supabase требует подтверждения email
          setNotice(
            `Аккаунт создан. Письмо со ссылкой подтверждения отправлено на ${check.email}. ` +
              'Откройте ссылку из письма (загляните и в папку «Спам»), затем войдите.',
          )
          setIsRegister(false)
          setPassword('')
        }
      } else {
        await signIn(check.email, password)
      }
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  /** «Попробовать войти» — аккаунт мог быть создан, даже если письмо не ушло */
  const tryLogin = async () => {
    reset()
    setBusy(true)
    try {
      await signIn(check.email || pendingEmail, password)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    reset()
    setBusy(true)
    try {
      await resendConfirmation(pendingEmail || check.email)
      setCooldown(mailCooldownLeft())
      setNotice(`Письмо отправлено повторно на ${pendingEmail || check.email}. Проверьте входящие и «Спам».`)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const mailLink = webmailUrl(pendingEmail || check.email)

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
              inputMode="email"
              placeholder="ivan@mail.ru"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (problem) setProblem(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && passwordRef.current?.focus()}
              hint={
                isRegister ? 'Подойдёт любая почта: mail.ru, yandex.ru, bk.ru, gmail.com, .рф' : undefined
              }
            />

            {/* мягкая подсказка при опечатке в домене */}
            {email.length > 3 && check.suggestion && check.fixed && (
              <button
                type="button"
                onClick={() => setEmail(check.fixed!)}
                className="-mt-1.5 self-start text-left text-[12.5px] font-medium text-lada"
              >
                {check.suggestion} — исправить
              </button>
            )}

            <Field
              label="Пароль"
              type="password"
              placeholder="Минимум 6 символов"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              ref={passwordRef}
              onChange={(e) => {
                setPassword(e.target.value)
                if (problem) setProblem(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />

            {/* Регистрация запрещена в настройках проекта */}
            {isRegister && signupBlocked && (
              <InfoBox tone="warn" title="Регистрация отключена в проекте Supabase">
                Включите её в Dashboard: Authentication → Sign In / Up → «Allow new users to sign up».
              </InfoBox>
            )}

            {/* Предупреждаем заранее: письма шлёт встроенный отправитель Supabase */}
            {isRegister && !signupBlocked && needsConfirmation && (
              <InfoBox tone="warn" title="Потребуется подтверждение по письму">
                После регистрации Supabase пришлёт письмо со ссылкой. Если письмо не приходит или
                появляется «email rate limit exceeded» — в проекте не подключён свой SMTP:
                встроенный отправитель шлёт 2 письма в час и только на адреса участников команды.
                <MailFix />
              </InfoBox>
            )}

            {problem && (
              <div className="rounded-xl bg-danger/10 px-3.5 py-3 text-[13px] text-danger">
                <p className="font-semibold">{problem.message}</p>
                {problem.detail && <p className="mt-1.5 text-[12.5px] leading-relaxed">{problem.detail}</p>}

                {(problem.mailIssue || problem.kind === 'user_exists') && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {problem.kind === 'user_exists' && (
                      <MiniButton
                        onClick={() => {
                          reset()
                          setIsRegister(false)
                        }}
                      >
                        Перейти ко входу
                      </MiniButton>
                    )}
                    {problem.mailIssue && password.length >= 6 && (
                      <MiniButton onClick={() => void tryLogin()} disabled={busy}>
                        Попробовать войти
                      </MiniButton>
                    )}
                    {problem.mailIssue && problem.kind !== 'email_rate_limit' && (
                      <MiniButton onClick={() => void resend()} disabled={busy || cooldown > 0}>
                        {cooldown > 0 ? `Письмо ещё раз (${cooldown} с)` : 'Отправить письмо ещё раз'}
                      </MiniButton>
                    )}
                  </div>
                )}

                {problem.mailIssue && <MailFix />}
              </div>
            )}

            {notice && (
              <div className="rounded-xl bg-success/10 px-3.5 py-3 text-[13px] text-success">
                <p className="font-medium leading-relaxed">{notice}</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {mailLink && (
                    <a
                      href={mailLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-white/70 px-2.5 py-1.5 text-[12.5px] font-semibold text-success"
                    >
                      Открыть почту
                    </a>
                  )}
                  {pendingEmail && (
                    <MiniButton onClick={() => void resend()} disabled={busy || cooldown > 0} tone="success">
                      {cooldown > 0 ? `Письмо ещё раз (${cooldown} с)` : 'Отправить письмо ещё раз'}
                    </MiniButton>
                  )}
                </div>
              </div>
            )}

            <Button onClick={submit} disabled={busy || (isRegister && signupBlocked)} className="mt-1 w-full">
              {busy ? 'Подождите…' : isRegister ? 'Создать аккаунт' : 'Войти'}
            </Button>

            <button
              onClick={() => {
                setIsRegister(!isRegister)
                reset()
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

/** Инструкция для владельца проекта: как сделать, чтобы письма не мешали */
function MailFix() {
  return (
    <details className="mt-2 text-[12px] leading-relaxed">
      <summary className="cursor-pointer font-semibold">Что сделать владельцу проекта</summary>
      <ol className="mt-1.5 list-decimal space-y-1 pl-4">
        <li>
          <span className="font-semibold">Быстро (регистрация заработает сразу, писем не будет):</span>{' '}
          Supabase Dashboard → Authentication → Sign In / Up → Email → выключить «Confirm email».
        </li>
        <li>
          <span className="font-semibold">Правильно (письма на любые адреса, включая .ru):</span>{' '}
          Authentication → Emails → SMTP Settings → подключить свой SMTP (Resend, Brevo, Unisender,
          Яндекс 360) и поднять лимит в Authentication → Rate Limits.
        </li>
        <li>
          Или одной командой из репозитория: <code>npm run supabase:auth -- --no-confirm</code>{' '}
          (подробности — в README).
        </li>
      </ol>
    </details>
  )
}

function InfoBox({
  tone,
  title,
  children,
}: {
  tone: 'warn' | 'info'
  title: string
  children: ReactNode
}) {
  const styles =
    tone === 'warn'
      ? 'border-warning/40 bg-warning/10 text-[#9a6700]'
      : 'border-lada/30 bg-lada-light text-lada'
  return (
    <div className={`rounded-2xl border px-4 py-3 ${styles}`}>
      <p className="text-[13px] font-bold">{title}</p>
      <div className="mt-1.5 text-[12.5px] leading-relaxed">{children}</div>
    </div>
  )
}

function MiniButton({
  children,
  onClick,
  disabled,
  tone = 'danger',
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'danger' | 'success'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50 ${
        tone === 'danger' ? 'bg-white/70 text-danger hover:bg-white' : 'bg-white/70 text-success hover:bg-white'
      }`}
    >
      {children}
    </button>
  )
}
