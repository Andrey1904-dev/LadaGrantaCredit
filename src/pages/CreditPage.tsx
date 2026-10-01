import { useMemo, useState } from 'react'
import { SegmentedControl } from '../components/ui'
import PageHero, { HeroChip } from '../components/PageHero'
import MySchedule from '../components/credit/MySchedule'
import Modeling from '../components/credit/Modeling'
import Prepayment from '../components/credit/Prepayment'
import { useAppData } from '../context/AppDataContext'
import { PAGE_MEDIA } from '../lib/assets'
import { CalendarIcon, CardIcon, PercentIcon } from '../components/icons'
import { nextPaymentDate } from '../utils/date'
import { fmtDate, fmtMoney } from '../utils/format'
import { remainingBalance } from '../utils/loan'

/** Вкладка 2: Кредит — «Мой график» (БД) и «Моделирование» (локальные расчёты и ПДН) */
export default function CreditPage() {
  const [tab, setTab] = useState<'schedule' | 'prepay' | 'modeling'>('schedule')
  const { loan, transactions } = useAppData()

  const stats = useMemo(() => {
    if (!loan) return null
    const paid = transactions.filter((t) => t.category === 'loan').length
    return {
      paid,
      remaining: remainingBalance(loan.total_amount, loan.interest_rate, loan.term_months, paid, loan.monthly_payment),
      next: nextPaymentDate(loan.start_date),
    }
  }, [loan, transactions])

  return (
    <div className="animate-pop-in flex flex-col gap-4">
      <PageHero
        media={PAGE_MEDIA.credit}
        eyebrow="Автокредит"
        title="Управление автокредитом"
        subtitle="Аннуитетный график с остатком долга, расчётом досрочного погашения и калькулятором долговой нагрузки."
        priority
        chips={
          stats && loan ? (
            <>
              <HeroChip
                icon={<CardIcon className="h-3.5 w-3.5" />}
                label="Платёж"
                value={fmtMoney(loan.monthly_payment)}
              />
              <HeroChip
                icon={<CalendarIcon className="h-3.5 w-3.5" />}
                label="Следующий"
                value={fmtDate(stats.next)}
              />
              <HeroChip
                icon={<PercentIcon className="h-3.5 w-3.5" />}
                label="Остаток"
                value={fmtMoney(stats.remaining)}
                tone={stats.remaining === 0 ? 'success' : 'default'}
              />
            </>
          ) : (
            <HeroChip
              icon={<CardIcon className="h-3.5 w-3.5" />}
              label="Кредит"
              value="не подключён"
              tone="warn"
            />
          )
        }
      />

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'schedule', label: 'Мой график' },
          { value: 'prepay', label: 'Досрочно' },
          { value: 'modeling', label: 'Подбор и ПДН' },
        ]}
      />

      <div key={tab} className="animate-pop-in">
        {tab === 'schedule' && <MySchedule />}
        {tab === 'prepay' && <Prepayment />}
        {tab === 'modeling' && <Modeling />}
      </div>
    </div>
  )
}
