import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext'
import AddTransactionSheet from '../components/AddTransactionSheet'
import Sheet from '../components/Sheet'
import { Button, Card, EmptyState, Field, SectionTitle, Spinner } from '../components/ui'
import { CalendarIcon, CardIcon, CarIcon, FuelIcon, GaugeIcon, WrenchIcon, DotsIcon } from '../components/icons'
import { nextPaymentDate, startOfMonth } from '../utils/date'
import { fmtDate, fmtMileage, fmtMoney, parseLocaleNumber } from '../utils/format'
import type { TxCategory } from '../types/domain'

/** Вкладка 1: Главная (Dashboard) */
export default function DashboardPage() {
  const { car, loan, transactions, loading, saveCar } = useAppData()
  const [txSheet, setTxSheet] = useState<TxCategory | null>(null)
  const [mileageOpen, setMileageOpen] = useState(false)
  const [newMileage, setNewMileage] = useState('')
  const [mileageError, setMileageError] = useState('')

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
      if (new Date(t.date) >= start) acc.set(t.category, (acc.get(t.category) ?? 0) + t.amount)
    }
    return acc
  }, [transactions])

  const nextPayment = useMemo(() => (loan ? nextPaymentDate(loan.start_date) : null), [loan])

  const handleMileageSave = async () => {
    const value = Math.round(parseLocaleNumber(newMileage))
    if (!Number.isFinite(value) || value < 0) {
      setMileageError('Введите корректный пробег')
      return
    }
    if (car && value < car.current_mileage) {
      setMileageError(`Пробег не может быть меньше текущего (${fmtMileage(car.current_mileage)})`)
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

  const quickActions: Array<{ category: TxCategory; label: string; Icon: typeof FuelIcon; bg: string }> = [
    { category: 'fuel', label: 'Топливо', Icon: FuelIcon, bg: '#F5A623' },
    { category: 'loan', label: 'Кредит', Icon: CardIcon, bg: '#005BAA' },
    { category: 'maintenance', label: 'ТО', Icon: WrenchIcon, bg: '#7C5CFC' },
    { category: 'other', label: 'Прочее', Icon: DotsIcon, bg: '#8A94A6' },
  ]

  return (
    <div className="animate-pop-in">
      {/* Виджет автомобиля */}
      <Card className="relative overflow-hidden">
        <div className="absolute -right-6 -top-8 text-lada/[0.07]">
          <CarIcon className="h-36 w-36" />
        </div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Моя LADA Granta</p>
        <div className="mt-2 inline-flex items-center rounded-lg border-2 border-ink/80 bg-white px-3 py-1 font-mono text-[15px] font-bold tracking-wider text-ink shadow-sm">
          {car.plate_number || 'НОМЕР НЕ УКАЗАН'}
        </div>
        <div className="mt-3.5 flex items-end justify-between">
          <div>
            <p className="text-[12px] text-muted">Текущий пробег</p>
            <p className="text-[26px] font-extrabold leading-tight text-ink">{fmtMileage(car.current_mileage)}</p>
          </div>
          <Button
            variant="secondary"
            className="px-3.5! py-2.5! text-[13px]"
            onClick={() => {
              setNewMileage(String(car.current_mileage))
              setMileageError('')
              setMileageOpen(true)
            }}
          >
            <GaugeIcon className="h-4 w-4" />
            Обновить
          </Button>
        </div>
      </Card>

      {/* Виджет кредита */}
      <SectionTitle action={<Link to="/credit" className="text-[13px] font-semibold text-lada">Подробнее</Link>}>
        Кредит
      </SectionTitle>
      {loan ? (
        <Link to="/credit">
          <Card className="flex items-center justify-between bg-lada! text-white transition-transform active:scale-[0.98]">
            <div>
              <p className="text-[12px] font-medium text-white/70">Следующий платёж</p>
              <p className="text-[22px] font-extrabold leading-tight">{fmtMoney(loan.monthly_payment)}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-white/75">
                <CalendarIcon className="h-3.5 w-3.5" />
                {nextPayment ? fmtDate(nextPayment) : '—'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <CardIcon className="h-6 w-6" />
            </div>
          </Card>
        </Link>
      ) : (
        <EmptyState
          icon={<CardIcon className="h-9 w-9" />}
          title="Кредит не подключён"
          text="Добавьте параметры автокредита, чтобы отслеживать график и остаток долга"
          action={
            <Link to="/credit">
              <Button variant="secondary" className="px-3.5! py-2! text-[13px]">Добавить кредит</Button>
            </Link>
          }
        />
      )}

      {/* Быстрые действия */}
      <SectionTitle>Добавить расход</SectionTitle>
      <div className="grid grid-cols-4 gap-2.5">
        {quickActions.map(({ category, label, Icon, bg }) => (
          <button
            key={category}
            onClick={() => setTxSheet(category)}
            className="flex flex-col items-center gap-2 rounded-2xl bg-card py-4 transition-transform active:scale-95"
          >
            <span
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ backgroundColor: bg }}
            >
              <Icon className="h-[22px] w-[22px]" />
            </span>
            <span className="text-[12px] font-semibold text-ink">{label}</span>
          </button>
        ))}
      </div>

      {/* Сводка бюджета */}
      <SectionTitle>Бюджет месяца</SectionTitle>
      <Card>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[12px] text-muted">Потрачено в этом месяце</p>
            <p className="text-[26px] font-extrabold leading-tight text-ink">{fmtMoney(monthSpent)}</p>
          </div>
          <Link to="/expenses" className="pb-0.5 text-[13px] font-semibold text-lada">
            Аналитика
          </Link>
        </div>
        {monthByCategory.size > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-black/[0.06] pt-3">
            {[...monthByCategory.entries()].map(([c, sum]) => (
              <span
                key={c}
                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-muted"
              >
                {CATEGORY_NAMES[c]} · {fmtMoney(sum)}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* BottomSheet: обновление пробега */}
      <Sheet open={mileageOpen} onClose={() => setMileageOpen(false)} title="Обновить пробег">
        <div className="flex flex-col gap-3.5">
          <Field
            label="Текущий пробег"
            suffix="км"
            inputMode="numeric"
            value={newMileage}
            onChange={(e) => setNewMileage(e.target.value)}
            autoFocus
          />
          {mileageError && (
            <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13px] font-medium text-danger">
              {mileageError}
            </p>
          )}
          <Button onClick={handleMileageSave} className="w-full">Сохранить</Button>
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

const CATEGORY_NAMES: Record<TxCategory, string> = {
  fuel: 'Топливо',
  loan: 'Кредит',
  maintenance: 'ТО',
  insurance: 'Страховка',
  other: 'Прочее',
}

/** Онбординг: первичное добавление автомобиля для нового пользователя */
function OnboardingCar() {
  const { saveCar } = useAppData()
  const [plate, setPlate] = useState('')
  const [vin, setVin] = useState('')
  const [mileage, setMileage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const km = Math.round(parseLocaleNumber(mileage) || 0)
    if (!plate.trim()) {
      setError('Укажите госномер автомобиля')
      return
    }
    if (!Number.isFinite(km) || km < 0) {
      setError('Укажите корректный пробег')
      return
    }
    setSaving(true)
    try {
      await saveCar({
        plate_number: plate.trim().toUpperCase(),
        vin_number: vin.trim().toUpperCase(),
        current_mileage: km,
        initial_mileage: km,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-pop-in flex flex-col gap-4 py-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-lada-light text-lada">
          <CarIcon className="h-8 w-8" />
        </div>
        <h1 className="text-[19px] font-extrabold text-ink">Добавьте вашу Granta</h1>
        <p className="mt-1 text-[13px] text-muted">Это займёт меньше минуты</p>
      </div>
      <Card className="flex flex-col gap-3.5">
        <Field label="Госномер" placeholder="А 123 БВ 77" value={plate} onChange={(e) => setPlate(e.target.value)} />
        <Field label="VIN (необязательно)" placeholder="XTA211500…" value={vin} onChange={(e) => setVin(e.target.value)} />
        <Field label="Текущий пробег" suffix="км" inputMode="numeric" placeholder="0" value={mileage} onChange={(e) => setMileage(e.target.value)} />
        {error && (
          <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13px] font-medium text-danger">{error}</p>
        )}
        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? 'Сохраняем…' : 'Сохранить автомобиль'}
        </Button>
      </Card>
    </div>
  )
}
