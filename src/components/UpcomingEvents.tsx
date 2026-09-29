import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, SectionTitle } from './ui'
import {
  BellIcon,
  CardIcon,
  ChecklistIcon,
  LicenseIcon,
  ShieldIcon,
  TaxIcon,
  TyreIcon,
  WrenchIcon,
} from './icons'
import { useAppData } from '../context/AppDataContext'
import { useSettings } from '../lib/settings'
import { buildServicePlan, engineInfo } from '../lib/service'
import { taxDueDate, taxRateFor, transportTax } from '../lib/tax'
import { daysUntil, nextPaymentDate } from '../utils/date'
import { fmtDate, fmtMoney, plural, toDateInputValue } from '../utils/format'

interface OwnerEvent {
  id: string
  title: string
  note: string
  date: string
  days: number
  href: string
  icon: React.ReactNode
}

/**
 * Календарь владельца: всё, что скоро потребует денег или действий —
 * платёж по кредиту, ОСАГО, диагностическая карта, права, транспортный налог,
 * сезонная смена шин и ближайшая работа по регламенту. Это самый частый запрос
 * к автомобильным приложениям: «напомни вовремя, чтобы не попасть на штраф».
 */
export default function UpcomingEvents() {
  const { car, loan, maintenance } = useAppData()
  const [settings] = useSettings()

  const events = useMemo(() => {
    const list: OwnerEvent[] = []
    const push = (e: Omit<OwnerEvent, 'days'>) => {
      const days = daysUntil(e.date)
      if (days < -45) return // совсем старое не показываем
      list.push({ ...e, days })
    }

    if (loan) {
      const next = toDateInputValue(nextPaymentDate(loan.start_date))
      push({
        id: 'loan',
        title: 'Платёж по кредиту',
        note: fmtMoney(loan.monthly_payment),
        date: next,
        href: '/credit',
        icon: <CardIcon className="h-4 w-4" />,
      })
    }

    if (car?.insurance_until) {
      push({
        id: 'osago',
        title: 'Полис ОСАГО',
        note: 'продление',
        date: car.insurance_until,
        href: '/garage',
        icon: <ShieldIcon className="h-4 w-4" />,
      })
    }

    if (settings.inspectionUntil) {
      push({
        id: 'inspection',
        title: 'Диагностическая карта',
        note: 'техосмотр',
        date: settings.inspectionUntil,
        href: '/service',
        icon: <ChecklistIcon className="h-4 w-4" />,
      })
    }

    if (settings.licenseUntil) {
      push({
        id: 'license',
        title: 'Водительские права',
        note: 'замена по сроку',
        date: settings.licenseUntil,
        href: '/service',
        icon: <LicenseIcon className="h-4 w-4" />,
      })
    }

    // транспортный налог — до 1 декабря
    const engine = engineInfo(settings.engine)
    const rate = settings.taxRateOverride ?? taxRateFor(settings.taxRegion, engine.power)
    push({
      id: 'tax',
      title: 'Транспортный налог',
      note: `≈ ${fmtMoney(transportTax(engine.power, rate))}`,
      date: toDateInputValue(taxDueDate()),
      href: '/service',
      icon: <TaxIcon className="h-4 w-4" />,
    })

    // сезонная переобувка: ориентир — начало ноября и середина апреля
    const now = new Date()
    const year = now.getFullYear()
    const swap =
      settings.tyreSeason === 'summer'
        ? new Date(year, 10, 1) // на зиму
        : new Date(year, 3, 15) // на лето
    if (swap.getTime() < now.getTime()) swap.setFullYear(year + 1)
    push({
      id: 'tyres',
      title: settings.tyreSeason === 'summer' ? 'Переобуться в зиму' : 'Переобуться в лето',
      note: 'шины и балансировка',
      date: toDateInputValue(swap),
      href: '/service',
      icon: <TyreIcon className="h-4 w-4" />,
    })

    // ближайшая работа ТО, у которой есть срок по времени
    if (car) {
      const plan = buildServicePlan({
        mileage: car.current_mileage,
        mode: settings.planMode,
        engine: settings.engine,
        maintenance,
        purchaseDate: settings.purchaseDate,
      })
      const dated = plan.find((s) => s.dueDate !== null && s.state !== 'ok')
      if (dated?.dueDate) {
        push({
          id: 'service',
          title: dated.item.title,
          note: 'по регламенту',
          date: dated.dueDate,
          href: '/service',
          icon: <WrenchIcon className="h-4 w-4" />,
        })
      }
    }

    return list.sort((a, b) => a.days - b.days).slice(0, 5)
  }, [car, loan, maintenance, settings])

  if (events.length === 0) return null

  return (
    <section aria-label="Ближайшие события">
      <SectionTitle
        tip={
          <>
            Сюда попадают ближайшие сроки: дата следующего платежа по кредиту, окончание ОСАГО и
            диагностической карты, срок водительских прав, 1 декабря для транспортного налога,
            ориентир сезонной переобувки (ноябрь и апрель) и ближайшая работа из плана ТО.
            Даты берутся из карточки автомобиля и настроек раздела «ТО» — что не заполнено, то
            здесь и не показывается.
          </>
        }
        action={
          <span className="inline-flex items-center gap-1 text-[11.5px] text-[#A9AFB7]">
            <BellIcon className="h-3.5 w-3.5" />
            напоминания
          </span>
        }
      >
        Ближайшие события
      </SectionTitle>
      <Card className="flex flex-col divide-y divide-[#363B43]/70 p-0">
        {events.map((e) => {
          const overdue = e.days < 0
          const soon = e.days >= 0 && e.days <= 14
          const color = overdue ? '#EF4444' : soon ? '#F5A623' : '#A9AFB7'
          return (
            <Link
              key={e.id}
              to={e.href}
              className="flex min-h-[56px] items-center gap-3 px-3.5 py-2.5 transition-colors first:rounded-t-[10px] last:rounded-b-[10px] hover:bg-[#23272D]"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
                style={{ backgroundColor: `${color}1F`, color }}
              >
                {e.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-[#F3F4F4]">
                  {e.title}
                </span>
                <span className="block truncate text-[11.5px] text-[#A9AFB7]">
                  {e.note} · {fmtDate(e.date)}
                </span>
              </span>
              <span
                className="font-display-num shrink-0 text-right text-[12px] font-bold"
                style={{ color }}
              >
                {overdue
                  ? `просрочено на ${Math.abs(e.days)} ${plural(Math.abs(e.days), ['день', 'дня', 'дней'])}`
                  : e.days === 0
                    ? 'сегодня'
                    : `через ${e.days} ${plural(e.days, ['день', 'дня', 'дней'])}`}
              </span>
            </Link>
          )
        })}
      </Card>
    </section>
  )
}
