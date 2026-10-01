import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { mailCooldownLeft, useAuth } from '../context/AuthContext'
import { Button, Field, SegmentedControl } from '../components/ui'
import { checkEmail, webmailUrl } from '../lib/email'
import { AuthProblem, toAuthProblem } from '../lib/authErrors'
import { LADA_DUO_ASSETS } from '../lib/assets'
import { AlertIcon, ArrowUpRightIcon, CarIcon, CheckIcon, InfoIcon } from '../components/icons'

/** Экран 0: Авторизация и вход в личный кабинет владельца LADA Granta и Vesta */
export default function AuthPage() {
  const { signIn, signUp, enterDemo, leaveDemo, resendConfirmation, demoOnly, mode, settings } =
    useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState<AuthProblem | null>(null)
  const [notice, setNotice] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(mailCooldownLeft())
  const passwordRef = useRef<HTMLInputElement>(null)

  /**
   * На экран входа попадают только без сессии. Если при этом приложение всё
   * ещё помнит демо-режим (сессию очистили вручную, браузер почистил
   * localStorage), форма входа обращалась бы к localStorage вместо Supabase
   * и выдавала «неверный пароль» на реальную учётку. Возвращаем облачный режим.
   */
  useEffect(() => {
    if (mode === 'demo' && !demoOnly) leaveDemo()
    // только при монтировании: вход в демо ниже по коду не должен его отменять
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(mailCooldownLeft()), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const check = useMemo(() => checkEmail(email), [email])
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
      setProblem(
        new AuthProblem('email_invalid', check.error ?? 'Введите корректный email'),
      )
      return
    }
    if (password.length < 6) {
      setProblem(
        new AuthProblem('weak_password', 'Пароль должен содержать минимум 6 символов'),
      )
      return
    }
    setBusy(true)
    try {
      if (isRegister) {
        const result = await signUp(check.email, password)
        setPendingEmail(check.email)
        setCooldown(mailCooldownLeft())
        if (!result.session) {
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

  /** Вход в локальный демо-кабинет: работает и в сборке с ключами Supabase */
  const enterDemoMode = async () => {
    reset()
    setBusy(true)
    try {
      await enterDemo()
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
      setNotice(
        `Письмо отправлено повторно на ${pendingEmail || check.email}. Проверьте входящие и «Спам».`,
      )
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const mailLink = webmailUrl(pendingEmail || check.email)

  return (
    <div className="animate-page-enter min-h-dvh w-full bg-[#0E1013] text-[#F3F4F4]">
      <div className="mx-auto grid min-h-dvh max-w-[1040px] grid-cols-1 lg:grid-cols-12 lg:items-center lg:gap-8 lg:px-6 lg:py-8">
        {/* Левая / верхняя колонка: Hero-кадр дуэта Granta + Vesta на мосту + макро шильдиков GRANTA | VESTA */}
        <div className="lg:col-span-7">
          <div className="relative overflow-hidden bg-[#1A1D22] lg:rounded-[12px] lg:border lg:border-[#363B43]">
            {/* Кадр 1: Granta и Vesta на мосту, ракурс 3/4. Обе машины целиком в кадре, бамперы и колёса не обрезаются */}
            <div className="relative aspect-[16/10] w-full bg-[#0E1013] sm:aspect-[16/9]">
              <img
                src={LADA_DUO_ASSETS.hero.src}
                data-webp-src={LADA_DUO_ASSETS.hero.webp}
                alt={LADA_DUO_ASSETS.hero.alt}
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover object-center"
              />
              {/* Мягкое затемнение под текст градиентом, не перекрывающее автомобиль непрозрачной плашкой */}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0E1013] via-[#0E1013]/30 to-transparent"
                aria-hidden="true"
              />
            </div>

            {/* Заголовок поверх нижней части градиента */}
            <div className="relative -mt-6 px-5 pb-5 sm:px-6">
              <div className="inline-flex items-center gap-2 rounded-[6px] border border-[#E33337]/50 bg-[#0E1013]/85 px-2.5 py-1 backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-[#E33337]" aria-hidden="true" />
                <span className="font-display-num text-[11px] font-bold uppercase tracking-widest text-[#F3F4F4]">
                  LADA GRANTA & VESTA · ЛИЧНЫЙ КАБИНЕТ
                </span>
              </div>
              <h1 className="font-display-num mt-2.5 text-[28px] font-bold uppercase leading-tight tracking-wide text-[#F3F4F4] sm:text-[32px]">
                LADA Кредит &amp; Гараж
              </h1>
              <p className="mt-1.5 max-w-[460px] text-[13.5px] leading-relaxed text-[#A9AFB7]">
                Персональный учёт автокредита, расхода топлива, стоимости километра, полиса ОСАГО и сервисной книжки вашего автомобиля.
              </p>
            </div>
          </div>

          {/* Кадр 2: Крупный план шильдиков GRANTA и VESTA (без наложения текста поверх шильдиков) */}
          <div className="mx-4 mt-3 overflow-hidden rounded-[10px] border border-[#363B43] bg-[#1A1D22] lg:mx-0 lg:mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr]">
              <div className="h-24 w-full overflow-hidden bg-[#0E1013] sm:h-full">
                <img
                  src={LADA_DUO_ASSETS.detail.src}
                  data-webp-src={LADA_DUO_ASSETS.detail.webp}
                  alt={LADA_DUO_ASSETS.detail.alt}
                  loading="lazy"
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <div className="flex flex-col justify-center border-t border-[#363B43] p-3.5 sm:border-l sm:border-t-0">
                <p className="font-display-num text-[13px] font-bold uppercase tracking-wider text-[#F3F4F4]">
                  Все сценарии владельца в одной системе
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#A9AFB7]">
                  Аннуитетный график и калькулятор ПДН, учёт заправок с контролем одометра, напоминания об ОСАГО и журнал ТО.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Правая / нижняя колонка: форма входа, предупреждения Supabase и демо-режим */}
        <div className="px-4 pb-10 pt-4 lg:col-span-5 lg:px-0 lg:py-0">
          <div className="rounded-[12px] border border-[#363B43] bg-[#1A1D22] p-5 sm:p-6">
            {demoOnly ? (
              /* Демо-режим: сборка без ключей Supabase */
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-[#363B43] pb-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#E33337]">
                      Автономный режим
                    </span>
                    <h2 className="font-display-num text-[20px] font-bold uppercase tracking-wide text-[#F3F4F4]">
                      Демо-кабинет владельца
                    </h2>
                  </div>
                  <CarIcon className="h-6 w-6 text-[#E33337]" />
                </div>

                <div className="rounded-[10px] border border-[#F5A623]/40 bg-[#F5A623]/10 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#F5A623]" />
                    <div>
                      <p className="text-[13.5px] font-bold text-[#F3F4F4]">
                        Вход и регистрация отключены
                      </p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-[#A9AFB7]">
                        Эта сборка приложения запущена без ключей Supabase, поэтому создать облачный аккаунт или войти по email нельзя. Доступен полнофункциональный{' '}
                        <strong className="text-[#F3F4F4]">локальный демо-режим</strong> — все данные сохраняются в браузере (<code className="font-mono text-[11.5px] text-[#F3F4F4]">localStorage</code>).
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => void enterDemoMode()}
                  disabled={busy}
                  className="w-full py-3 text-[14.5px]"
                >
                  {busy ? 'Открываем демо-кабинет…' : 'Войти в демо-режим'}
                  <ArrowUpRightIcon className="h-4 w-4" />
                </Button>

                {problem && (
                  <div
                    role="alert"
                    className="rounded-[10px] border border-[#EF4444]/45 bg-[#EF4444]/12 p-3.5 text-[12.5px] text-[#F3F4F4]"
                  >
                    {problem.message}
                  </div>
                )}

                <div className="rounded-[10px] border border-[#363B43] bg-[#23272D]/60 p-3.5 text-[12px] leading-relaxed text-[#A9AFB7]">
                  <strong className="text-[#F3F4F4]">Как подключить Supabase:</strong> локально скопируйте{' '}
                  <code className="rounded bg-[#0E1013] px-1.5 py-0.5 font-mono text-[11px] text-[#F3F4F4]">
                    .env.example
                  </code>{' '}
                  в{' '}
                  <code className="rounded bg-[#0E1013] px-1.5 py-0.5 font-mono text-[11px] text-[#F3F4F4]">
                    .env
                  </code>{' '}
                  и укажите <code className="font-mono text-[11px] text-[#F3F4F4]">VITE_SUPABASE_URL</code> и{' '}
                  <code className="font-mono text-[11px] text-[#F3F4F4]">VITE_SUPABASE_ANON_KEY</code>; на GitHub Pages добавьте их в Settings → Secrets and variables → Actions.
                </div>
              </div>
            ) : (
              /* Режим с подключённым Supabase */
              <div className="flex flex-col gap-4">
                <SegmentedControl
                  value={isRegister ? 'register' : 'login'}
                  onChange={(v) => {
                    reset()
                    setIsRegister(v === 'register')
                  }}
                  options={[
                    { value: 'login', label: 'Вход в кабинет' },
                    { value: 'register', label: 'Регистрация' },
                  ]}
                />

                <Field
                  label="Электронная почта"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="ivan@mail.ru"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (problem) setProblem(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && passwordRef.current?.focus()}
                  hint={
                    isRegister
                      ? 'Поддерживается любая почта: mail.ru, yandex.ru, bk.ru, gmail.com, .рф'
                      : undefined
                  }
                />

                {/* Мягкая подсказка при опечатке в домене */}
                {email.length > 3 && check.suggestion && check.fixed && (
                  <div className="flex items-center justify-between gap-2 rounded-[8px] border border-[#F5A623]/40 bg-[#F5A623]/10 px-3 py-2 text-[12px] text-[#F3F4F4]">
                    <span>{check.suggestion}</span>
                    <button
                      type="button"
                      onClick={() => setEmail(check.fixed!)}
                      className="shrink-0 rounded-[6px] bg-[#E33337] px-2.5 py-1 text-[11.5px] font-bold text-[#F3F4F4]"
                    >
                      Исправить
                    </button>
                  </div>
                )}

                <Field
                  ref={passwordRef}
                  label="Пароль"
                  type="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder="Минимум 6 символов"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (problem) setProblem(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && void submit()}
                />

                {/* Предупреждение: регистрация запрещена в настройках проекта */}
                {isRegister && signupBlocked && (
                  <AlertBox tone="danger" title="Регистрация отключена в проекте Supabase">
                    Включите её в Dashboard: Authentication → Sign In / Up → «Allow new users to sign up».
                  </AlertBox>
                )}

                {/* Предупреждение заранее: письма шлёт встроенный отправитель Supabase */}
                {isRegister && !signupBlocked && needsConfirmation && (
                  <AlertBox tone="warn" title="Потребуется подтверждение по ссылке из письма">
                    После регистрации Supabase пришлёт письмо со ссылкой. Если письмо не приходит или появляется{' '}
                    <code className="font-mono text-[11px]">email rate limit exceeded</code> — в проекте не подключён свой SMTP: встроенный отправитель шлёт 2 письма в час и только на адреса участников команды.
                  </AlertBox>
                )}

                {problem && (
                  <div
                    role="alert"
                    className="flex flex-col gap-2.5 rounded-[10px] border border-[#EF4444]/45 bg-[#EF4444]/12 p-3.5 text-[12.5px]"
                  >
                    <div className="flex items-start gap-2">
                      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#EF4444]" />
                      <div className="flex-1">
                        <p className="font-bold text-[#F3F4F4]">{problem.message}</p>
                        {problem.detail && (
                          <p className="mt-1 leading-relaxed text-[#A9AFB7]">{problem.detail}</p>
                        )}
                      </div>
                    </div>

                    {(problem.mailIssue || problem.kind === 'user_exists') && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {problem.kind === 'user_exists' && (
                          <SmallActionButton
                            onClick={() => {
                              reset()
                              setIsRegister(false)
                            }}
                          >
                            Перейти ко входу
                          </SmallActionButton>
                        )}
                        {problem.mailIssue && password.length >= 6 && (
                          <SmallActionButton onClick={() => void tryLogin()} disabled={busy}>
                            Попробовать войти
                          </SmallActionButton>
                        )}
                        {problem.mailIssue && problem.kind !== 'email_rate_limit' && (
                          <SmallActionButton
                            onClick={() => void resend()}
                            disabled={busy || cooldown > 0}
                          >
                            {cooldown > 0
                              ? `Письмо ещё раз (${cooldown} с)`
                              : 'Отправить письмо ещё раз'}
                          </SmallActionButton>
                        )}
                      </div>
                    )}

                    {problem.mailIssue && <SmtpFixHint />}
                  </div>
                )}

                {notice && (
                  <div className="flex flex-col gap-2.5 rounded-[10px] border border-[#16B374]/45 bg-[#16B374]/12 p-3.5 text-[12.5px]">
                    <div className="flex items-start gap-2">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#16B374]" />
                      <p className="leading-relaxed text-[#F3F4F4]">{notice}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {mailLink && (
                        <a
                          href={mailLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-[8px] border border-[#16B374]/50 bg-[#23272D] px-3 py-1 text-[12px] font-bold text-[#F3F4F4] hover:border-[#16B374]"
                        >
                          Открыть почту
                          <ArrowUpRightIcon className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {pendingEmail && (
                        <SmallActionButton
                          tone="success"
                          onClick={() => void resend()}
                          disabled={busy || cooldown > 0}
                        >
                          {cooldown > 0
                            ? `Письмо ещё раз (${cooldown} с)`
                            : 'Отправить письмо ещё раз'}
                        </SmallActionButton>
                      )}
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => void submit()}
                  disabled={busy || (isRegister && signupBlocked)}
                  className="w-full py-3 text-[14.5px]"
                >
                  {busy
                    ? 'Подождите…'
                    : isRegister
                      ? cooldown > 0 && needsConfirmation
                        ? `Повторить через ${cooldown} с`
                        : 'Создать аккаунт'
                      : 'Войти в кабинет'}
                </Button>

                <div className="relative my-1 flex items-center justify-center">
                  <span className="w-full border-t border-[#363B43]" />
                  <span className="bg-[#1A1D22] px-3 text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
                    или без регистрации
                  </span>
                  <span className="w-full border-t border-[#363B43]" />
                </div>

                <Button
                  variant="secondary"
                  onClick={() => void enterDemoMode()}
                  disabled={busy}
                  className="w-full"
                >
                  {busy ? 'Открываем демо-кабинет…' : 'Войти в демо-режим'}
                  <ArrowUpRightIcon className="h-4 w-4 text-[#E33337]" />
                </Button>
                <p className="-mt-1 text-center text-[11.5px] leading-relaxed text-[#A9AFB7]">
                  Демо-кабинет заполнен данными LADA Granta и Vesta и хранится только в этом
                  браузере: кредит, расходы, журнал ТО и план обслуживания можно свободно менять.
                  Выход из демо вернёт обычный вход по email.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AlertBox({
  tone,
  title,
  children,
}: {
  tone: 'warn' | 'danger'
  title: string
  children: ReactNode
}) {
  const styles =
    tone === 'danger'
      ? 'border-[#EF4444]/45 bg-[#EF4444]/10 text-[#EF4444]'
      : 'border-[#F5A623]/45 bg-[#F5A623]/10 text-[#F5A623]'
  return (
    <div className={`rounded-[10px] border p-3.5 text-[12px] ${styles}`}>
      <div className="flex items-start gap-2">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-bold text-[#F3F4F4]">{title}</p>
          <p className="mt-1 leading-relaxed text-[#A9AFB7]">{children}</p>
        </div>
      </div>
    </div>
  )
}

function SmallActionButton({
  children,
  onClick,
  disabled,
  tone = 'default',
}: {
  children: ReactNode
  onClick(): void
  disabled?: boolean
  tone?: 'default' | 'success'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[36px] rounded-[8px] border px-3 py-1 text-[12px] font-semibold transition-colors disabled:opacity-45 ${
        tone === 'success'
          ? 'border-[#16B374]/45 bg-[#23272D] text-[#F3F4F4] hover:border-[#16B374]'
          : 'border-[#363B43] bg-[#23272D] text-[#F3F4F4] hover:border-[#E33337]'
      }`}
    >
      {children}
    </button>
  )
}

function SmtpFixHint() {
  return (
    <details className="mt-1 rounded-[8px] border border-[#363B43] bg-[#0E1013]/80 px-3 py-2 text-[11.5px] text-[#A9AFB7]">
      <summary className="cursor-pointer font-semibold text-[#F3F4F4]">
        Как владельцу проекта починить отправку писем (30 сек)
      </summary>
      <ol className="mt-2 list-decimal space-y-1 pl-4 leading-relaxed">
        <li>
          Быстро: в Supabase Dashboard откройте{' '}
          <strong className="text-[#F3F4F4]">Authentication → Sign In / Up → Email</strong> и выключите{' '}
          <strong className="text-[#F3F4F4]">Confirm email</strong>.
        </li>
        <li>
          Либо из терминала выполните:{' '}
          <code className="rounded bg-[#23272D] px-1.5 py-0.5 font-mono text-[11px] text-[#F3F4F4]">
            SUPABASE_ACCESS_TOKEN=sbp_xxx npm run supabase:auth -- --no-confirm
          </code>
        </li>
      </ol>
    </details>
  )
}
