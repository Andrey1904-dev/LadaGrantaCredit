import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
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
  AlertIcon,
  CarIcon,
  CheckIcon,
  DocIcon,
  DownloadIcon,
  EditIcon,
  PlusIcon,
  ShieldIcon,
  TrashIcon,
  WrenchIcon,
} from '../components/icons'
import { daysUntil } from '../utils/date'
import {
  fmtDate,
  fmtMileage,
  fmtNumber,
  parseLocaleNumber,
  plural,
  toDateInputValue,
} from '../utils/format'
import {
  GRANTA_ASSETS,
  PAGE_MEDIA,
  getSavedFinish,
  setSavedFinish,
  type GrantaFinish,
} from '../lib/assets'
import PageHero, { HeroChip } from '../components/PageHero'
import { Link } from 'react-router-dom'
import { useSettings } from '../lib/settings'
import { SERVICE_ITEMS, buildServicePlan } from '../lib/service'
import {
  backupFileName,
  buildBackup,
  buildExpensesCsv,
  buildMaintenanceCsv,
  downloadTextFile,
} from '../lib/backup'

/** Вкладка 4: Гараж — паспорт LADA Granta Sport, выбор цвета кузова (визуал), ОСАГО и журнал ТО */
export default function GaragePage() {
  const {
    car,
    loan,
    transactions,
    maintenance,
    loading,
    saveCar,
    addMaintenance,
    removeMaintenance,
  } = useAppData()
  const [settings] = useSettings()
  const [carSheet, setCarSheet] = useState(false)
  const [serviceSheet, setServiceSheet] = useState(false)
  const [finish, setFinish] = useState<GrantaFinish>(() => getSavedFinish())

  // Короткая сводка регламента — журнал ТО и план обслуживания смотрят на одни и те же записи
  const servicePlan = useMemo(() => {
    if (!car) return []
    return buildServicePlan({
      mileage: car.current_mileage,
      mode: settings.planMode,
      engine: settings.engine,
      maintenance,
      purchaseDate: settings.purchaseDate,
    })
  }, [car, maintenance, settings.planMode, settings.engine, settings.purchaseDate])
  const serviceAttention = servicePlan.filter((s) => s.state !== 'ok')
  const nearestWork = serviceAttention[0] ?? servicePlan[0] ?? null

  const handleFinishChange = (next: GrantaFinish) => {
    setFinish(next)
    setSavedFinish(next)
  }

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
        showSportDetail
        icon={<CarIcon className="h-6 w-6" />}
        title="Автомобиль не добавлен"
        text="Перейдите на главную страницу и заполните карточку вашей LADA Granta"
      />
    )
  }

  const carAsset = finish === 'white' ? GRANTA_ASSETS.white : GRANTA_ASSETS.black
  const drivenKm = Math.max(0, car.current_mileage - (car.initial_mileage || 0))

  return (
    <div className="animate-pop-in">
      <div className="mb-4">
        <PageHero
          media={PAGE_MEDIA.garage}
          eyebrow="Паспорт автомобиля"
          title="Мой гараж · Granta Sport"
          subtitle="Номер, VIN, пробег, полис ОСАГО и полный журнал выполненных работ."
          priority
          action={
            <Button variant="secondary" onClick={() => setCarSheet(true)}>
              <EditIcon className="h-4 w-4 text-[#E33337]" />
              Редактировать авто
            </Button>
          }
          chips={
            <>
              <HeroChip label="Пробег" value={fmtMileage(car.current_mileage)} />
              <HeroChip label="Записей ТО" value={String(maintenance.length)} />
              <Link
                to="/service"
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-[7px] border border-[#E33337]/45 bg-[#E33337]/12 px-2.5 py-1 text-[12px] font-bold text-[#F3F4F4] hover:bg-[#E33337]/20"
              >
                <WrenchIcon className="h-3.5 w-3.5 text-[#E33337]" />
                План обслуживания
              </Link>
            </>
          }
        />
      </div>

      {/* 1. Напоминание об ОСАГО (если истекает или истёк — сразу наверху, не перекрывается фото) */}
      <InsuranceCard
        insuranceUntil={car.insurance_until}
        onSave={async (date) => {
          await saveCar({ insurance_until: date })
        }}
      />

      {/* 2. Паспорт автомобиля и студийный рендер (черный / белый вариант) */}
      <Card className="mt-4 p-0 overflow-hidden">
        {/* Верхняя панель выбора цвета кузова (явно отмечено как визуальное демо) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#363B43] bg-[#23272D]/75 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#F3F4F4]">
              Исполнение кузова
            </span>
            <span className="rounded-[5px] border border-[#363B43] bg-[#0E1013] px-2 py-0.5 text-[10.5px] font-medium text-[#A9AFB7]">
              Визуальное демо
            </span>
          </div>

          <div
            className="flex items-center gap-1.5"
            role="radiogroup"
            aria-label="Выбор цвета автомобиля для визуализации"
          >
            <button
              type="button"
              role="radio"
              aria-checked={finish === 'black'}
              onClick={() => handleFinishChange('black')}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-[8px] border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                finish === 'black'
                  ? 'border-[#E33337] bg-[#0E1013] text-[#F3F4F4]'
                  : 'border-[#363B43] bg-[#1A1D22] text-[#A9AFB7] hover:text-[#F3F4F4]'
              }`}
            >
              <span className="h-3 w-3 rounded-full border border-[#A9AFB7]/60 bg-[#14171C]" />
              Чёрный
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={finish === 'white'}
              onClick={() => handleFinishChange('white')}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-[8px] border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                finish === 'white'
                  ? 'border-[#E33337] bg-[#0E1013] text-[#F3F4F4]'
                  : 'border-[#363B43] bg-[#1A1D22] text-[#A9AFB7] hover:text-[#F3F4F4]'
              }`}
            >
              <span className="h-3 w-3 rounded-full border border-[#363B43] bg-[#F3F4F4]" />
              Белый
            </button>
          </div>
        </div>

        {/* Контрастный графитовый подиум: сохраняем прозрачность и пропорции (object-fit: contain) */}
        <div className="relative flex h-52 w-full items-center justify-center overflow-hidden bg-gradient-to-b from-[#2A2F37] via-[#1E2229] to-[#1A1D22] px-4 py-3 sm:h-60">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(227,51,55,0.10)_0%,rgba(14,16,19,0)_70%)]"
            aria-hidden="true"
          />
          <img
            src={carAsset.src}
            data-webp-src={carAsset.webp}
            alt={carAsset.alt}
            loading="lazy"
            className="relative z-10 max-h-full w-full object-contain object-center"
          />
        </div>

        {/* Технические данные паспорта авто */}
        <div className="border-t border-[#363B43] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#363B43]/70">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
                Регистрационный знак
              </p>
              <div className="mt-1">
                <LicensePlate plate={car.plate_number} />
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
                Идентификационный номер (VIN)
              </p>
              <p className="mt-1 break-all rounded-[6px] border border-[#363B43] bg-[#0E1013] px-2.5 py-1 font-mono text-[13px] font-bold tracking-wider text-[#F3F4F4]">
                {car.vin_number || 'НЕ УКАЗАН'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11.5px] font-medium text-[#A9AFB7]">Текущий пробег</p>
              <p className="font-display-num mt-0.5 text-[22px] font-bold text-[#F3F4F4]">
                {fmtMileage(car.current_mileage)}
              </p>
            </div>
            <div>
              <p className="text-[11.5px] font-medium text-[#A9AFB7]">Начальный пробег</p>
              <p className="font-display-num mt-0.5 text-[22px] font-bold text-[#A9AFB7]">
                {fmtMileage(car.initial_mileage || 0)}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[11.5px] font-medium text-[#A9AFB7]">Пройдено во владении</p>
              <p className="font-display-num mt-0.5 text-[22px] font-bold text-[#E33337]">
                +{fmtMileage(drivenKm)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Журнал ТО и ремонтов */}
      <SectionTitle
        action={
          <Button
            onClick={() => setServiceSheet(true)}
            className="min-h-[40px] px-3.5 py-2 text-[12.5px]"
          >
            <PlusIcon className="h-4 w-4" />
            Добавить запись ТО
          </Button>
        }
      >
        Журнал ТО и ремонтов
      </SectionTitle>

      {maintenance.length === 0 ? (
        <EmptyState
          showSportDetail
          icon={<WrenchIcon className="h-6 w-6" />}
          title="Сервисный журнал пуст"
          text="Фиксируйте замену масла, свечей, фильтров и регламентные работы с пробегом — так проще планировать следующее ТО"
          action={
            <Button variant="secondary" onClick={() => setServiceSheet(true)}>
              Добавить первую запись
            </Button>
          }
        />
      ) : (
        <div className="relative flex flex-col gap-3 pl-5 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-[2px] before:bg-[#363B43]">
          {maintenance.map((m) => (
            <div key={m.id} className="relative">
              <span
                className="absolute -left-[18px] top-4 h-3 w-3 rounded-full border-2 border-[#0E1013] bg-[#E33337]"
                aria-hidden="true"
              />
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-bold text-[#F3F4F4]">
                        {fmtDate(m.date)}
                      </p>
                      <span className="rounded-[6px] border border-[#E33337]/45 bg-[#E33337]/15 px-2 py-0.5 font-mono text-[11.5px] font-bold text-[#F3F4F4]">
                        {fmtMileage(m.mileage)}
                      </span>
                    </div>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-[#A9AFB7]">
                      {m.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Удалить запись ТО от ${fmtDate(m.date)}`}
                    onClick={() => {
                      if (window.confirm('Удалить запись из журнала ТО?')) {
                        void removeMaintenance(m.id)
                      }
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[#A9AFB7] transition-colors hover:bg-[#EF4444]/15 hover:text-[#EF4444]"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Выгрузка данных: резервная копия и таблицы для Excel */}
      <SectionTitle
        action={<span className="text-[11.5px] text-[#A9AFB7]">всё считается в браузере</span>}
        tip={
          <>
            Резервная копия JSON — все ваши данные одним файлом (автомобиль, кредит, расходы,
            журнал ТО): удобно перед сменой браузера или как страховка. CSV открывается в Excel и
            «Google Таблицах»: разделитель «;» и кодировка с BOM, чтобы кириллица не превратилась
            в кракозябры. Файлы собираются прямо в браузере и никуда не отправляются.
          </>
        }
      >
        Мои данные
      </SectionTitle>
      <Card className="flex flex-col gap-3">
        <p className="text-[12.5px] leading-relaxed text-[#A9AFB7]">
          Резервная копия — весь гараж одним файлом: автомобиль, кредит, {transactions.length}{' '}
          {plural(transactions.length, ['операция', 'операции', 'операций'])} и журнал ТО.
          Таблицы CSV открываются в Excel, Numbers и Google Таблицах.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              downloadTextFile(
                backupFileName('json'),
                buildBackup({ car, loan, transactions, maintenance, settings }),
                'application/json',
              )
            }
          >
            <DownloadIcon className="h-4 w-4" />
            Резервная копия
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              downloadTextFile(
                `raskhody-${backupFileName('csv')}`,
                buildExpensesCsv(transactions),
                'text/csv',
              )
            }
          >
            <DocIcon className="h-4 w-4" />
            Расходы в CSV
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              downloadTextFile(
                `zhurnal-to-${backupFileName('csv')}`,
                buildMaintenanceCsv(maintenance),
                'text/csv',
              )
            }
          >
            <DocIcon className="h-4 w-4" />
            Журнал ТО в CSV
          </Button>
        </div>
      </Card>

      {/* Переход к полному регламенту: журнал выше — про прошлое, этот блок — про будущее */}
      <Link
        to="/service"
        className="group mt-6 block overflow-hidden rounded-[10px] border border-[#363B43] bg-[#1A1D22] transition-colors hover:border-[#E33337]/70"
      >
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
          <div className="h-24 w-full overflow-hidden bg-[#0E1013] sm:h-full">
            <img
              src={GRANTA_ASSETS.detail.src}
              data-webp-src={GRANTA_ASSETS.detail.webp}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover object-center"
            />
          </div>
          <div className="flex flex-col justify-center border-t border-[#363B43] p-3.5 sm:border-l sm:border-t-0">
            <p className="font-display-num text-[13px] font-bold uppercase tracking-wider text-[#F3F4F4]">
              Регламент обслуживания LADA Granta
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#A9AFB7]">
              {nearestWork
                ? `Ближайшая работа: ${nearestWork.item.title.toLowerCase()}. Внимания требуют ${serviceAttention.length} из ${servicePlan.length} позиций — открыть план ТО.`
                : `${SERVICE_ITEMS.length} регламентных работ по вашему пробегу, «болячки» Гранты и сезонные чек-листы — открыть раздел ТО.`}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#E33337]">
              <WrenchIcon className="h-3.5 w-3.5" />
              Перейти к плану ТО
            </span>
          </div>
        </div>
      </Link>

      <CarFormSheet open={carSheet} onClose={() => setCarSheet(false)} />
      <MaintenanceFormSheet
        open={serviceSheet}
        onClose={() => setServiceSheet(false)}
        onAdd={async (record) => {
          await addMaintenance(record)
          if (car && record.mileage > car.current_mileage) {
            await saveCar({ current_mileage: record.mileage })
          }
        }}
        defaultMileage={car.current_mileage}
      />
    </div>
  )
}

/* ------------------------- Карточка полиса ОСАГО ------------------------- */

function InsuranceCard({
  insuranceUntil,
  onSave,
}: {
  insuranceUntil: string | null
  onSave: (date: string | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(insuranceUntil ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => setDate(insuranceUntil ?? ''), [insuranceUntil])

  const status = useMemo(() => {
    if (!insuranceUntil) return { kind: 'none' as const, days: 0 }
    const d = daysUntil(insuranceUntil)
    if (d < 0) return { kind: 'expired' as const, days: d }
    if (d <= 14) return { kind: 'soon' as const, days: d }
    return { kind: 'ok' as const, days: d }
  }, [insuranceUntil])

  const styles = {
    none: {
      border: 'border-[#363B43]',
      badge: 'bg-[#23272D] text-[#A9AFB7] border-[#363B43]',
      iconColor: 'text-[#A9AFB7]',
      label: 'Не указан',
    },
    ok: {
      border: 'border-[#16B374]/45',
      badge: 'bg-[#16B374]/15 text-[#16B374] border-[#16B374]/40',
      iconColor: 'text-[#16B374]',
      label: 'Полис активен',
    },
    soon: {
      border: 'border-[#F5A623]',
      badge: 'bg-[#F5A623]/18 text-[#F5A623] border-[#F5A623]/50',
      iconColor: 'text-[#F5A623]',
      label: 'Скоро истекает',
    },
    expired: {
      border: 'border-[#EF4444]',
      badge: 'bg-[#EF4444]/18 text-[#EF4444] border-[#EF4444]/50',
      iconColor: 'text-[#EF4444]',
      label: 'Полис истёк',
    },
  }[status.kind]

  const save = async () => {
    setSaving(true)
    try {
      await onSave(date.trim() ? date.trim() : null)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={`border ${styles.border}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#363B43] bg-[#23272D] ${styles.iconColor}`}
          >
            {status.kind === 'soon' || status.kind === 'expired' ? (
              <AlertIcon className="h-5 w-5" />
            ) : (
              <ShieldIcon className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display-num text-[15px] font-bold uppercase tracking-wide text-[#F3F4F4]">
                Полис ОСАГО
              </span>
              <span
                className={`rounded-[6px] border px-2 py-0.5 text-[11px] font-bold ${styles.badge}`}
              >
                {styles.label}
              </span>
            </div>

            {status.kind === 'none' ? (
              <p className="mt-1 text-[12.5px] text-[#A9AFB7]">
                Укажите дату окончания страховки — приложение предупредит за 14 дней
              </p>
            ) : (
              <div className="mt-1 text-[13px]">
                <span className="font-semibold text-[#F3F4F4]">
                  Действует до {fmtDate(insuranceUntil!)}
                </span>
                <span className="mx-1.5 text-[#363B43]">•</span>
                <span
                  className={
                    status.kind === 'expired'
                      ? 'font-bold text-[#EF4444]'
                      : status.kind === 'soon'
                        ? 'font-bold text-[#F5A623]'
                        : 'text-[#A9AFB7]'
                  }
                >
                  {status.kind === 'expired'
                    ? `просрочен на ${fmtNumber(Math.abs(status.days))} ${plural(
                        Math.abs(status.days),
                        ['день', 'дня', 'дней'],
                      )}`
                    : `осталось ${fmtNumber(status.days)} ${plural(status.days, [
                        'день',
                        'дня',
                        'дней',
                      ])}`}
                </span>
              </div>
            )}
          </div>
        </div>

        <Button
          variant="secondary"
          className="min-h-[40px] px-3 py-1.5 text-[12.5px]"
          onClick={() => setEditing(true)}
        >
          {insuranceUntil ? 'Изменить дату' : 'Указать дату'}
        </Button>
      </div>

      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title="Срок действия полиса ОСАГО"
      >
        <div className="flex flex-col gap-3.5">
          <Field
            label="Дата окончания полиса"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <div className="flex gap-2.5">
            <Button onClick={() => void save()} disabled={saving} className="flex-1">
              <CheckIcon className="h-4 w-4" />
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </Button>
            {insuranceUntil && (
              <Button
                variant="danger"
                disabled={saving}
                onClick={() => {
                  setDate('')
                  void onSave(null).then(() => setEditing(false))
                }}
              >
                Очистить
              </Button>
            )}
          </div>
        </div>
      </Sheet>
    </Card>
  )
}

/* ------------------------- Форма редактирования паспорта авто ------------------------- */

function CarFormSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { car, saveCar } = useAppData()
  const [plate, setPlate] = useState('')
  const [vin, setVin] = useState('')
  const [mileage, setMileage] = useState('')
  const [initialMileage, setInitialMileage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !car) return
    setPlate(car.plate_number)
    setVin(car.vin_number)
    setMileage(String(car.current_mileage))
    setInitialMileage(String(car.initial_mileage ?? 0))
    setError('')
  }, [open, car])

  const submit = async () => {
    if (!plate.trim()) return setError('Укажите госномер')
    const km = Math.round(parseLocaleNumber(mileage))
    const initKm = Math.round(parseLocaleNumber(initialMileage || '0'))
    if (!Number.isFinite(km) || km < 0) return setError('Введите корректный текущий пробег')
    if (!Number.isFinite(initKm) || initKm < 0) {
      return setError('Введите корректный начальный пробег')
    }
    if (initKm > km) {
      return setError('Начальный пробег не может превышать текущий')
    }
    setSaving(true)
    try {
      await saveCar({
        plate_number: plate.trim().toUpperCase(),
        vin_number: vin.trim().toUpperCase(),
        current_mileage: km,
        initial_mileage: initKm,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить данные автомобиля')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Данные автомобиля">
      <div className="flex flex-col gap-3.5">
        <Field
          label="Госномер"
          placeholder="А 123 БВ 77"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
        />
        <Field
          label="VIN-номер"
          placeholder="XTA211500R1234567"
          value={vin}
          onChange={(e) => setVin(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Текущий пробег"
            suffix="км"
            inputMode="numeric"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
          />
          <Field
            label="Начальный пробег"
            suffix="км"
            inputMode="numeric"
            value={initialMileage}
            onChange={(e) => setInitialMileage(e.target.value)}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-[8px] border border-[#EF4444]/40 bg-[#EF4444]/12 px-3.5 py-2.5 text-[13px] font-medium text-[#EF4444]"
          >
            {error}
          </p>
        )}
        <Button onClick={() => void submit()} disabled={saving} className="mt-1 w-full">
          {saving ? 'Сохраняем…' : 'Сохранить паспорт авто'}
        </Button>
      </div>
    </Sheet>
  )
}

/* ------------------------- Форма добавления записи в журнал ТО ------------------------- */

function MaintenanceFormSheet({
  open,
  onClose,
  onAdd,
  defaultMileage,
}: {
  open: boolean
  onClose(): void
  onAdd: (record: { date: string; mileage: number; description: string }) => Promise<void>
  defaultMileage: number
}) {
  const [date, setDate] = useState(toDateInputValue(new Date()))
  const [mileage, setMileage] = useState(String(defaultMileage))
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDate(toDateInputValue(new Date()))
    setMileage(String(defaultMileage))
    setDescription('')
    setError('')
  }, [open, defaultMileage])

  const submit = async () => {
    const km = Math.round(parseLocaleNumber(mileage))
    if (!Number.isFinite(km) || km < 0) return setError('Укажите корректный пробег')
    if (!description.trim()) return setError('Опишите выполненные работы или заменённые детали')
    setSaving(true)
    try {
      await onAdd({ date, mileage: km, description: description.trim() })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить запись')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Новая запись в журнал ТО">
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Дата работ"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Field
            label="Пробег"
            suffix="км"
            inputMode="numeric"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
          />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-[#A9AFB7]">
            Выполненные работы и запчасти
          </span>
          <textarea
            rows={3}
            placeholder="Например: ТО-2, замена моторного масла 5W-40, масляного и салонного фильтров, проверка тормозных колодок"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-[10px] border border-[#363B43] bg-[#23272D] px-3.5 py-2.5 text-[14.5px] font-medium text-[#F3F4F4] outline-none transition-colors placeholder:font-normal placeholder:text-[#A9AFB7]/40 focus:border-[#E33337]"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-[8px] border border-[#EF4444]/40 bg-[#EF4444]/12 px-3.5 py-2.5 text-[13px] font-medium text-[#EF4444]"
          >
            {error}
          </p>
        )}
        <Button onClick={() => void submit()} disabled={saving} className="mt-1 w-full">
          {saving ? 'Сохраняем…' : 'Добавить в сервисную книжку'}
        </Button>
      </div>
    </Sheet>
  )
}
