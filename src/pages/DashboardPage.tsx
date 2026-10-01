import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext'
import AddTransactionSheet from '../components/AddTransactionSheet'
import Sheet from '../components/Sheet'
import UpcomingEvents from '../components/UpcomingEvents'
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
  LADA_DUO_ASSETS,
  getSavedModel,
  type DuoModel,
} from '../lib/assets'
import { useSettings } from '../lib/settings'
import { useCountUp } from '../lib/useCountUp'
import { buildServicePlan, STATE_META } from '../lib/service'
import { computeFuelStats, monthlyMileage } from '../utils/fuel'
import type { TxCategory } from '../types/domain'

/** Вкладка 1: Главная (Личный кабинет владельца LADA Granta и Vesta) */
export default function DashboardPage() {
  const { car, loan, transactions, maintenance, loading, saveCar } = useAppData()
  const [settings] = useSettings()
  const [txSheet, setTxSheet] = useState<TxCategory | null>(null)
  const [mileageOpen, setMileageOpen] = useState(false)
  const [newMileage, setNewMileage] = useState('')
  const [mileageError, setMileageError] = useState('')
  const [model, setModel] = useState<DuoModel>(() => getSavedModel())
  const [photoMode, setPhotoMode] = useState<'garage' | 'road'>('garage')

  useEffect(() => {
    const onModel = () => setModel(getSavedModel())
    window.addEventListener('lgc-model-change', onModel)
    return () => window.removeEventListener('lgc-model-change', onModel)
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
      loan.monthly_payment,
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

  /* Живые цифры: одометр и траты месяца «докручиваются» при появлении */
  const shownMileage = useCountUp(car?.current_mileage ?? 0)
  const shownMonthSpent = useCountUp(monthSpent)

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

  const garageAsset =
    model === 'vesta' ? LADA_DUO_ASSETS.garageVesta : LADA_DUO_ASSETS.garageGranta
  const sceneAsset = photoMode === 'garage' ? garageAsset : LADA_DUO_ASSETS.road
  const sceneCaption = photoMode === 'garage' ? 'Гараж · домашний бокс' : 'Трасса · утро'

  return (
    <div className="animate-pop-in flex flex-col gap-5">
      {/* 1. ГЛАВНЫЙ ВИЗУАЛЬНЫЙ АКЦЕНТ: АВТОМОБИЛЬ, НОМЕР И ОДОМЕТР */}
      <section
        aria-label="Мой автомобиль"
        className="animate-rise overflow-hidden rounded-[12px] border border-[#363B43] bg-[#1A1D22]"
        style={{ animationDelay: '40ms' }}
      >
        {/* Верхняя панель статуса авто */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#363B43]/80 bg-[#23272D]/70 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#E33337]" aria-hidden="true" />
            <span className="font-display-num text-[13px] font-bold uppercase tracking-wider text-[#F3F4F4]">
              Моя LADA · Granta &amp; Vesta
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

          {/* Переключатель сцены: домашний гараж (ваша модель в фокусе) или трасса */}
          <div className="flex items-center gap-1 rounded-[8px] border border-[#363B43] bg-[#0E1013] p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setPhotoMode('garage')}
              className={`rounded-[6px] px-2.5 py-1 transition-colors ${
                photoMode === 'garage'
                  ? 'bg-[#23272D] text-[#F3F4F4]'
                  : 'text-[#A9AFB7] hover:text-[#F3F4F4]'
              }`}
            >
              Гараж
            </button>
            <button
              type="button"
              onClick={() => setPhotoMode('road')}
              className={`rounded-[6px] px-2.5 py-1 transition-colors ${
                photoMode === 'road'
                  ? 'bg-[#23272D] text-[#F3F4F4]'
                  : 'text-[#A9AFB7] hover:text-[#F3F4F4]'
              }`}
            >
              На трассе
            </button>
          </div>
        </div>

        {/* Полноформатная сцена дуэта на всю ширину карточки: обе машины целиком,
            без белых полей и «игрушечного» подиума; кроссфейд при смене сцены/модели */}
        <div className="relative h-56 w-full overflow-hidden bg-[#0E1013] sm:h-80">
          <div key={`${photoMode}-${model}`} className="animate-car-in h-full w-full">
            <img
              src={sceneAsset.src}
              data-webp-src={sceneAsset.webp}
              alt={sceneAsset.alt}
              fetchPriority="high"
              decoding="async"
              className="animate-kenburns h-full w-full object-cover object-center"
            />
          </div>
          {/* Бегущий блик — фирменный штрих спортивной линейки */}
          <div
            aria-hidden="true"
            className="animate-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent"
          />
          {/* Мягкое затемнение снизу, чтобы сцена вливалась в карточку */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0E1013]/85 via-transparent to-[#0E1013]/25"
            aria-hidden="true"
          />
          <span className="absolute right-3 top-3 rounded-[6px] border border-[#363B43] bg-[#0E1013]/80 px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[#A9AFB7] backdrop-blur-sm">
            {sceneCaption}
          </span>
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
                {fmtMileage(Math.round(shownMileage))}
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
      <section
        aria-label="Сервис и контроль"
        className="animate-rise grid grid-cols-1 gap-2.5 sm:grid-cols-3"
        style={{ animationDelay: '130ms' }}
      >
        <Link to="/service" className="group hover-lift rounded-[10px]">
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
                  className="animate-bar h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(3, nextService.progress * 100))}%`,
                    backgroundColor: STATE_META[nextService.state].color,
                  }}
                />
              </div>
            )}
          </Card>
        </Link>

        <Link to="/expenses" className="group hover-lift rounded-[10px]">
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


      {/* Календарь владельца: платежи и документы, у которых скоро срок */}
      <div className="animate-rise" style={{ animationDelay: '220ms' }}>
        <UpcomingEvents />
      </div>

      {/* 3. БЫСТРЫЕ ДЕЙСТВИЯ РАСХОДОВ (чёткая инструментальная панель без разноцветных кругов) */}
      <section
        aria-label="Быстрое добавление расхода"
        className="animate-rise"
        style={{ animationDelay: '310ms' }}
      >
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
      <div
        className="animate-rise grid grid-cols-1 gap-4 md:grid-cols-2"
        style={{ animationDelay: '400ms' }}
      >
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
            <Link to="/credit" className="group hover-lift flex-1 rounded-[10px]">
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
                      className="animate-bar h-full rounded-full bg-[#E33337]"
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
                    {fmtMoney(shownMonthSpent)}
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
      <div className="relative aspect-[16/9] max-h-64 w-full overflow-hidden bg-[#0E1013]">
        <img
          src={LADA_DUO_ASSETS.garageGranta.src}
          data-webp-src={LADA_DUO_ASSETS.garageGranta.webp}
          alt={LADA_DUO_ASSETS.garageGranta.alt}
          className="animate-car-in h-full w-full object-cover object-center"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1A1D22]/80 via-transparent to-transparent"
          aria-hidden="true"
        />
      </div>
      <div className="border-t border-[#363B43] p-5">
        <div className="flex items-center gap-2">
          <CarIcon className="h-5 w-5 text-[#E33337]" />
          <h2 className="font-display-num text-[20px] font-bold uppercase tracking-wide text-[#F3F4F4]">
            Добавьте вашу LADA Granta или Vesta
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
