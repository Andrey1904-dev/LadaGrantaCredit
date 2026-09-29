import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import Sheet from '../components/Sheet'
import { Button, Card, EmptyState, Field, SectionTitle, Spinner } from '../components/ui'
import { CarIcon, EditIcon, PlusIcon, ShieldIcon, TrashIcon, WrenchIcon } from '../components/icons'
import { daysUntil } from '../utils/date'
import { fmtDate, fmtMileage, fmtNumber, parseLocaleNumber, plural, toDateInputValue } from '../utils/format'

/** Вкладка 4: Моя Гранта — данные авто, страховка, журнал ТО */
export default function GaragePage() {
  const { car, maintenance, loading, saveCar, addMaintenance, removeMaintenance } = useAppData()
  const [carSheet, setCarSheet] = useState(false)
  const [serviceSheet, setServiceSheet] = useState(false)

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (!car) {
    return (
      <EmptyState
        icon={<CarIcon className="h-9 w-9" />}
        title="Автомобиль не добавлен"
        text="Вернитесь на главную и добавьте вашу LADA Granta"
      />
    )
  }

  return (
    <div className="animate-pop-in">
      <h1 className="mb-3 px-1 text-[20px] font-extrabold text-ink">Моя Гранта</h1>

      {/* Паспорт автомобиля */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">LADA Granta</p>
            <div className="mt-1.5 inline-flex items-center rounded-lg border-2 border-ink/80 bg-white px-3 py-1 font-mono text-[15px] font-bold tracking-wider text-ink shadow-sm">
              {car.plate_number || '—'}
            </div>
          </div>
          <Button variant="secondary" className="px-3! py-2! text-[12px]" onClick={() => setCarSheet(true)}>
            <EditIcon className="h-4 w-4" />
            Изменить
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 border-t border-black/[0.06] pt-3.5 text-[13px]">
          <span className="text-muted">VIN</span>
          <span className="break-all font-mono font-semibold text-ink">{car.vin_number || '—'}</span>
          <span className="text-muted">Пробег</span>
          <span className="font-semibold text-ink">{fmtMileage(car.current_mileage)}</span>
        </div>
      </Card>

      {/* Напоминание о страховке */}
      <SectionTitle>Страховка (ОСАГО)</SectionTitle>
      <InsuranceCard
        insuranceUntil={car.insurance_until}
        onSave={async (date) => {
          await saveCar({ insurance_until: date })
        }}
      />

      {/* Журнал ТО */}
      <SectionTitle
        action={
          <Button variant="secondary" className="px-3! py-2! text-[12px]" onClick={() => setServiceSheet(true)}>
            <PlusIcon className="h-4 w-4" />
            Запись
          </Button>
        }
      >
        Журнал ТО и ремонтов
      </SectionTitle>
      {maintenance.length === 0 ? (
        <EmptyState
          icon={<WrenchIcon className="h-9 w-9" />}
          title="Журнал пуст"
          text="Фиксируйте замены масла, фильтров и другие работы с пробегом — так проще планировать следующее ТО"
        />
      ) : (
        <div className="relative flex flex-col gap-3 pl-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-0.5 before:bg-black/[0.08]">
          {maintenance.map((m) => (
            <div key={m.id} className="relative">
              <span className="absolute -left-[19.5px] top-4 h-3 w-3 rounded-full border-2 border-white bg-lada" />
              <Card className="p-3.5!">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-bold text-ink">{fmtDate(m.date)}</p>
                    <p className="mt-0.5 text-[12px] font-medium text-lada">{fmtMileage(m.mileage)}</p>
                  </div>
                  <button
                    aria-label="Удалить запись"
                    onClick={() => {
                      if (window.confirm('Удалить запись из журнала ТО?')) void removeMaintenance(m.id)
                    }}
                    className="rounded-lg p-1.5 text-black/25 transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink/80">{m.description}</p>
              </Card>
            </div>
          ))}
        </div>
      )}

      <CarFormSheet open={carSheet} onClose={() => setCarSheet(false)} />
      <MaintenanceFormSheet open={serviceSheet} onClose={() => setServiceSheet(false)} />
    </div>
  )
}

/* ------------------------- Страховка ------------------------- */

function InsuranceCard({
  insuranceUntil,
  onSave,
}: {
  insuranceUntil: string | null
  onSave: (date: string | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(insuranceUntil ?? '')

  useEffect(() => setDate(insuranceUntil ?? ''), [insuranceUntil])

  const status = useMemo(() => {
    if (!insuranceUntil) return null
    const days = daysUntil(insuranceUntil)
    if (days < 0) return { kind: 'expired' as const, days }
    if (days <= 14) return { kind: 'soon' as const, days }
    return { kind: 'ok' as const, days }
  }, [insuranceUntil])

  const colors = {
    ok: { dot: '#12A76D', text: '#12A76D', bg: 'rgba(18,167,109,0.1)', label: 'Действует' },
    soon: { dot: '#E23D3D', text: '#E23D3D', bg: 'rgba(226,61,61,0.1)', label: 'Скоро закончится' },
    expired: { dot: '#E23D3D', text: '#E23D3D', bg: 'rgba(226,61,61,0.1)', label: 'Истекла' },
  } as const

  return (
    <Card>
      {editing ? (
        <div className="flex flex-col gap-3">
          <Field label="Дата окончания полиса" type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={async () => {
                await onSave(date || null)
                setEditing(false)
              }}
            >
              Сохранить
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="flex w-full items-center gap-3 text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#12a76d1f] text-success">
            <ShieldIcon className="h-[22px] w-[22px]" />
          </span>
          {status ? (
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-ink">до {fmtDate(insuranceUntil!)}</p>
              <p
                className="mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ backgroundColor: colors[status.kind].bg, color: colors[status.kind].text }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors[status.kind].dot }} />
                {status.kind === 'expired'
                  ? 'Полис истёк!'
                  : `${colors[status.kind].label} · осталось ${fmtNumber(status.days)} ${plural(status.days, ['день', 'дня', 'дней'])}`}
              </p>
            </div>
          ) : (
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-ink">Дата не указана</p>
              <p className="text-[12px] text-muted">Нажмите, чтобы добавить напоминание</p>
            </div>
          )}
          <EditIcon className="h-4 w-4 shrink-0 text-black/25" />
        </button>
      )}
      {status?.kind === 'soon' && (
        <p className="mt-3 rounded-xl bg-danger/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-danger">
          До окончания полиса меньше 14 дней — продлите ОСАГО, чтобы не получить штраф.
        </p>
      )}
    </Card>
  )
}

/* ------------------------- Формы ------------------------- */

function CarFormSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { car, saveCar } = useAppData()
  const [plate, setPlate] = useState('')
  const [vin, setVin] = useState('')
  const [mileage, setMileage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !car) return
    setPlate(car.plate_number)
    setVin(car.vin_number)
    setMileage(String(car.current_mileage))
    setError('')
  }, [open, car])

  const submit = async () => {
    const km = Math.round(parseLocaleNumber(mileage))
    if (!plate.trim()) return setError('Укажите госномер')
    if (!Number.isFinite(km) || km < 0) return setError('Укажите корректный пробег')
    setSaving(true)
    try {
      await saveCar({
        plate_number: plate.trim().toUpperCase(),
        vin_number: vin.trim().toUpperCase(),
        current_mileage: km,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Данные автомобиля">
      <div className="flex flex-col gap-3.5">
        <Field label="Госномер" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="А 123 БВ 77" />
        <Field label="VIN" value={vin} onChange={(e) => setVin(e.target.value)} placeholder="XTA211500…" />
        <Field label="Текущий пробег" suffix="км" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} />
        {error && <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13px] font-medium text-danger">{error}</p>}
        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
    </Sheet>
  )
}

function MaintenanceFormSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { car, addMaintenance } = useAppData()
  const [date, setDate] = useState('')
  const [mileage, setMileage] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDate(toDateInputValue(new Date()))
    setMileage(car ? String(car.current_mileage) : '')
    setDescription('')
    setError('')
  }, [open, car])

  const submit = async () => {
    const km = Math.round(parseLocaleNumber(mileage))
    if (!Number.isFinite(km) || km < 0) return setError('Укажите пробег на момент работ')
    if (!description.trim()) return setError('Опишите выполненные работы')
    setSaving(true)
    try {
      await addMaintenance({ date, mileage: km, description: description.trim() })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Запись в журнал ТО">
      <div className="flex flex-col gap-3.5">
        <Field label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Field label="Пробег" suffix="км" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} />
        <Field
          label="Описание работ"
          placeholder="Замена масла и фильтров"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {error && <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13px] font-medium text-danger">{error}</p>}
        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? 'Сохраняем…' : 'Добавить запись'}
        </Button>
      </div>
    </Sheet>
  )
}
