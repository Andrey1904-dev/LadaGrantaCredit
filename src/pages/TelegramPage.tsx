import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowUpRight,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  Gauge,
  Link2,
  LockKeyhole,
  LoaderCircle,
  MessageCircle,
  Send,
  ShieldCheck,
  Unlink,
  Wallet,
  Wrench,
} from 'lucide-react'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import PageHero, { HeroChip } from '../components/PageHero'
import { Button, Card, Field, Spinner } from '../components/ui'
import { daysUntil, nextPaymentDate, startOfMonth } from '../utils/date'
import { fmtDate, fmtMileage, fmtMoney } from '../utils/format'
import { remainingBalance } from '../utils/loan'
import { PAGE_MEDIA } from '../lib/assets'
import {
  checkTelegramHealth,
  isTelegramConfigured,
  requestTelegram,
  TELEGRAM_BOT_URL,
  TELEGRAM_BOT_USERNAME,
  TELEGRAM_CONFIG_ISSUE,
  TELEGRAM_CONFIG_MESSAGE,
  type TelegramApiHealth,
  type TelegramLinkStatus,
} from '../lib/telegram'

const COMMANDS = [
  { command: '/garage', title: 'Мой автомобиль', detail: 'Пробег и светофор ОСАГО', Icon: Gauge },
  { command: '/service', title: 'ТО и документы', detail: 'Журнал обслуживания', Icon: Wrench },
  { command: '/spending', title: 'Расходы', detail: 'Итог месяца с долями категорий', Icon: Wallet },
  { command: '/credit', title: 'Автокредит', detail: 'Прогресс, остаток и платёж', Icon: CreditCard },
  { command: '/link', title: 'Подключить кабинет', detail: 'Код одной кнопкой в чате', Icon: Link2 },
  { command: '/unlink', title: 'Отключить кабинет', detail: 'Отзыв доступа с подтверждением', Icon: Unlink },
  { command: '/help', title: 'Помощь', detail: 'Показать все команды', Icon: MessageCircle },
  { command: '/menu', title: 'Главное меню', detail: 'Живой экран разделов', Icon: Bot },
  { command: '/start', title: 'Приветствие', detail: 'Открыть меню бота', Icon: Bot },
]

export default function TelegramPage() {
  const { backend, mode } = useAuth()
  const { car, loan, transactions, maintenance, loading } = useAppData()
  const [linkState, setLinkState] = useState<'checking' | 'linked' | 'unlinked' | 'error' | 'offline'>(
    'checking',
  )
  const [linkError, setLinkError] = useState('')
  const [notice, setNotice] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [apiHealth, setApiHealth] = useState<TelegramApiHealth | null>(null)
  const [healthState, setHealthState] = useState<'checking' | 'online' | 'offline' | 'unknown'>('checking')
  const [healthError, setHealthError] = useState('')
  const [activeCommand, setActiveCommand] = useState('garage')

  const isDemo = mode === 'demo'

  const refreshHealth = useCallback(async () => {
    if (isDemo || !isTelegramConfigured) {
      setApiHealth(null)
      // Если переменные сборки заполнены неверно, показываем конкретную
      // причину, а не «код 405» из fetch.
      setHealthError(TELEGRAM_CONFIG_MESSAGE)
      setHealthState('unknown')
      return
    }
    setHealthState('checking')
    setHealthError('')
    try {
      const health = await checkTelegramHealth()
      setApiHealth(health)
      setHealthState(health.ok ? 'online' : 'offline')
    } catch (error) {
      setApiHealth(null)
      setHealthState('offline')
      setHealthError(error instanceof Error ? error.message : 'Не удалось проверить API Telegram')
    }
  }, [isDemo])

  useEffect(() => {
    void refreshHealth()
  }, [refreshHealth])

  const currentMonthSpend = useMemo(() => {
    const monthStart = startOfMonth()
    return transactions
      .filter((item) => new Date(item.date) >= monthStart)
      .reduce((sum, item) => sum + item.amount, 0)
  }, [transactions])

  const insuranceDays = car?.insurance_until ? daysUntil(car.insurance_until) : null
  const serviceLabel = car?.insurance_until
    ? `ОСАГО до ${fmtDate(car.insurance_until)}`
    : maintenance.length
      ? `${maintenance.length} записей ТО`
      : 'ОСАГО не указан'
  const serviceState = insuranceDays === null
    ? 'ok'
    : insuranceDays < 0
      ? 'overdue'
      : insuranceDays <= 14
        ? 'soon'
        : 'ok'

  const paidPayments = transactions.filter((item) => item.category === 'loan').length
  const loanRemaining = loan
    ? remainingBalance(loan.total_amount, loan.interest_rate, loan.term_months, paidPayments, loan.monthly_payment)
    : null

  useEffect(() => {
    let active = true
    setNotice('')
    setLinkError('')

    if (isDemo || !isTelegramConfigured) {
      setLinkState('offline')
      return () => {
        active = false
      }
    }

    setLinkState('checking')
    void (async () => {
      try {
        const token = await backend.auth.getAccessToken()
        if (!token) throw new Error('Сессия сайта завершилась. Войдите в аккаунт повторно.')
        const status = await requestTelegram<TelegramLinkStatus>(
          '/api/telegram/link/status',
          token,
        )
        if (active) setLinkState(status.linked ? 'linked' : 'unlinked')
      } catch (error) {
        if (!active) return
        setLinkState('error')
        setLinkError(error instanceof Error ? error.message : 'Не удалось проверить связь с Telegram')
      }
    })()

    return () => {
      active = false
    }
  }, [backend, isDemo])

  const connectAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    setLinkError('')
    try {
      const token = await backend.auth.getAccessToken()
      if (!token) throw new Error('Сессия сайта завершилась. Войдите в аккаунт повторно.')
      await requestTelegram('/api/telegram/link/confirm', token, {
        method: 'POST',
        body: { code: code.replace(/[^a-z0-9]/gi, '') },
      })
      setLinkState('linked')
      setCode('')
      setNotice('Готово. Теперь бот покажет данные вашего гаража и кредитного кабинета.')
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : 'Не удалось подключить Telegram')
    } finally {
      setBusy(false)
    }
  }

  const disconnectAccount = async () => {
    if (!window.confirm('Отключить Telegram от этого аккаунта?')) return
    setBusy(true)
    setNotice('')
    setLinkError('')
    try {
      const token = await backend.auth.getAccessToken()
      if (!token) throw new Error('Сессия сайта завершилась. Войдите в аккаунт повторно.')
      await requestTelegram('/api/telegram/link', token, { method: 'DELETE' })
      setLinkState('unlinked')
      setNotice('Связь удалена. Бот больше не видит данные этого кабинета.')
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : 'Не удалось отключить Telegram')
    } finally {
      setBusy(false)
    }
  }

  const cleanedCode = code.replace(/[^a-z0-9]/gi, '')
  const statusLabel =
    linkState === 'linked'
      ? 'ПОДКЛЮЧЕНО'
      : linkState === 'checking'
        ? 'ПРОВЕРЯЕМ'
        : linkState === 'error'
          ? 'НЕТ СВЯЗИ'
          : isDemo
            ? 'LOCAL · PREVIEW'
            : !isTelegramConfigured
              ? 'SETUP REQUIRED'
              : 'NOT LINKED'

  return (
    <div className="animate-pop-in flex flex-col gap-4">
      <PageHero
        media={{ asset: PAGE_MEDIA.dashboard.asset, caption: 'SIGNATURE · TELEGRAM' }}
        eyebrow="LADA ASSISTANT · DIGITAL GARAGE"
        title="Ваш гараж. Всегда на связи."
        subtitle="Ключевые данные о Granta Sport — в вашем Telegram, без лишних экранов и ручного поиска."
        priority
        action={
          TELEGRAM_BOT_URL ? (
            <a
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[9px] border border-[#E33337] bg-[#E33337] px-3.5 py-2 text-[12.5px] font-bold text-white shadow-[0_8px_24px_rgba(227,51,55,0.2)] transition hover:border-[#C82529] hover:bg-[#C82529]"
            >
              <Send className="h-4 w-4" />
              Открыть бота
              <ArrowUpRight className="h-3.5 w-3.5 opacity-80" />
            </a>
          ) : (
            <Button
              disabled
              title="Задайте VITE_TELEGRAM_BOT_USERNAME и VITE_TELEGRAM_API_URL в настройках сборки"
            >
              <Send className="h-4 w-4" />
              Бот настраивается
            </Button>
          )
        }
        chips={
          <>
            <HeroChip
              icon={<Gauge className="h-3.5 w-3.5 text-[#E33337]" />}
              label="Пробег"
              value={car ? fmtMileage(car.current_mileage) : '—'}
            />
            <HeroChip
              icon={<Wallet className="h-3.5 w-3.5 text-[#E33337]" />}
              label="Расходы за месяц"
              value={fmtMoney(currentMonthSpend)}
            />
            {loan && loanRemaining !== null && (
              <HeroChip
                icon={<CreditCard className="h-3.5 w-3.5 text-[#E33337]" />}
                label="Остаток кредита"
                value={fmtMoney(loanRemaining)}
              />
            )}
            {loan && (
              <HeroChip
                icon={<Clock3 className="h-3.5 w-3.5 text-[#E33337]" />}
                label="Следующий платёж"
                value={fmtDate(nextPaymentDate(loan.start_date))}
              />
            )}
            <span
              className={`inline-flex min-h-[30px] items-center gap-2 rounded-[7px] border px-2.5 py-1 font-display-num text-[10.5px] font-bold tracking-[0.13em] ${
                linkState === 'linked'
                  ? 'border-[#16B374]/40 bg-[#16B374]/10 text-[#16B374]'
                  : linkState === 'error'
                    ? 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF777A]'
                    : 'border-[#363B43] bg-[#23272D] text-[#A9AFB7]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  linkState === 'linked'
                    ? 'bg-[#16B374]'
                    : linkState === 'error'
                      ? 'bg-[#EF4444]'
                      : 'bg-[#A9AFB7]'
                }`}
              />
              {statusLabel}
            </span>
          </>
        }
      />

      <Card className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border ${
            healthState === 'online'
              ? 'border-[#16B374]/30 bg-[#16B374]/10 text-[#16B374]'
              : healthState === 'checking'
                ? 'border-[#363B43] bg-[#23272D] text-[#A9AFB7]'
                : 'border-[#F5A623]/30 bg-[#F5A623]/[0.08] text-[#F5A623]'
          }`}>
            {healthState === 'checking' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <span className="h-2 w-2 rounded-full bg-current" />}
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold text-[#F3F4F4]">
              {healthState === 'online'
                ? 'Telegram API работает'
                : healthState === 'checking'
                  ? 'Проверяем Telegram API…'
                  : healthState === 'unknown' && isDemo
                    ? 'Проверка недоступна в демо-режиме'
                    : healthState === 'unknown' && TELEGRAM_CONFIG_ISSUE
                      ? 'Настройка бота не завершена'
                      : healthState === 'unknown'
                        ? 'Telegram API не настроен'
                        : 'Telegram API недоступен'}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#A9AFB7]">
              {healthError || (healthState === 'online'
                ? apiHealth?.mode === 'webhook'
                  ? `Бот получает обновления через вебхук Telegram${apiHealth.webhook?.pendingUpdates ? ` · в очереди ${apiHealth.webhook.pendingUpdates}` : ''}.`
                  : `Бот ${apiHealth?.botPolling === 'online' ? 'получает обновления' : 'доступен'}${apiHealth?.lastSuccessfulPollAt ? ` · последняя проверка ${fmtDate(apiHealth.lastSuccessfulPollAt)}` : ''}.`
                : healthState === 'offline' && apiHealth?.mode === 'webhook'
                  ? apiHealth?.hint ?? 'Вебхук Telegram не отвечает. Проверьте статус функции telegram-api в Supabase.'
                  : healthState === 'offline' && apiHealth?.botPolling
                    ? `Состояние polling: ${apiHealth.botPolling}. ${apiHealth.configured === false ? 'Проверьте настройки токена и имени бота на сервере.' : 'Сервер отвечает, но обработка обновлений пока не подтверждена.'}`
                    : healthState === 'unknown' && isDemo
                      ? 'Перейдите в облачный аккаунт, чтобы проверить интеграцию.'
                      : healthState === 'unknown'
                        ? 'Задайте публичное имя бота и URL API в переменных сборки.'
                        : 'Проверьте доступность API и повторите проверку.'
              )}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void refreshHealth()}
          disabled={healthState === 'checking' || !isTelegramConfigured || isDemo}
          className="min-h-[36px] shrink-0 px-3 py-1.5 text-[11.5px]"
        >
          <LoaderCircle className={`h-3.5 w-3.5 ${healthState === 'checking' ? 'animate-spin' : ''}`} />
          Проверить снова
        </Button>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(340px,1.08fr)]">
        <Card className="relative overflow-hidden p-0">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#E33337]/[0.07] blur-3xl" />
          <div className="relative border-b border-[#363B43]/80 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display-num text-[10px] font-bold uppercase tracking-[0.2em] text-[#E33337]">
                  Secure account link
                </p>
                <h2 className="mt-1 font-display-num text-[20px] font-bold uppercase tracking-wide text-[#F3F4F4]">
                  Подключение аккаунта
                </h2>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#363B43] bg-[#23272D] text-[#E33337]">
                <Link2 className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 max-w-[560px] text-[12.5px] leading-relaxed text-[#A9AFB7]">
              Одноразовый код связывает ваш Telegram с авторизованным кабинетом. Пароль сайта и данные
              карты бот не запрашивает.
            </p>
          </div>

          <div className="relative p-4 sm:p-5">
            {linkState === 'linked' ? (
              <div className="rounded-[10px] border border-[#16B374]/30 bg-[#16B374]/[0.07] p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#16B374]/15 text-[#16B374]">
                    <Check className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-[#F3F4F4]">Telegram подключён</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[#A9AFB7]">
                      Бот может читать сводки автомобиля, обслуживания, расходов и кредита этого аккаунта.
                      Доступ можно отозвать в любой момент.
                    </p>
                    <Button
                      variant="danger"
                      onClick={() => void disconnectAccount()}
                      disabled={busy}
                      className="mt-3 min-h-[38px] px-3 py-1.5 text-[12px]"
                    >
                      <Unlink className="h-4 w-4" />
                      {busy ? 'Отключаем…' : 'Отключить Telegram'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : isDemo ? (
              <NoticePanel tone="warning" title="Вы сейчас в демо-режиме">
                Демоданные хранятся только в этом браузере. Для безопасной связи с Telegram войдите в
                облачный аккаунт сайта — демо-данные бот не получает.
              </NoticePanel>
            ) : !isTelegramConfigured ? (
              <NoticePanel tone="neutral" title="Интеграция ещё не настроена">
                {TELEGRAM_CONFIG_MESSAGE && (
                  <span className="mb-2 block font-semibold text-[#F3F4F4]">{TELEGRAM_CONFIG_MESSAGE}</span>
                )}
                После запуска бота укажите публичное имя через{' '}
                <code className="rounded bg-[#0E1013] px-1 py-0.5 font-mono text-[11px] text-[#F3F4F4]">
                  VITE_TELEGRAM_BOT_USERNAME
                </code>{' '}
                и адрес API через{' '}
                <code className="rounded bg-[#0E1013] px-1 py-0.5 font-mono text-[11px] text-[#F3F4F4]">
                  VITE_TELEGRAM_API_URL
                </code>
                . Секретный токен бота нужен только серверу.
              </NoticePanel>
            ) : linkState === 'checking' ? (
              <div className="flex min-h-[130px] items-center justify-center gap-3 text-[12.5px] text-[#A9AFB7]">
                <Spinner className="h-5 w-5" />
                Проверяем защищённое подключение…
              </div>
            ) : (
              <>
                <div className="mb-4 grid gap-2 sm:grid-cols-2">
                  <StepCard number="01" title="Откройте бота" detail={`@${TELEGRAM_BOT_USERNAME}`} />
                  <StepCard number="02" title="Запросите код" detail="Отправьте команду /link" />
                </div>
                <form onSubmit={(event) => void connectAccount(event)} className="space-y-3">
                  <Field
                    label="Одноразовый код"
                    placeholder="A4K9P-72QX8"
                    autoComplete="one-time-code"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={11}
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11))
                      setLinkError('')
                    }}
                    hint="Код действует 10 минут и используется только один раз."
                    className="font-mono tracking-[0.16em]"
                  />
                  {linkError && <InlineMessage tone="error">{linkError}</InlineMessage>}
                  {notice && <InlineMessage tone="success">{notice}</InlineMessage>}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="submit" disabled={busy || cleanedCode.length < 10} className="w-full sm:flex-1">
                      <Link2 className="h-4 w-4" />
                      {busy ? 'Проверяем код…' : 'Подключить аккаунт'}
                    </Button>
                    <a
                      href={TELEGRAM_BOT_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border border-[#363B43] bg-[#23272D] px-4 py-2.5 text-[13px] font-semibold text-[#F3F4F4] transition hover:border-[#E33337]/60 hover:bg-[#2B3038]"
                    >
                      <Send className="h-4 w-4 text-[#4FA8DD]" />
                      Перейти в Telegram
                    </a>
                  </div>
                </form>
              </>
            )}

            {notice && (
              <div className="mt-3">
                <InlineMessage tone="success">{notice}</InlineMessage>
              </div>
            )}
          </div>

          <div className="relative flex items-start gap-2.5 border-t border-[#363B43]/70 bg-[#0E1013]/50 px-4 py-3 sm:px-5">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#A9AFB7]" />
            <p className="text-[11px] leading-relaxed text-[#A9AFB7]">
              Привязка подтверждается через сессию Supabase и одноразовый код. Доступ ограничен сводными
              данными аккаунта; отключение удаляет связь на сервере.
            </p>
          </div>
        </Card>

        <TelegramPreview
          carLabel={car ? 'LADA Granta Sport' : 'Автомобиль не добавлен'}
          mileage={car ? fmtMileage(car.current_mileage) : 'добавьте автомобиль на сайте'}
          serviceLabel={serviceLabel}
          serviceState={serviceState}
          monthlySpend={fmtMoney(currentMonthSpend)}
          connected={linkState === 'linked'}
          loanSummary={loanRemaining === null ? 'Кредит не указан' : fmtMoney(loanRemaining)}
          nextPayment={loan ? fmtDate(nextPaymentDate(loan.start_date)) : '—'}
          maintenanceCount={maintenance.length}
          activeCommand={activeCommand}
          onSelectCommand={setActiveCommand}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Card className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-[#363B43]/80 px-4 py-3.5 sm:px-5">
            <div>
              <p className="font-display-num text-[10px] font-bold uppercase tracking-[0.2em] text-[#E33337]">
                Быстрые действия
              </p>
              <h2 className="mt-0.5 font-display-num text-[17px] font-bold uppercase tracking-wide text-[#F3F4F4]">
                Команды бота
              </h2>
            </div>
            <span className="rounded-[6px] border border-[#363B43] bg-[#0E1013] px-2 py-1 font-mono text-[10px] text-[#A9AFB7]">
              {String(COMMANDS.length).padStart(2, '0')} / {String(COMMANDS.length).padStart(2, '0')}
            </span>
          </div>
          <div className="grid gap-px bg-[#363B43]/60 sm:grid-cols-2">
            {COMMANDS.map(({ command, title, detail, Icon }) => (
              <button
                key={command}
                type="button"
                onClick={() => setActiveCommand(command.slice(1))}
                aria-pressed={activeCommand === command.slice(1)}
                className={`flex w-full items-center gap-3 p-3.5 text-left transition sm:p-4 ${activeCommand === command.slice(1) ? 'bg-[#24282E]' : 'bg-[#1A1D22] hover:bg-[#20242A]'}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-[#363B43] bg-[#23272D] text-[#E33337]">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-[11px] font-bold text-[#E33337]">{command}</code>
                    <span className="truncate text-[12.5px] font-semibold text-[#F3F4F4]">{title}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[#A9AFB7]">{detail}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#626A74]" />
              </button>
            ))}
          </div>
        </Card>

        <Card className="relative overflow-hidden p-4 sm:p-5">
          <div className="pointer-events-none absolute -bottom-14 -right-8 h-40 w-40 rounded-full bg-[#E33337]/[0.07] blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#363B43] bg-[#23272D] text-[#E33337]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display-num text-[10px] font-bold uppercase tracking-[0.18em] text-[#E33337]">
                Privacy by design
              </p>
              <h2 className="mt-1 font-display-num text-[17px] font-bold uppercase tracking-wide text-[#F3F4F4]">
                Ваши данные под контролем
              </h2>
            </div>
          </div>
          <ul className="relative mt-4 space-y-2.5 text-[12px] leading-relaxed text-[#A9AFB7]">
            <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16B374]" /> Бот показывает данные только после привязки аккаунта.</li>
            <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16B374]" /> Пароль, VIN и платёжные реквизиты не отправляются в Telegram.</li>
            <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16B374]" /> Доступ можно отозвать кнопкой «Отключить Telegram».</li>
          </ul>
        </Card>
      </section>

      {loading && (
        <p className="sr-only" role="status">Обновляем данные личного кабинета…</p>
      )}
    </div>
  )
}

function NoticePanel({
  tone,
  title,
  children,
}: {
  tone: 'warning' | 'neutral'
  title: string
  children: ReactNode
}) {
  const style = tone === 'warning'
    ? 'border-[#F5A623]/35 bg-[#F5A623]/[0.07]'
    : 'border-[#363B43] bg-[#0E1013]/50'
  const titleStyle = tone === 'warning' ? 'text-[#F5A623]' : 'text-[#F3F4F4]'
  return (
    <div className={`rounded-[10px] border p-4 ${style}`}>
      <p className={`text-[13px] font-bold ${titleStyle}`}>{title}</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-[#A9AFB7]">{children}</p>
    </div>
  )
}

function StepCard({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="rounded-[9px] border border-[#363B43] bg-[#0E1013]/55 p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-bold tracking-wider text-[#E33337]">{number}</span>
        <span className="text-[12px] font-bold text-[#F3F4F4]">{title}</span>
      </div>
      <p className="mt-1 pl-7 font-mono text-[10.5px] text-[#A9AFB7]">{detail}</p>
    </div>
  )
}

function InlineMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success'
  children: ReactNode
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-[8px] border px-3 py-2 text-[11.5px] leading-relaxed ${
        tone === 'error'
          ? 'border-[#EF4444]/35 bg-[#EF4444]/[0.08] text-[#FF9B9E]'
          : 'border-[#16B374]/30 bg-[#16B374]/[0.07] text-[#69D9A7]'
      }`}
    >
      {children}
    </p>
  )
}

function TelegramPreview({
  carLabel,
  mileage,
  serviceLabel,
  serviceState,
  monthlySpend,
  connected,
  loanSummary,
  nextPayment,
  maintenanceCount,
  activeCommand,
  onSelectCommand,
}: {
  carLabel: string
  mileage: string
  serviceLabel: string
  serviceState: 'ok' | 'soon' | 'due' | 'overdue'
  monthlySpend: string
  connected: boolean
  loanSummary: string
  nextPayment: string
  maintenanceCount: number
  activeCommand: string
  onSelectCommand: (command: string) => void
}) {
  const serviceTone = serviceState === 'overdue'
    ? 'text-[#EF4444]'
    : serviceState === 'ok'
      ? 'text-[#16B374]'
      : 'text-[#F5A623]'
  const previewResponse = {
    garage: { title: '🚘 МОЙ ГАРАЖ', detail: `🏁 ${carLabel} · Пробег — ${mileage}`, extra: serviceLabel },
    service: { title: '🧰 ТО И ДОКУМЕНТЫ', detail: serviceLabel, extra: `▸ Записей в журнале: ${maintenanceCount}` },
    spending: { title: '📊 РАСХОДЫ · МЕСЯЦ', detail: `Итого: ${monthlySpend}`, extra: '▰▰▰▰▱▱▱▱ Доли категорий считаются по операциям кабинета' },
    credit: { title: '💳 АВТОКРЕДИТ', detail: `▰▰▰▰▰▰▱▱ Остаток: ${loanSummary}`, extra: `⏳ Ближайший платёж: ${nextPayment}` },
    link: { title: '🔗 КОД ПОДКЛЮЧЕНИЯ', detail: connected ? 'Аккаунт Telegram подключён' : 'Кнопкой в чате или командой /link', extra: connected ? 'Доступ можно отозвать на сайте командой /unlink' : '⏱ Код одноразовый · действует 10 минут' },
    unlink: { title: '⛓ ОТКЛЮЧИТЬ КАБИНЕТ?', detail: 'Бот подтвердит действие вторым тапом', extra: 'На сайте данные останутся — отключается только Telegram' },
    help: { title: 'ℹ️ ПОМОЩЬ · LADA ASSISTANT', detail: '/garage · /service · /spending · /credit', extra: '/menu · /link · /unlink · /help · /start' },
    menu: { title: '🏁 LADA ASSISTANT', detail: 'Живой экран: кнопки переключают разделы на месте', extra: '🚘 Гараж · 🧰 ТО · 📊 Расходы · 💳 Кредит' },
    start: { title: '🏁 LADA ASSISTANT', detail: 'Живой экран: кнопки переключают разделы на месте', extra: '🚘 Гараж · 🧰 ТО · 📊 Расходы · 💳 Кредит' },
  }[activeCommand] ?? { title: '🚘 МОЙ ГАРАЖ', detail: `🏁 ${carLabel} · Пробег — ${mileage}`, extra: serviceLabel }
  const selectedCommand = COMMANDS.find((item) => item.command === `/${activeCommand}`)
  return (
    <Card className="relative overflow-hidden p-0">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(227,51,55,0.12),transparent_42%)]" />
      <div className="relative flex items-center justify-between border-b border-[#363B43]/80 px-4 py-3.5 sm:px-5">
        <div>
          <p className="font-display-num text-[10px] font-bold uppercase tracking-[0.2em] text-[#E33337]">
            Interactive preview
          </p>
          <h2 className="mt-0.5 font-display-num text-[17px] font-bold uppercase tracking-wide text-[#F3F4F4]">
            Так выглядит ваш бот
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#363B43] bg-[#0E1013] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#A9AFB7]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#16B374]" />
          {connected ? 'linked' : 'preview'}
        </span>
      </div>

      <div className="relative overflow-hidden bg-[#101419] p-3 sm:p-5">
        <div className="mx-auto max-w-[360px] overflow-hidden rounded-[22px] border border-[#303842] bg-[#151A20] shadow-[0_22px_65px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3 border-b border-[#29313A] bg-[#1D242C] px-3.5 py-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E33337]/40 bg-[#0E1013]">
              <img
                src="./images/telegram-assistant-avatar.jpg"
                alt=""
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#1D242C] bg-[#16B374]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-[#F3F4F4]">LADA Assistant</p>
              <p className="mt-0.5 text-[10px] text-[#16B374]">бот · цифровой гараж</p>
            </div>
            <MessageCircle className="h-4 w-4 text-[#7E8996]" />
          </div>

          <div className="space-y-2.5 bg-[linear-gradient(165deg,#11171d_0%,#121820_55%,#17181b_100%)] px-3 py-4">
            <p className="mx-auto w-fit rounded-full bg-[#242B33] px-2.5 py-1 text-[9px] font-medium text-[#8F9AA6]">
              СЕГОДНЯ · LADA ASSISTANT
            </p>
            <div className="max-w-[93%] rounded-[13px] rounded-tl-[4px] border border-[#303842] bg-[#222A32] p-3 shadow-sm">
              <p className="text-[11.5px] font-semibold text-[#F3F4F4]">{previewResponse.title}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-[#A9AFB7]">
                {previewResponse.detail}
              </p>
              <div className="mt-2.5 rounded-[9px] border border-[#3A434D] bg-[#191F26] p-2.5">
                <div className="flex items-start gap-2">
                  <ShieldCheck className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${serviceTone}`} />
                  <div className="min-w-0">
                    <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#8995A1]">Ответ бота · {connected ? 'аккаунт связан' : 'режим предпросмотра'}</p>
                    <p className="mt-1 text-[9.5px] font-semibold text-[#F3F4F4]">{previewResponse.extra}</p>
                  </div>
                </div>
              </div>
              <p className="mt-1.5 text-right text-[8px] text-[#788590]">12:48 ✓✓</p>
            </div>

            <div className="ml-auto w-fit rounded-[11px] rounded-tr-[4px] bg-[#3B5266] px-3 py-2 font-mono text-[10px] text-[#F5F7F9]">
              {selectedCommand?.command ?? '/garage'}
            </div>

            <div className="max-w-[87%] rounded-[12px] rounded-tl-[4px] border border-[#303842] bg-[#222A32] p-2.5">
              <div className="flex items-center gap-2 text-[9.5px] font-semibold text-[#F3F4F4]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#16B374]" />
                {connected ? 'Сводка из кабинета' : 'Демонстрация · кабинет не подключён'}
              </div>
              <p className="mt-1.5 text-[9px] leading-relaxed text-[#A9AFB7]">
                В живом боте кнопки обновляют это сообщение на месте — чат не засоряется.
                Нажмите команду ниже или в списке рядом.
              </p>
              <p className="mt-1 text-right text-[8px] text-[#788590]">12:48</p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              {COMMANDS.slice(0, 4).map(({ command, title, Icon }) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => onSelectCommand(command.slice(1))}
                  aria-pressed={activeCommand === command.slice(1)}
                  className={`inline-flex min-h-8 items-center justify-center gap-1 rounded-[7px] border px-2 py-2 text-[8.5px] font-semibold transition ${activeCommand === command.slice(1) ? 'border-[#E33337]/60 bg-[#352528] text-white' : 'border-[#3B4651] bg-[#222A32] text-[#D6DDE3] hover:bg-[#2B343E]'}`}
                >
                  <Icon className="h-3 w-3 text-[#E33337]" /> {title}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-[#29313A] bg-[#1D242C] p-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-[#8995A1]">
              <Bot className="h-4 w-4" />
            </span>
            <span className="flex min-h-8 flex-1 items-center rounded-full border border-[#343E49] bg-[#141A20] px-3 text-[9px] text-[#65717E]">
              Напишите команду…
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E33337] text-white">
              <Send className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
