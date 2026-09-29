import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext'
import AddTransactionSheet from '../components/AddTransactionSheet'
import Sheet from '../components/Sheet'
import {
  Button,
  Card,
  EmptyState,
  Field,
  LicensePlate,
  SectionTitle,
  Spinner,
} from '../components/ui'
import {
  CalendarIcon,
  CardIcon,
  CarIcon,
  ChevronRightIcon,
  DotsIcon,
  FuelIcon,
  GaugeIcon,
  PlusIcon,
  ShieldIcon,
  TrendIcon,
  TyreIcon,
  WrenchIcon,
} from '../components/icons'
import { daysUntil, nextPaymentDate, startOfMonth } from '../utils/date'
import {
  fmtDate,
  fmtMileage,
  fmtMoney,
  parseLocaleNumber,
} from '../utils/format'
import { remainingBalance } from '../utils/loan'
import { CATEGORY_META } from '../lib/categories'
import {
  GRANTA_ASSETS,
  getSavedFinish,
  type GrantaFinish,
} from '../lib/assets'
import { useSettings } from '../lib/settings'
import { buildServicePlan, STATE_META } from '../lib/service'
import { computeFuelStats, monthlyMileage } from '../utils/fuel'
import type { TxCategory } from '../types/domain'

/** Вкладка 1: Главная (Личный кабинет владельца LADA Granta Sport) */
export default function DashboardPage() {
  const { car, loan, transactions, maintenance, loading, saveCar } = useAppData()
  const [settings] = useSettings()
  const [txSheet, setTxSheet] = useState<TxCategory | null>(null)
  const [mileageOpen, setMileageOpen] = useState(false)
  const [newMileage, setNewMileage] = useState('')
  const [mileageError, setMileageError] = useState('')
  const [finish, setFinish] = useState<GrantaFinish>(() => getSavedFinish())
  const [photoMode, setPhotoMode] = useState<'studio' | 'bridge'>('studio')

  useEffect(() => {
    const onFinish = () => setFinish(getSavedFinish())
    window.addEventListener('lgc-finish-change', onFinish)
    return () => window.removeEventListener('lgc-finish-change', onFinish)
  }, [])

  const monthSpent = useMemo(() => {
    const start = startOfMonth()
    return transactions
      .filter((t) => new Date(t.date) >= start)
      .reduce((sum, t) => sum + t.amount, 0)
  }, [transactions])

  const monthByCategory = useMemo(() => {
    const start = startOfMonth()
    const acc = new Map<TxCategory, number>()
    for (const t of transactions) {
      if (new Date(t.date) >= start) {
        acc.set(t.category, (acc.get(t.category) ?? 0) + t.amount)
      }
    }
    return [...acc.entries()].sort((a, b) => b[1] - a[1])
  }, [transactions])

  const loanStats = useMemo(() => {
    if (!loan) return null
    const paidCount = transactions.filter((t) => t.category === 'loan').length
    const remaining = remainingBalance(
      loan.total_amount,
      loan.interest_rate,
      loan.term_months,
      paidCount,
    )
    const nextDate = nextPaymentDate(loan.start_date)
    const progress =
      loan.total_amount > 0 ? (loan.total_amount - remaining) / loan.total_amount : 0
    return { paidCount, remaining, nextDate, progress }
  }, [loan, transactions])

  /* Ближайшая регламентная работа — тот же расчёт, что и на вкладке «ТО» */
  const nextService = useMemo(() => {
    if (!car) return null
    const plan = buildServicePlan({
      mileage: car.current_mileage,
      mode: settings.planMode,
      engine: settings.engine,
      maintenance,
      purchaseDate: settings.purchaseDate,
    })
    return plan.find((s) => s.state !== 'ok') ?? plan[0] ?? null
  }, [car, maintenance, settings.engine, settings.planMode, settings.purchaseDate])

  /* Топливная аналитика: расход и стоимость километра по чекам заправок */
  const fuel = useMemo(
    () => computeFuelStats(transactions, settings.fuelPrice, settings.tankLiters),
    [transactions, settings.fuelPrice, settings.tankLiters],
  )
  const kmPerMonth = useMemo(() => monthlyMileage(transactions), [transactions])

  const insuranceAlert = useMemo(() => {
    if (!car?.insurance_until) return null
    const d = daysUntil(car.insurance_until)
    if (d < 0) return { tone: 'danger' as const, text: 'ОСАГО истёк' }
    if (d <= 14) return { tone: 'warn' as const, text: `ОСАГО: ${d} дн.` }
    return null
  }, [car])

  const handleMileageSave = async () => {
    const value = Math.round(parseLocaleNumber(newMileage))
    if (!Number.isFinite(value) || value < 0) {
      setMileageError('Введите корректный пробег')
      return
    }
    if (car && value < car.current_mileage) {
      setMileageError(
        `Пробег не может быть меньше текущего (${fmtMileage(car.current_mileage)})`,
      )
      return
    }
    await saveCar({ current_mileage: value })
    setMileageOpen(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (!car) {
    return <OnboardingCar />
  }

  const quickActions: Array<{
    category: TxCategory
    label: string
    sub: string
    Icon: typeof FuelIcon
  }> = [
    { category: 'fuel', label: 'Топливо', sub: 'Заправка + пробег', Icon: FuelIcon },
    { category: 'loan', label: 'Кредит', sub: 'Ежемесячный взнос', Icon: CardIcon },
    { category: 'maintenance', label: 'ТО и сервис', sub: 'Запчасти и работы', Icon: WrenchIcon },
    { category: 'other', label: 'Прочее', sub: 'Мойка, парковка', Icon: DotsIcon },
  ]

  const studioAsset = finish === 'white' ? GRANTA_ASSETS.white : GRANTA_ASSETS.black

  return (
    <div className="animate-pop-in flex flex-col gap-5">
      {/* 1. ГЛАВНЫЙ ВИЗУАЛЬНЫЙ АКЦЕНТ: АВТОМОБИЛЬ, НОМЕР И ОДОМЕТР */}
      <section aria-label="Мой автомобиль" className="overflow-hidden rounded-[12px] border border-[#363B43] bg-[#1A1D22]">
        {/* Верхняя панель статуса авто */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#363B43]/80 bg-[#23272D]/70 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#E33337]" aria-hidden="true" />
            <span className="font-display-num text-[13px] font-bold uppercase tracking-wider text-[#F3F4F4]">
              Моя LADA Granta Sport
            </span>
            {insuranceAlert && (
              <Link
                to="/garage"
                className={`inline-flex items-center gap-1 rounded-[6px] border px-2 py-0.5 text-[11px] font-bold ${
                  insuranceAlert.tone === 'danger'
                    ? 'border-[#EF4444]/50 bg-[#EF4444]/15 text-[#EF4444]'
                    : 'border-[#F5A623]/50 bg-[#F5A623]/15 text-[#F5A623]'
                }`}
              >
                <ShieldIcon className="h-3.5 w-3.5" />
                {insuranceAlert.text}
              </Link>
            )}
          </div>

          {/* Переключатель ракурса: Студия (черная/белая) или Мост (Hero) */}
          <div className="flex items-center gap-1 rounded-[8px] border border-[#363B43] bg-[#0E1013] p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setPhotoMode('studio')}
              className={`rounded-[6px] px-2.5 py-1 transition-colors ${
                photoMode === 'studio'
                  ? 'bg-[#23272D] text-[#F3F4F4]'
                  : 'text-[#A9AFB7] hover:text-[#F3F4F4]'
              }`}
            >
              Гараж
            </button>
            <button
              type="button"
              onClick={() => setPhotoMode('bridge')}
              className={`rounded-[6px] px-2.5 py-1 transition-colors ${
                photoMode === 'bridge'
                  ? 'bg-[#23272D] text-[#F3F4F4]'
                  : 'text-[#A9AFB7] hover:text-[#F3F4F4]'
              }`}
            >
              На трассе
            </button>
          </div>
        </div>

        {/* Визуальная сцена автомобиля (контрастный графитовый подиум, без обрезки бампера и колёс) */}
        <div className="relative overflow-hidden bg-gradient-to-b from-[#23272D] via-[#1A1D22] to-[#0E1013]">
          {photoMode === 'studio' ? (
            <div className="relative mx-auto flex h-48 w-full max-w-[640px] items-center justify-center px-4 py-2 sm:h-56">
              {/* Мягкий технический радиальный контраст под чёрную/белую машину */}
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(54,59,67,0.45)_0%,rgba(14,16,19,0)_70%)]"
                aria-hidden="true"
              />
              <img
                src={studioAsset.src}
                data-webp-src={studioAsset.webp}
                alt={studioAsset.alt}
                fetchPriority="high"
                decoding="async"
                className="relative z-10 max-h-full w-full object-contain object-center"
              />
            </div>
          ) : (
            <div className="relative aspect-[16/9] w-full max-h-64 overflow-hidden bg-[#0E1013]">
              <img
                src={GRANTA_ASSETS.road.src}
                data-webp-src={GRANTA_ASSETS.road.webp}
                alt={GRANTA_ASSETS.road.alt}
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover object-center"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1A1D22] via-[#0E1013]/25 to-transparent"
                aria-hidden="true"
              />
            </div>
          )}
        </div>

        {/* Нижняя телеметрия автомобиля: госномер, одометр и кнопка обновления */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#363B43]/80 bg-[#1A1D22] p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
                Госномер
              </p>
              <LicensePlate plate={car.plate_number} />
            </div>

            <div className="h-9 w-px bg-[#363B43] hidden xs:block" aria-hidden="true" />

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
                Показания одометра
              </p>
              <p className="font-display-num text-[28px] font-bold leading-tight text-[#F3F4F4]">
                {fmtMileage(car.current_mileage)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              className="flex-1 sm:flex-initial"
              onClick={() => {
                setNewMileage(String(car.current_mileage))
                setMileageError('')
                setMileageOpen(true)
              }}
            >
              <GaugeIcon className="h-4 w-4 text-[#E33337]" />
              Обновить пробег
            </Button>
            <Link
              to="/garage"
              aria-label="Перейти в гараж"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#363B43] bg-[#23272D] text-[#A9AFB7] transition-colors hover:border-[#E33337] hover:text-[#F3F4F4]"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 2. КОНТРОЛЬ СОСТОЯНИЯ: ближайшее ТО, расход топлива, напоминания */}
      <section aria-label="Сервис и контроль" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Link to="/service" className="group">
          <Card className="flex h-full flex-col justify-between border-[#363B43] transition-colors group-hover:border-[#E33337]/70">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
                  Ближайшее ТО
                </p>
                {nextService ? (
                  <>
                    <p className="mt-1 truncate text-[14px] font-bold text-[#F3F4F4]">
                      {nextService.item.title}
                    </p>
                    <p
                      className="mt-0.5 text-[12px] font-semibold"
                      style={{ color: STATE_META[nextService.state].color }}
                    >
                      {nextService.remainingKm === null
                        ? STATE_META[nextService.state].label
                        : nextService.remainingKm >= 0
                          ? `через ${fmtMileage(nextService.remainingKm)}`
                          : `перепробег ${fmtMileage(Math.abs(nextService.remainingKm))}`}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-[13px] text-[#A9AFB7]">План обслуживания готов</p>
                )}
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[#363B43] bg-[#23272D] text-[#E33337]">
                <WrenchIcon className="h-4 w-4" />
              </span>
            </div>
            {nextService && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#0E1013]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(3, nextService.progress * 100))}%`,
                    backgroundColor: STATE_META[nextService.state].color,
                  }}
                />
              </div>
            )}
          </Card>
        </Link>

        <Link to="/expenses" className="group">
          <Card className="flex h-full flex-col justify-between border-[#363B43] transition-colors group-hover:border-[#E33337]/70">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
                  Средний расход
                </p>
                <p className="font-display-num mt-1 text-[24px] font-bold leading-none text-[#F3F4F4]">
                  {fuel.avgPer100 ? `${fuel.avgPer100.toFixed(1).replace('.', ',')} л` : '—'}
                  {fuel.avgPer100 !== null && (
                    <span className="ml-1 text-[12px] font-semibold text-[#A9AFB7]">/100 км</span>
                  )}
                </p>
                <p className="mt-1 text-[11.5px] text-[#A9AFB7]">
                  {fuel.rubPerKm
                    ? `${fuel.rubPerKm.toFixed(1).replace('.', ',')} ₽/км топливо`
                    : 'Указывайте пробег при заправке — расход посчитается сам'}
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[#363B43] bg-[#23272D] text-[#F5A623]">
                <FuelIcon className="h-4 w-4" />
              </span>
            </div>
            {fuel.rangePerTank && (
              <p className="mt-3 border-t border-[#363B43]/70 pt-2 text-[11.5px] text-[#A9AFB7]">
                Бак {settings.tankLiters} л ≈ {fmtMileage(Math.round(fuel.rangePerTank))} хода
              </p>
            )}
          </Card>
        </Link>

        <Card className="flex h-full flex-col justify-between border-[#363B43]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
                Пробег в месяц
              </p>
              <p className="font-display-num mt-1 text-[24px] font-bold leading-none text-[#F3F4F4]">
                {kmPerMonth ? fmtMileage(Math.round(kmPerMonth)) : '—'}
              </p>
              <p className="mt-1 text-[11.5px] text-[#A9AFB7]">
                {settings.tyreSeason === 'winter' ? 'Зимняя резина' : 'Летняя резина'}
                {car.insurance_until ? ` · ОСАГО до ${fmtDate(car.insurance_until)}` : ''}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[#363B43] bg-[#23272D] text-[#38BDF8]">
              <TrendIcon className="h-4 w-4" />
            </span>
          </div>
          <Link
            to="/service"
            className="mt-3 inline-flex items-center gap-1.5 border-t border-[#363B43]/70 pt-2 text-[11.5px] font-semibold text-[#E33337] hover:underline"
          >
            <TyreIcon className="h-3.5 w-3.5" />
            Сезон, шины и напоминания
          </Link>
        </Card>
      </section>

      {/* 3. БЫСТРЫЕ ДЕЙСТВИЯ РАСХОДОВ (чёткая инструментальная панель без разноцветных кругов) */}
      <section aria-label="Быстрое добавление расхода">
        <SectionTitle
          action={
            <button
              type="button"
              onClick={() => setTxSheet('other')}
              className="inline-flex min-h-[36px] items-center gap-1 text-[12.5px] font-semibold text-[#E33337] hover:underline"
            >
              <PlusIcon className="h-4 w-4" />
              Все категории
            </button>
          }
        >
          Записать расход
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {quickActions.map(({ category, label, sub, Icon }) => {
            const meta = CATEGORY_META[category]
            return (
              <button
                key={category}
                type="button"
                onClick={() => setTxSheet(category)}
                className="group relative flex min-h-[68px] flex-col justify-between overflow-hidden rounded-[10px] border border-[#363B43] bg-[#1A1D22] p-3.5 text-left transition-all duration-160 hover:border-[#E33337]/70 hover:bg-[#23272D] active:translate-y-[1px]"
              >
                <span
                  className="absolute inset-x-0 top-0 h-[2px]"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden="true"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-bold text-[#F3F4F4]">{label}</span>
                  <Icon className="h-5 w-5 text-[#A9AFB7] transition-colors group-hover:text-[#F3F4F4]" />
                </div>
                <span className="mt-1.5 text-[11px] font-medium text-[#A9AFB7]">{sub}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* 4. КЛЮЧЕВЫЕ СЦЕНАРИИ: КРЕДИТ И СВОДКА ТРАТ МЕСЯЦА */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Следующий платёж по автокредиту */}
        <section aria-label="Автокредит" className="flex flex-col">
          <SectionTitle
            action={
              <Link
                to="/credit"
                className="inline-flex min-h-[36px] items-center gap-1 text-[12.5px] font-semibold text-[#E33337] hover:underline"
              >
                График и ПДН
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            }
          >
            Следующий платёж
          </SectionTitle>

          {loan && loanStats ? (
            <Link to="/credit" className="group flex-1">
              <Card className="relative flex h-full flex-col justify-between overflow-hidden border-[#363B43] bg-gradient-to-br from-[#23272D] to-[#1A1D22] transition-colors group-hover:border-[#E33337]/70">
                <span
                  className="absolute inset-y-0 left-0 w-1 bg-[#E33337]"
                  aria-hidden="true"
                />
                <div className="flex items-start justify-between gap-3 pl-2">
                  <div>
                    <p className="text-[11.5px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
                      Ежемесячный платёж по кредиту
                    </p>
                    <p className="font-display-num mt-1 text-[30px] font-bold leading-none text-[#F3F4F4]">
                      {fmtMoney(loan.monthly_payment)}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-[6px] border border-[#363B43] bg-[#0E1013]/70 px-2.5 py-1 text-[12px] font-semibold text-[#F3F4F4]">
                      <CalendarIcon className="h-3.5 w-3.5 text-[#E33337]" />
                      {fmtDate(loanStats.nextDate)}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#363B43] bg-[#0E1013]/70 text-[#E33337]">
                    <CardIcon className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-4 border-t border-[#363B43]/70 pt-3 pl-2">
                  <div className="flex items-center justify-between text-[11.5px] text-[#A9AFB7]">
                    <span>Остаток долга: <strong className="text-[#F3F4F4]">{fmtMoney(loanStats.remaining)}</strong></span>
                    <span className="font-mono font-bold text-[#F3F4F4]">
                      {loanStats.paidCount}/{loan.term_months} мес.
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#0E1013]">
                    <div
                      className="h-full rounded-full bg-[#E33337]"
                      style={{
                        width: `${Math.min(100, Math.max(3, loanStats.progress * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </Card>
            </Link>
          ) : (
            <EmptyState
              icon={<CardIcon className="h-5 w-5" />}
              title="Кредит не подключён"
              text="Добавьте параметры автокредита, чтобы контролировать дату платежа и остаток долга"
              action={
                <Link to="/credit">
                  <Button variant="secondary">Настроить кредит</Button>
                </Link>
              }
            />
          )}
        </section>

        {/* Сводка трат за месяц */}
        <section aria-label="Расходы за месяц" className="flex flex-col">
          <SectionTitle
            action={
              <Link
                to="/expenses"
                className="inline-flex min-h-[36px] items-center gap-1 text-[12.5px] font-semibold text-[#E33337] hover:underline"
              >
                Вся аналитика
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            }
          >
            Расходы в этом месяце
          </SectionTitle>

          <Card className="flex flex-1 flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11.5px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
                    Потрачено с начала месяца
                  </p>
                  <p className="font-display-num mt-1 text-[30px] font-bold leading-none text-[#F3F4F4]">
                    {fmtMoney(monthSpent)}
                  </p>
                </div>
                <Link to="/expenses">
                  <Button variant="secondary" className="min-h-[38px] px-3 py-1.5 text-[12px]">
                    Детали
                  </Button>
                </Link>
              </div>

              {/* Сегментированная полоса структуры расходов месяца */}
              {monthSpent > 0 && (
                <div className="mt-3.5 flex h-2 w-full overflow-hidden rounded-full bg-[#0E1013]">
                  {monthByCategory.map(([cat, sum]) => (
                    <div
                      key={cat}
                      style={{
                        width: `${Math.max(4, (sum / monthSpent) * 100)}%`,
                        backgroundColor: CATEGORY_META[cat].color,
                      }}
                      title={`${CATEGORY_META[cat].label}: ${fmtMoney(sum)}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {monthByCategory.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#363B43]/70 pt-3">
                {monthByCategory.map(([c, sum]) => {
                  const meta = CATEGORY_META[c]
                  return (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#363B43] bg-[#23272D] px-2.5 py-1 text-[12px] font-medium text-[#F3F4F4]"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: meta.color }}
                        aria-hidden="true"
                      />
                      <span className="text-[#A9AFB7]">{meta.label}:</span>
                      <strong className="font-semibold text-[#F3F4F4]">{fmtMoney(sum)}</strong>
                    </span>
                  )
                })}
              </div>
            ) : (
              <p className="mt-4 border-t border-[#363B43]/70 pt-3 text-[12.5px] text-[#A9AFB7]">
                В текущем месяце трат ещё не зафиксировано. Используйте кнопки выше для быстрой записи.
              </p>
            )}
          </Card>
        </section>
      </div>

      {/* BottomSheet: обновление пробега */}
      <Sheet open={mileageOpen} onClose={() => setMileageOpen(false)} title="Обновить пробег">
        <div className="flex flex-col gap-3.5">
          <Field
            label="Текущие показания одометра"
            suffix="км"
            inputMode="numeric"
            value={newMileage}
            onChange={(e) => setNewMileage(e.target.value)}
            autoFocus
          />
          {mileageError && (
            <p
              role="alert"
              className="rounded-[8px] border border-[#EF4444]/40 bg-[#EF4444]/12 px-3.5 py-2.5 text-[13px] font-medium text-[#EF4444]"
            >
              {mileageError}
            </p>
          )}
          <Button onClick={() => void handleMileageSave()} className="w-full">
            Сохранить пробег
          </Button>
        </div>
      </Sheet>

      {/* BottomSheet: добавление расхода */}
      <AddTransactionSheet
        open={txSheet !== null}
        onClose={() => setTxSheet(null)}
        initialCategory={txSheet ?? 'other'}
      />
    </div>
  )
}

/** Экран первичной настройки автомобиля для новых реальных аккаунтов (без фиктивных данных) */
function OnboardingCar() {
  const { saveCar } = useAppData()
  const [plate, setPlate] = useState('')
  const [vin, setVin] = useState('')
  const [mileage, setMileage] = useState('')
  const [insurance, setInsurance] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!plate.trim()) {
      setError('Укажите госномер автомобиля')
      return
    }
    const km = mileage.trim() === '' ? 0 : Math.round(parseLocaleNumber(mileage))
    if (!Number.isFinite(km) || km < 0) {
      setError('Введите корректный текущий пробег')
      return
    }
    setSaving(true)
    try {
      await saveCar({
        plate_number: plate.trim().toUpperCase(),
        vin_number: vin.trim().toUpperCase(),
        current_mileage: km,
        initial_mileage: km,
        insurance_until: insurance || null,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить автомобиль')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="relative aspect-[16/9] max-h-52 w-full overflow-hidden bg-[#0E1013]">
        <img
          src={GRANTA_ASSETS.black.src}
          data-webp-src={GRANTA_ASSETS.black.webp}
          alt={GRANTA_ASSETS.black.alt}
          className="h-full w-full object-contain object-center p-3"
        />
      </div>
      <div className="border-t border-[#363B43] p-5">
        <div className="flex items-center gap-2">
          <CarIcon className="h-5 w-5 text-[#E33337]" />
          <h2 className="font-display-num text-[20px] font-bold uppercase tracking-wide text-[#F3F4F4]">
            Добавьте вашу LADA Granta
          </h2>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-[#A9AFB7]">
          Заполните базовые данные автомобиля для расчёта стоимости километра, контроля пробега и напоминаний об ОСАГО.
        </p>

        <div className="mt-4 flex flex-col gap-3.5">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field
              label="Госномер"
              badge="обязательно"
              placeholder="А 123 БВ 77"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
            />
            <Field
              label="Текущий пробег"
              suffix="км"
              inputMode="numeric"
              placeholder="0"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
            />
          </div>
          <Field
            label="VIN-номер (необязательно)"
            placeholder="XTA2190..."
            value={vin}
            onChange={(e) => setVin(e.target.value)}
          />
          <Field
            label="ОСАГО действует до (необязательно)"
            type="date"
            value={insurance}
            onChange={(e) => setInsurance(e.target.value)}
          />
          {error && (
            <p className="rounded-[8px] border border-[#EF4444]/40 bg-[#EF4444]/12 px-3.5 py-2.5 text-[13px] text-[#EF4444]">
              {error}
            </p>
          )}
          <Button onClick={() => void handleCreate()} disabled={saving} className="mt-1 w-full">
            {saving ? 'Сохраняем…' : 'Сохранить автомобиль в гараж'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
