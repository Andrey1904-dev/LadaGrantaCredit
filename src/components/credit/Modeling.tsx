import { useMemo, useState } from 'react'
import { Button, Card, Field, SectionTitle } from '../ui'
import { useAppData } from '../../context/AppDataContext'
import { fmtMoney, parseLocaleNumber } from '../../utils/format'
import {
  annuityPayment,
  principalFromPayment,
  rateFromPayment,
  termFromPayment,
} from '../../utils/loan'

type CalcField = 'amount' | 'rate' | 'payment' | 'term'

const FIELD_ORDER: CalcField[] = ['amount', 'rate', 'payment', 'term']

/**
 * Режим 2: «Моделирование» — чистый клиентский стейт, без записи в БД.
 * Калькулятор подбора: пользователь заполняет любые 3 из 4 полей,
 * четвёртое вычисляется автоматически по аннуитетной формуле.
 */
export default function Modeling() {
  return (
    <div className="flex flex-col gap-3">
      <SolverCalculator />
      <PdnCalculator />
    </div>
  )
}

/* ------------------------- Калькулятор подбора ------------------------- */

function SolverCalculator() {
  const { loan } = useAppData()
  const [values, setValues] = useState<Record<CalcField, string>>({
    amount: '',
    rate: '',
    payment: '',
    term: '',
  })
  /** Поля, заполненные пользователем, в порядке ввода */
  const [given, setGiven] = useState<CalcField[]>([])
  const [computed, setComputed] = useState<CalcField | null>(null)
  const [error, setError] = useState('')

  /** Вычисляет недостающее поле из трёх заданных */
  const solve = (target: CalcField, v: Record<CalcField, string>): { text: string; err: string } => {
    const S = parseLocaleNumber(v.amount)
    const R = parseLocaleNumber(v.rate)
    const P = parseLocaleNumber(v.payment)
    const N = parseLocaleNumber(v.term)
    switch (target) {
      case 'payment': {
        const p = annuityPayment(S, R, N)
        return Number.isFinite(p)
          ? { text: String(Math.round(p)), err: '' }
          : { text: '', err: 'Проверьте сумму и срок' }
      }
      case 'term': {
        const n = termFromPayment(S, R, P)
        if (!Number.isFinite(n)) return { text: '', err: 'Платёж не покрывает даже проценты — увеличьте его или снизьте ставку' }
        return { text: String(Math.ceil(n)), err: '' }
      }
      case 'amount': {
        const s = principalFromPayment(P, R, N)
        return Number.isFinite(s)
          ? { text: String(Math.round(s)), err: '' }
          : { text: '', err: 'Проверьте платёж и срок' }
      }
      case 'rate': {
        const r = rateFromPayment(S, P, N)
        return Number.isFinite(r)
          ? { text: (Math.round(r * 100) / 100).toString(), err: '' }
          : { text: '', err: 'Не удалось подобрать ставку' }
      }
    }
  }

  const handleChange = (field: CalcField, text: string) => {
    const next = { ...values, [field]: text }
    let order = given.filter((f) => f !== field)
    if (text.trim() !== '') order.push(field)

    if (order.length >= 3) {
      let target: CalcField
      if (order.length === 3) {
        // вычисляем единственное незаполненное поле
        target = FIELD_ORDER.find((f) => !order.includes(f))!
      } else {
        // пользователь отредактировал ранее вычисленное поле —
        // «отпускаем» самое давно заданное поле, оно станет вычисляемым
        target = order[0]
        order = order.slice(1)
      }
      const res = solve(target, next)
      next[target] = res.text
      setValues(next)
      setError(res.err)
      setComputed(target)
      setGiven(order)
    } else {
      // данных недостаточно — очищаем прежнее вычисленное значение
      if (computed) next[computed] = ''
      setValues(next)
      setComputed(null)
      setError('')
      setGiven(order)
    }
  }

  const fillFromLoan = () => {
    if (!loan) return
    setValues({
      amount: String(loan.total_amount),
      rate: String(loan.interest_rate),
      payment: '',
      term: String(loan.term_months),
    })
    setGiven(['amount', 'rate', 'term'])
    setComputed('payment')
    setValues({
      amount: String(loan.total_amount),
      rate: String(loan.interest_rate),
      payment: String(Math.round(annuityPayment(loan.total_amount, loan.interest_rate, loan.term_months))),
      term: String(loan.term_months),
    })
    setError('')
  }

  const labels: Record<CalcField, { label: string; suffix: string; placeholder: string }> = {
    amount: { label: 'Сумма кредита', suffix: '₽', placeholder: '1 050 000' },
    rate: { label: 'Ставка, % годовых', suffix: '%', placeholder: '16.9' },
    payment: { label: 'Ежемесячный платёж', suffix: '₽', placeholder: '26 000' },
    term: { label: 'Срок кредита', suffix: 'мес', placeholder: '60' },
  }

  return (
    <Card className="p-0! overflow-hidden">
      <div className="flex items-start justify-between px-4 pt-4">
        <div>
          <h3 className="text-[15px] font-bold text-ink">Подбор кредита</h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
            Заполните любые 3 поля — четвёртое посчитается автоматически
          </p>
        </div>
        {loan && (
          <Button variant="secondary" className="px-3! py-2! text-[12px] whitespace-nowrap" onClick={fillFromLoan}>
            Мой кредит
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-3 px-4 pb-4">
        {FIELD_ORDER.map((field) => {
          const isComputed = computed === field
          return (
            <div key={field} className="relative">
              <Field
                label={labels[field].label}
                suffix={labels[field].suffix}
                inputMode="decimal"
                placeholder={labels[field].placeholder}
                value={values[field]}
                onChange={(e) => handleChange(field, e.target.value)}
                className={isComputed ? '[&_input]:border-lada! [&_input]:bg-lada-light! [&_input]:font-bold [&_input]:text-lada!' : ''}
              />
              {isComputed && (
                <span className="absolute right-0 top-0 rounded-full bg-lada px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  расчёт
                </span>
              )}
            </div>
          )
        })}
        {error && (
          <p className="rounded-xl bg-warning/10 px-3.5 py-2.5 text-[13px] font-medium text-[#9a6700]">
            {error}
          </p>
        )}
      </div>
    </Card>
  )
}

/* ------------------------- Калькулятор ПДН ------------------------- */

function PdnCalculator() {
  const { loan } = useAppData()
  const [income, setIncome] = useState('')
  const [otherPayments, setOtherPayments] = useState('')
  const [thisPayment, setThisPayment] = useState(loan ? String(Math.round(loan.monthly_payment)) : '')

  const pdn = useMemo(() => {
    const inc = parseLocaleNumber(income)
    const other = parseLocaleNumber(otherPayments) || 0
    const current = parseLocaleNumber(thisPayment) || 0
    if (!(inc > 0)) return null
    return ((other + current) / inc) * 100
  }, [income, otherPayments, thisPayment])

  const zone = pdn === null ? null : pdn < 30 ? 'green' : pdn <= 50 ? 'yellow' : 'red'
  const zoneText = {
    green: 'Комфортная нагрузка — платежи ниже 30% дохода',
    yellow: 'Повышенная нагрузка (30–50%) — банк может запросить подтверждение дохода',
    red: 'Высокая нагрузка (>50%) — велика вероятность отказа и риск просрочек',
  } as const
  const zoneColor = { green: '#12A76D', yellow: '#F5A623', red: '#E23D3D' } as const

  return (
    <>
      <SectionTitle>Показатель долговой нагрузки (ПДН)</SectionTitle>
      <Card className="flex flex-col gap-3.5">
        <Field
          label="Ежемесячный доход семьи"
          suffix="₽"
          inputMode="decimal"
          placeholder="120 000"
          value={income}
          onChange={(e) => setIncome(e.target.value)}
        />
        <Field
          label="Платежи по другим кредитам"
          suffix="₽"
          inputMode="decimal"
          placeholder="0"
          value={otherPayments}
          onChange={(e) => setOtherPayments(e.target.value)}
        />
        <Field
          label="Платёж по этому кредиту"
          suffix="₽"
          inputMode="decimal"
          placeholder={loan ? String(Math.round(loan.monthly_payment)) : '26 000'}
          value={thisPayment}
          onChange={(e) => setThisPayment(e.target.value)}
        />

        {/* Шкала ПДН 0–100% с зонами */}
        <div className="mt-1">
          <div className="flex justify-between text-[11px] font-medium text-muted">
            <span>ПДН</span>
            <span className="text-base font-extrabold" style={{ color: zone ? zoneColor[zone] : '#6B7280' }}>
              {pdn === null ? '—' : `${Math.min(999, Math.round(pdn))}%`}
            </span>
          </div>
          <div className="relative mt-1.5 h-3.5 w-full overflow-hidden rounded-full">
            <div className="absolute inset-0 flex">
              <div className="h-full bg-success/25" style={{ width: '30%' }} />
              <div className="h-full bg-warning/25" style={{ width: '20%' }} />
              <div className="h-full bg-danger/25" style={{ width: '50%' }} />
            </div>
            {pdn !== null && (
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, pdn)}%`, backgroundColor: zoneColor[zone!] }}
              />
            )}
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-medium text-muted">
            <span>0%</span>
            <span>30%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
          {zone && (
            <p
              className="mt-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-medium"
              style={{ backgroundColor: `${zoneColor[zone]}1a`, color: zone === 'yellow' ? '#9a6700' : zoneColor[zone] }}
            >
              {fmtMoney((parseLocaleNumber(otherPayments) || 0) + (parseLocaleNumber(thisPayment) || 0))} в месяц — {zoneText[zone]}
            </p>
          )}
          {pdn === null && (
            <p className="mt-2.5 text-[12px] text-muted">
              Укажите доход, чтобы увидеть, какую долю бюджета забирают кредиты
            </p>
          )}
        </div>
      </Card>
    </>
  )
}
