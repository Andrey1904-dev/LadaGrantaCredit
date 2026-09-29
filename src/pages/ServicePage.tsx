import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext'
import PageHero, { HeroChip } from '../components/PageHero'
import Sheet from '../components/Sheet'
import {
  Button,
  Card,
  EmptyState,
  Field,
  InfoTip,
  SectionTitle,
  SegmentedControl,
  Select,
  Spinner,
} from '../components/ui'
import StartChecklist from '../components/service/StartChecklist'
import WarrantyCard from '../components/service/WarrantyCard'
import SpecsTab from '../components/service/SpecsTab'
import {
  CarIcon,
  CheckIcon,
  ChecklistIcon,
  ClockIcon,
  GaugeIcon,
  HistoryIcon,
  InfoIcon,
  LicenseIcon,
  PlusIcon,
  SettingsIcon,
  ShieldIcon,
  SnowIcon,
  SunIcon,
  TaxIcon,
  TrendIcon,
  TyreIcon,
  WrenchIcon,
} from '../components/icons'
import { PAGE_MEDIA } from '../lib/assets'
import { useSettings } from '../lib/settings'
import {
  buildMileagePlan,
  buildServicePlan,
  ENGINES,
  engineInfo,
  GROUP_LABEL,
  KNOWN_ISSUES,
  SEASON_CHECKS,
  STATE_META,
  type ServiceGroup,
  type ServiceStatus,
} from '../lib/service'
import { monthlyMileage } from '../utils/fuel'
import { TAX_REGIONS, taxDueDate, taxRateFor, transportTax } from '../lib/tax'
import { addMonths, daysUntil } from '../utils/date'
import {
  fmtDate,
  fmtMileage,
  fmtMoney,
  fmtNumber,
  parseLocaleNumber,
  plural,
  toDateInputValue,
} from '../utils/format'
import type { EngineId } from '../lib/service'

/**
 * Вкладка «ТО»: регламент обслуживания LADA Granta.
 *
 * План работ подставляется автоматически — из сервисной книжки АВТОВАЗ
 * и практики владельцев с форумов (drive2 / drom / клубы Гранты).
 * Журнал ТО только уточняет даты: приложение само распознаёт, какие работы
 * закрывает каждая запись, и считает остаток ресурса по пробегу и по сроку.
 */
type ServiceTab = 'plan' | 'docs' | 'start' | 'specs'

const SERVICE_TABS: Array<{ value: ServiceTab; label: string }> = [
  { value: 'plan', label: 'Регламент' },
  { value: 'docs', label: 'Документы' },
  { value: 'start', label: 'Обкатка' },
  { value: 'specs', label: 'Справочник' },
]

export default function ServicePage() {
  const { car, maintenance, transactions, loading, addMaintenance, addTransaction, saveCar } =
    useAppData()
  const [settings, updateSettings] = useSettings()
  const [group, setGroup] = useState<ServiceGroup | 'all' | 'attention'>('attention')
  const [doneItem, setDoneItem] = useState<ServiceStatus | null>(null)
  const [tuningOpen, setTuningOpen] = useState(false)
  const [tab, setTab] = useState<ServiceTab>('plan')

  /** Отметить/снять пункт чек-листа «после покупки» */
  const toggleStep = (id: string) =>
    updateSettings({
      startChecklist: settings.startChecklist.includes(id)
        ? settings.startChecklist.filter((x) => x !== id)
        : [...settings.startChecklist, id],
    })

  const kmPerMonth = useMemo(() => monthlyMileage(transactions), [transactions])

  const plan = useMemo(() => {
    if (!car) return []
    return buildServicePlan({
      mileage: car.current_mileage,
      mode: settings.planMode,
      engine: settings.engine,
      maintenance,
      purchaseDate: settings.purchaseDate,
      overrides: {
        // сезонную смену шин и диагностическую карту фиксируем в настройках,
        // а не в журнале ТО — подставляем их как «последнее выполнение»
        tyres: { date: settings.tyreChangedDate, km: settings.tyreChangedKm },
        inspection: settings.inspectionUntil
          ? { date: toDateInputValue(addMonths(new Date(settings.inspectionUntil + 'T00:00:00'), -24)) }
          : undefined,
      },
    })
  }, [
    car,
    maintenance,
    settings.engine,
    settings.planMode,
    settings.purchaseDate,
    settings.tyreChangedDate,
    settings.tyreChangedKm,
    settings.inspectionUntil,
  ])

  const attention = useMemo(() => plan.filter((s) => s.state !== 'ok'), [plan])

  const visible = useMemo(() => {
    if (group === 'attention') return attention.length > 0 ? attention : plan.slice(0, 4)
    if (group === 'all') return plan
    return plan.filter((s) => s.item.group === group)
  }, [group, plan, attention])

  const budget = useMemo(() => {
    const items = attention.map((s) => s.item.cost)
    return {
      min: items.reduce((s, [a]) => s + a, 0),
      max: items.reduce((s, [, b]) => s + b, 0),
      count: items.length,
    }
  }, [attention])

  const mileagePlan = useMemo(() => {
    if (!car) return []
    return buildMileagePlan(settings.engine, settings.planMode, 10).filter(
      (stop) => stop.km > car.current_mileage,
    )
  }, [car, settings.engine, settings.planMode])

  const insuranceDays = car?.insurance_until ? daysUntil(car.insurance_until) : null
  const inspectionDays = settings.inspectionUntil ? daysUntil(settings.inspectionUntil) : null
  const licenseDays = settings.licenseUntil ? daysUntil(settings.licenseUntil) : null

  /* Транспортный налог: мощность мотора × ставка региона, срок уплаты — 1 декабря */
  const tax = useMemo(() => {
    const engine = engineInfo(settings.engine)
    const rate = settings.taxRateOverride ?? taxRateFor(settings.taxRegion, engine.power)
    const due = taxDueDate()
    return {
      amount: transportTax(engine.power, rate),
      rate,
      hp: engine.power,
      region: TAX_REGIONS.find((r) => r.id === settings.taxRegion)?.label ?? 'свой регион',
      custom: settings.taxRateOverride !== null,
      due,
      days: daysUntil(toDateInputValue(due)),
    }
  }, [settings.engine, settings.taxRegion, settings.taxRateOverride])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (!car) {
    return (
      <div className="animate-pop-in flex flex-col gap-4">
        <PageHero
          media={PAGE_MEDIA.service}
          eyebrow="Регламент LADA"
          title="Техническое обслуживание"
          subtitle="Добавьте автомобиль и пробег — план ТО соберётся автоматически по регламенту завода и опыту владельцев."
          compact
        />
        <EmptyState
          icon={<CarIcon className="h-6 w-6" />}
          title="Автомобиль не добавлен"
          text="Перейдите на главную и заполните карточку LADA Granta: из пробега рассчитывается весь план обслуживания"
          action={
            <Link to="/">
              <Button>На главную</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const engine = engineInfo(settings.engine)
  const nearest = attention[0] ?? plan[0]

  return (
    <div className="animate-pop-in flex flex-col gap-4">
      <PageHero
        media={PAGE_MEDIA.service}
        eyebrow="Регламент LADA · опыт владельцев"
        title="Техническое обслуживание"
        subtitle={`План собран автоматически по пробегу ${fmtMileage(car.current_mileage)} и мотору ${engine.short}. Журнал ТО уточняет даты — заполнять таблицы вручную не нужно.`}
        priority
        chips={
          <>
            <HeroChip icon={<GaugeIcon className="h-3.5 w-3.5" />} label="Пробег" value={fmtMileage(car.current_mileage)} />
            <HeroChip
              icon={<WrenchIcon className="h-3.5 w-3.5" />}
              label="Требует внимания"
              value={`${attention.length} из ${plan.length}`}
              tone={attention.length > 0 ? 'warn' : 'success'}
            />
            {kmPerMonth && (
              <HeroChip
                icon={<TrendIcon className="h-3.5 w-3.5" />}
                label="Пробег в месяц"
                value={`≈ ${fmtMileage(Math.round(kmPerMonth))}`}
              />
            )}
          </>
        }
      />

      {/* Вкладки раздела: длинный экран разбит на смысловые части */}
      <SegmentedControl options={SERVICE_TABS} value={tab} onChange={setTab} />

      {tab === 'docs' && (
        <>
        {/* Документы и платежи: ОСАГО, диагностическая карта, права, шины, налог */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <ReminderCard
            icon={<ShieldIcon className="h-4 w-4" />}
            title="ОСАГО"
            value={
              car.insurance_until ? fmtDate(car.insurance_until) : 'Дата не указана'
            }
            days={insuranceDays}
            href="/garage"
          />
          <ReminderCard
            icon={<ChecklistIcon className="h-4 w-4" />}
            title="Диагностическая карта"
            value={settings.inspectionUntil ? fmtDate(settings.inspectionUntil) : 'Не заполнена'}
            days={inspectionDays}
            onClick={() => setTuningOpen(true)}
          />
          <ReminderCard
            icon={<LicenseIcon className="h-4 w-4" />}
            title="Водительские права"
            value={settings.licenseUntil ? fmtDate(settings.licenseUntil) : 'Срок не указан'}
            days={licenseDays}
            onClick={() => setTuningOpen(true)}
          />
          <ReminderCard
            icon={<TyreIcon className="h-4 w-4" />}
            title={settings.tyreSeason === 'winter' ? 'Зимняя резина' : 'Летняя резина'}
            value={
              settings.tyreChangedDate
                ? `с ${fmtDate(settings.tyreChangedDate)}`
                : 'Дата смены не указана'
            }
            days={null}
            onClick={() => setTuningOpen(true)}
          />
        </div>

        {/* Транспортный налог — считается сам по мощности мотора и региону */}
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#23272D] text-[#A9AFB7]">
              <TaxIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
                  Транспортный налог за год
                </p>
                <InfoTip title="Транспортный налог">
                  Налог = мощность двигателя в л. с. × ставка вашего региона × месяцы владения ÷ 12.
                  Мощность берётся из выбранного мотора, ставки — из региональных законов на 2026
                  год (кнопка «Регион и ставка»). За год покупки считают только полные месяцы
                  владения, заплатить нужно до 1 декабря следующего года. Это оценка, а не
                  платёжка: точную сумму ФНС пришлёт в личный кабинет.
                </InfoTip>
              </div>
              <p className="font-display-num mt-0.5 text-[22px] font-bold leading-none text-[#F3F4F4]">
                {fmtMoney(tax.amount)}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#A9AFB7]">
                {tax.hp} л.с. × {fmtNumber(tax.rate)} ₽ · {tax.custom ? 'своя ставка' : tax.region} ·
                заплатить до {fmtDate(toDateInputValue(tax.due))}
                {tax.days > 0 ? ` (${tax.days} дн.)` : ''}
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={() => setTuningOpen(true)} className="shrink-0">
            <SettingsIcon className="h-4 w-4" />
            Регион и ставка
          </Button>
        </Card>

          <WarrantyCard
            purchaseDate={settings.purchaseDate}
            mileage={car.current_mileage}
            startMileage={car.initial_mileage}
            onPurchaseDate={(value) => updateSettings({ purchaseDate: value })}
          />
        </>
      )}

      {tab === 'start' && (
        <StartChecklist
          mileage={Math.max(0, car.current_mileage - car.initial_mileage)}
          done={settings.startChecklist}
          onToggle={toggleStep}
        />
      )}

      {tab === 'specs' && <SpecsTab engine={settings.engine} />}

      {tab === 'plan' && (
        <>
        {/* Ближайшая работа крупным планом */}
        {nearest && (
          <Card className="border-[#E33337]/35 bg-gradient-to-br from-[#23272D] to-[#1A1D22]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#E33337]">
                  Ближайшая работа
                </p>
                <p className="font-display-num mt-1 text-[20px] font-bold uppercase leading-tight text-[#F3F4F4]">
                  {nearest.item.title}
                </p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#A9AFB7]">
                  {describeRemaining(nearest, kmPerMonth)}
                </p>
              </div>
              <Button onClick={() => setDoneItem(nearest)} className="shrink-0">
                <CheckIcon className="h-4 w-4" />
                Отметить выполнено
              </Button>
            </div>
            <ProgressBar status={nearest} />
          </Card>
        )}

        {/* Настройки плана: двигатель и чей регламент показывать */}
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <InfoIcon className="h-4 w-4 text-[#A9AFB7]" />
              <p className="text-[12.5px] font-semibold text-[#F3F4F4]">Откуда берутся интервалы</p>
            </div>
            <div className="flex items-center gap-1 rounded-[8px] border border-[#363B43] bg-[#0E1013] p-0.5 text-[11.5px] font-semibold">
              {(
                [
                  ['factory', 'Регламент завода'],
                  ['forum', 'Опыт форумов'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateSettings({ planMode: value })}
                  className={`min-h-[34px] rounded-[6px] px-2.5 py-1 transition-colors ${
                    settings.planMode === value
                      ? 'bg-[#23272D] text-[#F3F4F4] shadow-[inset_0_-2px_0_0_#E33337]'
                      : 'text-[#A9AFB7] hover:text-[#F3F4F4]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[12px] leading-relaxed text-[#A9AFB7]">
            {settings.planMode === 'factory'
              ? 'Сервисная книжка LADA: ТО каждые 15 000 км или раз в год — масло и фильтры на каждом ТО, свечи и топливный фильтр на 30 000, тормозная жидкость на 45 000 / 3 года, антифриз и ремень ГРМ на 75 000.'
              : 'Практика владельцев Гранты: масло каждые 7 500–10 000 км, ремень ГРМ вместе с помпой на 60 000, тормозная жидкость раз в 2 года, свечи на 20 000. Интервалы сокращены относительно книжки — так чаще всего обслуживают машину в реальной эксплуатации.'}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Двигатель"
              value={settings.engine}
              onChange={(e) => updateSettings({ engine: e.target.value as EngineId })}
            >
              {ENGINES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </Select>
            <Field
              label="Дата покупки (для интервалов «раз в год»)"
              type="date"
              value={settings.purchaseDate ?? ''}
              onChange={(e) => updateSettings({ purchaseDate: e.target.value || null })}
            />
          </div>
          <p className="rounded-[8px] border border-[#363B43] bg-[#0E1013]/60 px-3 py-2 text-[11.5px] leading-relaxed text-[#A9AFB7]">
            <strong className="text-[#F3F4F4]">{engine.short}:</strong> {engine.note}
          </p>
        </Card>

        {/* Бюджет на ближайшие работы */}
        {budget.count > 0 && (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-[#F5A623]/35">
            <div>
              <p className="text-[11.5px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
                Бюджет на работы, которые подошли по сроку
              </p>
              <p className="font-display-num mt-1 text-[24px] font-bold leading-none text-[#F3F4F4]">
                {fmtMoney(budget.min)} — {fmtMoney(budget.max)}
              </p>
            </div>
            <p className="max-w-[320px] text-[11.5px] leading-relaxed text-[#A9AFB7]">
              Оценка по {budget.count} {plural(budget.count, ['работе', 'работам', 'работам'])} со
              средними ценами на запчасти и работу для Гранты. Точная сумма зависит от сервиса
              и производителя деталей.
            </p>
          </Card>
        )}

        {/* Список работ с фильтром по узлам */}
        <SectionTitle
          action={
            <span className="text-[12px] font-semibold text-[#A9AFB7]">
              Работ: {visible.length}
            </span>
          }
          tip={
            <>
              Срочность работы = наибольшее из «пройдено км ÷ интервал» и «прошло месяцев ÷
              интервал»: <strong className="text-[#F3F4F4]">в норме</strong> → скоро (от 80 %) →
              пора (от 95 %) → просрочено. Метка «оценка по регламенту» значит, что записи в
              журнале ТО нет и приложение приняло, что работу делали на предыдущей плановой
              отметке пробега. Отметьте работу кнопкой «Сделал» — и расчёт станет точным.
            </>
          }
        >
          План обслуживания
        </SectionTitle>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Фильтр по узлам">
          <FilterChip active={group === 'attention'} onClick={() => setGroup('attention')}>
            Требует внимания ({attention.length})
          </FilterChip>
          <FilterChip active={group === 'all'} onClick={() => setGroup('all')}>
            Все ({plan.length})
          </FilterChip>
          {(Object.keys(GROUP_LABEL) as ServiceGroup[]).map((g) => {
            const count = plan.filter((s) => s.item.group === g).length
            if (count === 0) return null
            return (
              <FilterChip key={g} active={group === g} onClick={() => setGroup(g)}>
                {GROUP_LABEL[g]} ({count})
              </FilterChip>
            )
          })}
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          {visible.map((status) => (
            <ServiceRow
              key={status.item.id}
              status={status}
              kmPerMonth={kmPerMonth}
              onDone={() => setDoneItem(status)}
            />
          ))}
          {visible.length === 0 && (
            <EmptyState
              icon={<CheckIcon className="h-6 w-6" />}
              title="В этой группе всё в норме"
              text="Работы по этому узлу пока не подошли по пробегу и сроку"
            />
          )}
        </div>

        {/* Карта ТО по пробегу */}
        <SectionTitle
        tip={
          <>
            Карта ТО показывает, какие работы совпадут на круглых отметках пробега (кратно
            15 000 км по регламенту завода). Так удобно планировать бюджет: на одном визите
            в сервис обычно закрывают сразу несколько позиций.
          </>
        }
      >
        Что ждёт на ближайших отметках пробега
      </SectionTitle>
        <div className="flex flex-col gap-2">
          {mileagePlan.slice(0, 4).map((stop) => (
            <details
              key={stop.km}
              className="group overflow-hidden rounded-[10px] border border-[#363B43] bg-[#1A1D22]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-display-num rounded-[6px] border border-[#E33337]/45 bg-[#E33337]/12 px-2 py-0.5 text-[12px] font-bold text-[#F3F4F4]">
                    ТО-{stop.index}
                  </span>
                  <div>
                    <p className="font-display-num text-[16px] font-bold text-[#F3F4F4]">
                      {fmtMileage(stop.km)}
                    </p>
                    <p className="text-[11.5px] text-[#A9AFB7]">
                      через {fmtMileage(stop.km - car.current_mileage)}
                      {kmPerMonth
                        ? ` · ≈ ${forecastMonths(stop.km - car.current_mileage, kmPerMonth)}`
                        : ''}
                    </p>
                  </div>
                </div>
                <span className="text-[11.5px] font-semibold text-[#A9AFB7]">
                  {stop.items.length} {plural(stop.items.length, ['работа', 'работы', 'работ'])}
                </span>
              </summary>
              <div className="flex flex-wrap gap-1.5 border-t border-[#363B43]/70 px-4 py-3">
                {stop.items.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-[6px] border border-[#363B43] bg-[#23272D] px-2.5 py-1 text-[11.5px] text-[#F3F4F4]"
                  >
                    {item.title}
                  </span>
                ))}
              </div>
            </details>
          ))}
        </div>

        {/* Болячки Гранты по пробегу */}
        <SectionTitle
          action={
            <span className="text-[11.5px] text-[#A9AFB7]">по отзывам владельцев</span>
          }
        >
          За чем следят владельцы Гранты
        </SectionTitle>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {KNOWN_ISSUES.map((issue) => {
            const active = car.current_mileage >= issue.fromKm && car.current_mileage <= issue.toKm
            const passed = car.current_mileage > issue.toKm
            return (
              <Card
                key={issue.id}
                className={`flex flex-col gap-2 ${active ? 'border-[#F5A623]/45' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13.5px] font-bold text-[#F3F4F4]">{issue.title}</p>
                  <span
                    className={`shrink-0 rounded-[6px] border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${
                      active
                        ? 'border-[#F5A623]/50 bg-[#F5A623]/12 text-[#F5A623]'
                        : passed
                          ? 'border-[#363B43] bg-[#23272D] text-[#A9AFB7]'
                          : 'border-[#363B43] bg-[#23272D] text-[#A9AFB7]'
                    }`}
                  >
                    {active ? 'зона риска' : passed ? 'пройдено' : 'впереди'}
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed text-[#A9AFB7]">
                  <strong className="text-[#D3D7DC]">Симптом:</strong> {issue.symptom}
                </p>
                <p className="text-[12px] leading-relaxed text-[#A9AFB7]">
                  <strong className="text-[#D3D7DC]">Что делать:</strong> {issue.action}
                </p>
                <p className="mt-auto pt-1 font-mono text-[11px] text-[#A9AFB7]/80">
                  типично {fmtMileage(issue.fromKm)} — {fmtMileage(issue.toKm)}
                </p>
              </Card>
            )
          })}
        </div>

        {/* Сезонные чек-листы */}
        <SectionTitle>Сезонный чек-лист</SectionTitle>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {orderedSeasons().map((check) => (
            <Card key={check.season} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {check.season === 'winter' ? (
                  <SnowIcon className="h-4 w-4 text-[#38BDF8]" />
                ) : (
                  <SunIcon className="h-4 w-4 text-[#F5A623]" />
                )}
                <p className="text-[13.5px] font-bold text-[#F3F4F4]">{check.title}</p>
              </div>
              <ul className="flex flex-col gap-1.5">
                {check.items.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-[12px] leading-relaxed text-[#A9AFB7]">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#E33337]" aria-hidden="true" />
                    {line}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        {/* Журнал */}
        <SectionTitle
          action={
            <Link
              to="/garage"
              className="inline-flex min-h-[36px] items-center gap-1 text-[12.5px] font-semibold text-[#E33337] hover:underline"
            >
              Весь журнал
            </Link>
          }
        >
          Последние работы
        </SectionTitle>
        {maintenance.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon className="h-6 w-6" />}
            title="Журнал пуст"
            text="Пока записей нет — план выше построен по регламенту и текущему пробегу. Отмечайте выполненные работы, и расчёт станет точным"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {maintenance.slice(0, 5).map((m) => (
              <Card key={m.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-bold text-[#F3F4F4]">{fmtDate(m.date)}</p>
                    <span className="rounded-[6px] border border-[#363B43] bg-[#23272D] px-2 py-0.5 font-mono text-[11px] text-[#F3F4F4]">
                      {fmtMileage(m.mileage)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#A9AFB7]">{m.description}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
        </>
      )}

      {/* Sheet: отметка выполненной работы */}
      <MarkDoneSheet
        status={doneItem}
        currentMileage={car.current_mileage}
        onClose={() => setDoneItem(null)}
        onSave={async ({ date, mileage, cost, comment }) => {
          const item = doneItem!.item
          await addMaintenance({
            date,
            mileage,
            description: comment ? `${item.title} — ${comment}` : `${item.title} — выполнено`,
          })
          if (cost > 0) {
            await addTransaction({
              amount: cost,
              category: 'maintenance',
              date: new Date(date + 'T12:00:00').toISOString(),
              mileage_at_transaction: mileage,
            })
          }
          if (mileage > car.current_mileage) {
            await saveCar({ current_mileage: mileage })
          }
          setDoneItem(null)
        }}
      />

      {/* Sheet: сезон шин и диагностическая карта */}
      <Sheet open={tuningOpen} onClose={() => setTuningOpen(false)} title="Шины и документы">
        <div className="flex flex-col gap-3.5">
          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold text-[#A9AFB7]">Сейчас установлена резина</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['summer', 'Летняя'],
                  ['winter', 'Зимняя'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    updateSettings({
                      tyreSeason: value,
                      tyreChangedDate: toDateInputValue(new Date()),
                      tyreChangedKm: car.current_mileage,
                    })
                  }
                  className={`min-h-[44px] rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition-colors ${
                    settings.tyreSeason === value
                      ? 'border-[#E33337] bg-[#23272D] text-[#F3F4F4]'
                      : 'border-[#363B43] bg-[#1A1D22] text-[#A9AFB7]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-[#A9AFB7]">
              Нажатие фиксирует дату и пробег переобувки — так считается ресурс комплекта.
            </p>
          </div>

          <Field
            label="Диагностическая карта действует до"
            type="date"
            value={settings.inspectionUntil ?? ''}
            onChange={(e) => updateSettings({ inspectionUntil: e.target.value || null })}
            hint="Для личных легковых ОСАГО её не требует, но она обязательна при регистрации авто старше 4 лет и смене собственника."
          />

          <Field
            label="Водительское удостоверение действует до"
            type="date"
            value={settings.licenseUntil ?? ''}
            onChange={(e) => updateSettings({ licenseUntil: e.target.value || null })}
            hint="Напомним заранее: замена прав по истечении срока — это госпошлина и медсправка."
          />

          <Select
            label="Регион регистрации (ставка налога)"
            value={settings.taxRegion}
            onChange={(e) => updateSettings({ taxRegion: e.target.value, taxRateOverride: null })}
          >
            {TAX_REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} — {fmtNumber(taxRateFor(r.id, engine.power))} ₽/л.с.
              </option>
            ))}
          </Select>

          <Field
            label="Своя ставка, ₽ за 1 л.с."
            inputMode="decimal"
            value={settings.taxRateOverride === null ? '' : String(settings.taxRateOverride)}
            onChange={(e) => {
              const v = parseLocaleNumber(e.target.value)
              updateSettings({ taxRateOverride: Number.isFinite(v) && v > 0 ? v : null })
            }}
            hint="Заполните, если вашего региона нет в списке — ставку можно посмотреть в сервисе ФНС."
          />

          <Field
            label="Цена литра АИ-95, ₽"
            inputMode="decimal"
            value={String(settings.fuelPrice)}
            onChange={(e) => {
              const v = parseLocaleNumber(e.target.value)
              updateSettings({ fuelPrice: Number.isFinite(v) && v > 0 ? v : 0 })
            }}
            hint="Нужна для оценки расхода л/100 км по чекам заправок."
          />

          <Button onClick={() => setTuningOpen(false)} className="w-full">
            Готово
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Вспомогательные компоненты                                         */
/* ------------------------------------------------------------------ */

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick(): void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[36px] rounded-[8px] border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        active
          ? 'border-[#E33337] bg-[#23272D] text-[#F3F4F4]'
          : 'border-[#363B43] bg-[#1A1D22] text-[#A9AFB7] hover:text-[#F3F4F4]'
      }`}
    >
      {children}
    </button>
  )
}

function ProgressBar({ status }: { status: ServiceStatus }) {
  const meta = STATE_META[status.state]
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#0E1013]">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${Math.min(100, Math.max(3, status.progress * 100))}%`,
          backgroundColor: meta.color,
        }}
      />
    </div>
  )
}

function ServiceRow({
  status,
  kmPerMonth,
  onDone,
}: {
  status: ServiceStatus
  kmPerMonth: number | null
  onDone(): void
}) {
  const [open, setOpen] = useState(false)
  const meta = STATE_META[status.state]

  return (
    <Card
      className={`flex flex-col gap-2 ${
        status.state === 'overdue'
          ? 'border-[#EF4444]/45'
          : status.state === 'due'
            ? 'border-[#F5A623]/45'
            : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13.5px] font-bold text-[#F3F4F4]">{status.item.title}</p>
            <span
              className="rounded-[6px] border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider"
              style={{ borderColor: meta.border, color: meta.color, backgroundColor: meta.bg }}
            >
              {meta.label}
            </span>
            {status.estimated && (
              <span className="rounded-[6px] border border-[#363B43] bg-[#23272D] px-2 py-0.5 text-[10.5px] font-semibold text-[#A9AFB7]">
                оценка по регламенту
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[#A9AFB7]">
            {describeRemaining(status, kmPerMonth)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="min-h-[36px] rounded-[8px] border border-[#363B43] bg-[#23272D] px-2.5 py-1 text-[11.5px] font-semibold text-[#A9AFB7] hover:text-[#F3F4F4]"
          >
            {open ? 'Свернуть' : 'Подробнее'}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[8px] border border-[#E33337]/50 bg-[#E33337]/12 px-2.5 py-1 text-[11.5px] font-bold text-[#F3F4F4] hover:bg-[#E33337]/20"
          >
            <CheckIcon className="h-3.5 w-3.5 text-[#E33337]" />
            Сделано
          </button>
        </div>
      </div>

      <ProgressBar status={status} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[#A9AFB7]">
        <span className="inline-flex items-center gap-1">
          <ClockIcon className="h-3.5 w-3.5" />
          Интервал:{' '}
          <strong className="font-semibold text-[#D3D7DC]">
            {formatInterval(status)}
          </strong>
        </span>
        <span className="inline-flex items-center gap-1">
          <GaugeIcon className="h-3.5 w-3.5" />
          {status.lastKm === null || (status.estimated && status.lastKm === 0)
            ? 'Отметок в журнале нет'
            : `Последний раз: ${fmtMileage(status.lastKm)}${
                status.lastDate ? ` · ${fmtDate(status.lastDate)}` : ''
              }`}
        </span>
        <span className="inline-flex items-center gap-1">
          ≈ {fmtMoney(status.item.cost[0])} — {fmtMoney(status.item.cost[1])}
        </span>
      </div>

      {open && (
        <div className="rounded-[8px] border border-[#363B43] bg-[#0E1013]/60 p-3 text-[12px] leading-relaxed text-[#A9AFB7]">
          <p className="mb-1.5 font-semibold text-[#F3F4F4]">Что говорят владельцы</p>
          {status.item.advice}
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-[6px] border border-[#363B43] bg-[#23272D] px-2 py-0.5">
              Завод: {formatInterval({ ...status, interval: status.item.factory })}
            </span>
            <span className="rounded-[6px] border border-[#363B43] bg-[#23272D] px-2 py-0.5">
              Форумы: {formatInterval({ ...status, interval: { ...status.item.factory, ...status.item.forum } })}
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}

function ReminderCard({
  icon,
  title,
  value,
  days,
  href,
  onClick,
}: {
  icon: ReactNode
  title: string
  value: string
  days: number | null
  href?: string
  onClick?(): void
}) {
  const tone =
    days === null ? 'muted' : days < 0 ? 'danger' : days <= 30 ? 'warn' : 'ok'
  const styles: Record<string, string> = {
    danger: 'border-[#EF4444]/45 bg-[#EF4444]/10',
    warn: 'border-[#F5A623]/45 bg-[#F5A623]/10',
    ok: 'border-[#363B43] bg-[#1A1D22]',
    muted: 'border-[#363B43] bg-[#1A1D22]',
  }
  const body = (
    <div className={`flex h-full items-center gap-3 rounded-[10px] border p-3 text-left ${styles[tone]}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[#363B43] bg-[#23272D] text-[#E33337]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">{title}</p>
        <p className="truncate text-[13px] font-bold text-[#F3F4F4]">{value}</p>
        {days !== null && (
          <p
            className={`text-[11.5px] font-semibold ${
              days < 0 ? 'text-[#EF4444]' : days <= 30 ? 'text-[#F5A623]' : 'text-[#A9AFB7]'
            }`}
          >
            {days < 0
              ? `просрочено на ${Math.abs(days)} ${plural(Math.abs(days), ['день', 'дня', 'дней'])}`
              : `осталось ${days} ${plural(days, ['день', 'дня', 'дней'])}`}
          </p>
        )}
      </div>
    </div>
  )
  if (href) return <Link to={href}>{body}</Link>
  return (
    <button type="button" onClick={onClick} className="text-left">
      {body}
    </button>
  )
}

function MarkDoneSheet({
  status,
  currentMileage,
  onClose,
  onSave,
}: {
  status: ServiceStatus | null
  currentMileage: number
  onClose(): void
  onSave(data: { date: string; mileage: number; cost: number; comment: string }): Promise<void>
}) {
  const [date, setDate] = useState(toDateInputValue(new Date()))
  const [mileage, setMileage] = useState(String(currentMileage))
  const [cost, setCost] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // при открытии подставляем актуальные значения
  const open = status !== null
  const key = status?.item.id ?? ''
  useEffect(() => {
    if (!open) return
    setDate(toDateInputValue(new Date()))
    setMileage(String(currentMileage))
    setCost('')
    setComment('')
    setError('')
  }, [open, key, currentMileage])

  if (!status) return null

  const submit = async () => {
    const km = Math.round(parseLocaleNumber(mileage))
    if (!Number.isFinite(km) || km < 0) {
      setError('Введите корректный пробег')
      return
    }
    const money = cost.trim() === '' ? 0 : parseLocaleNumber(cost)
    if (cost.trim() !== '' && (!Number.isFinite(money) || money < 0)) {
      setError('Введите корректную стоимость или оставьте поле пустым')
      return
    }
    setSaving(true)
    try {
      await onSave({ date, mileage: km, cost: money, comment: comment.trim() })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить запись')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={status.item.title}>
      <div className="flex flex-col gap-3.5">
        <p className="rounded-[8px] border border-[#363B43] bg-[#0E1013]/60 px-3 py-2 text-[12px] leading-relaxed text-[#A9AFB7]">
          Запись попадёт в журнал ТО, а следующий срок пересчитается от неё:{' '}
          <strong className="text-[#F3F4F4]">{formatInterval(status)}</strong>.
        </p>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Дата работ" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Field
            label="Пробег"
            suffix="км"
            inputMode="numeric"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
          />
        </div>
        <Field
          label="Стоимость (необязательно)"
          suffix="₽"
          inputMode="numeric"
          placeholder="Добавится в расходы категории «ТО и ремонт»"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
        <Field
          label="Комментарий (необязательно)"
          placeholder="Например: масло Rosneft 5W-40, фильтр Mann"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {error && (
          <p
            role="alert"
            className="rounded-[8px] border border-[#EF4444]/40 bg-[#EF4444]/12 px-3.5 py-2.5 text-[13px] font-medium text-[#EF4444]"
          >
            {error}
          </p>
        )}
        <Button onClick={() => void submit()} disabled={saving} className="w-full">
          <PlusIcon className="h-4 w-4" />
          {saving ? 'Сохраняем…' : 'Записать в журнал ТО'}
        </Button>
      </div>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/*  Текстовые помощники                                                */
/* ------------------------------------------------------------------ */

function formatInterval(status: { interval: { km?: number; months?: number } }): string {
  const { km, months } = status.interval
  const parts: string[] = []
  if (km) parts.push(fmtMileage(km))
  if (months)
    parts.push(
      months % 12 === 0
        ? `${months / 12} ${plural(months / 12, ['год', 'года', 'лет'])}`
        : `${months} ${plural(months, ['месяц', 'месяца', 'месяцев'])}`,
    )
  return parts.join(' / ') || 'по состоянию'
}

function forecastMonths(km: number, kmPerMonth: number): string {
  const months = km / kmPerMonth
  if (months < 1) return 'меньше месяца'
  const rounded = Math.round(months)
  return `${rounded} ${plural(rounded, ['месяц', 'месяца', 'месяцев'])}`
}

function describeRemaining(status: ServiceStatus, kmPerMonth: number | null): string {
  const parts: string[] = []
  if (status.remainingKm !== null) {
    parts.push(
      status.remainingKm >= 0
        ? `осталось ${fmtMileage(status.remainingKm)}`
        : `перепробег ${fmtMileage(Math.abs(status.remainingKm))}`,
    )
  }
  if (status.remainingDays !== null) {
    parts.push(
      status.remainingDays >= 0
        ? `или ${status.remainingDays} ${plural(status.remainingDays, ['день', 'дня', 'дней'])} по сроку`
        : `срок вышел ${Math.abs(status.remainingDays)} ${plural(
            Math.abs(status.remainingDays),
            ['день', 'дня', 'дней'],
          )} назад`,
    )
  }
  if (parts.length === 0) return 'Интервал по состоянию — смотрите на каждом ТО'
  if (kmPerMonth && status.remainingKm !== null && status.remainingKm > 0) {
    parts.push(`≈ ${forecastMonths(status.remainingKm, kmPerMonth)} при вашем пробеге`)
  }
  return parts.join(' · ')
}

/** Сначала показываем чек-лист ближайшего сезона */
function orderedSeasons() {
  const month = new Date().getMonth() // 0 — январь
  const winterFirst = month >= 8 || month <= 1 // сентябрь–февраль
  return winterFirst
    ? [...SEASON_CHECKS].sort((a) => (a.season === 'winter' ? -1 : 1))
    : [...SEASON_CHECKS].sort((a) => (a.season === 'summer' ? -1 : 1))
}
