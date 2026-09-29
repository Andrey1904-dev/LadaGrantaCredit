import { useMemo, useState } from 'react'
import { Button, Card, Field, InfoTip } from '../ui'
import { useAppData } from '../../context/AppDataContext'
import { fmtMoney, parseLocaleNumber } from '../../utils/format'
import {
  annuityPayment,
  principalFromPayment,
  rateFromPayment,
  termFromPayment,
} from '../../utils/loan'
import { PercentIcon, RefreshIcon } from '../icons'

type CalcField = 'amount' | 'rate' | 'payment' | 'term'

const FIELD_ORDER: CalcField[] = ['amount', 'rate', 'payment', 'term']

/**
 * Режим 2: «Моделирование» — чистый клиентский стейт без записи в БД.
 * 1) Калькулятор подбора: заполняете любые 3 из 4 полей, 4-е вычисляется автоматически
 *    (ставка находится численно методом бисекции).
 * 2) Калькулятор ПДН со шкалой 0–100% и порогами 30% и 50%.
 */
export default function Modeling() {
  return (
    <div className="flex flex-col gap-4">
      <SolverCalculator />
      <PdnCalculator />
    </div>
  )
}

/* ------------------------- Калькулятор подбора 4-го поля ------------------------- */

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
  const solve = (
    target: CalcField,
    v: Record<CalcField, string>,
  ): { text: string; err: string } => {
    const S = parseLocaleNumber(v.amount)
    const R = parseLocaleNumber(v.rate)
    const P = parseLocaleNumber(v.payment)
    const N = parseLocaleNumber(v.term)
    switch (target) {
      case 'payment': {
        const p = annuityPayment(S, R, N)
        return Number.isFinite(p)
          ? { text: String(Math.round(p)), err: '' }
          : { text: '', err: 'Проверьте сумму, ставку и срок кредита' }
      }
      case 'term': {
        const n = termFromPayment(S, R, P)
        if (!Number.isFinite(n)) {
          return {
            text: '',
            err: 'Платёж не покрывает даже ежемесячные проценты — увеличьте платёж или снизьте ставку',
          }
        }
        return { text: String(Math.ceil(n)), err: '' }
      }
      case 'amount': {
        const s = principalFromPayment(P, R, N)
        return Number.isFinite(s)
          ? { text: String(Math.round(s)), err: '' }
          : { text: '', err: 'Проверьте платёж, ставку и срок' }
      }
      case 'rate': {
        const r = rateFromPayment(S, P, N)
        return Number.isFinite(r)
          ? { text: (Math.round(r * 100) / 100).toString(), err: '' }
          : { text: '', err: 'Не удалось подобрать процентную ставку' }
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
    const p = Math.round(annuityPayment(loan.total_amount, loan.interest_rate, loan.term_months))
    setGiven(['amount', 'rate', 'term'])
    setComputed('payment')
    setValues({
      amount: String(loan.total_amount),
      rate: String(loan.interest_rate),
      payment: String(p),
      term: String(loan.term_months),
    })
    setError('')
  }

  const clearAll = () => {
    setValues({ amount: '', rate: '', payment: '', term: '' })
    setGiven([])
    setComputed(null)
    setError('')
  }

  const summary = useMemo(() => {
    const S = parseLocaleNumber(values.amount)
    const P = parseLocaleNumber(values.payment)
    const N = parseLocaleNumber(values.term)
    if (!(S > 0 && P > 0 && N > 0)) return null
    const totalPaid = P * N
    const overpay = Math.max(0, totalPaid - S)
    return { totalPaid, overpay }
  }, [values])

  const labels: Record<
    CalcField,
    { label: string; suffix: string; placeholder: string; inputMode: 'numeric' | 'decimal' }
  > = {
    amount: {
      label: 'Сумма кредита',
      suffix: '₽',
      placeholder: '1 050 000',
      inputMode: 'numeric',
    },
    rate: {
      label: 'Ставка, % годовых',
      suffix: '%',
      placeholder: '16.9',
      inputMode: 'decimal',
    },
    payment: {
      label: 'Ежемесячный платёж',
      suffix: '₽',
      placeholder: '26 040',
      inputMode: 'numeric',
    },
    term: {
      label: 'Срок кредита',
      suffix: 'мес',
      placeholder: '60',
      inputMode: 'numeric',
    },
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#363B43] bg-[#23272D]/60 px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-[#E33337]" aria-hidden="true" />
            <h3 className="font-display-num text-[16px] font-bold uppercase tracking-wide text-[#F3F4F4]">
              Подбор параметров кредита
            </h3>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[#A9AFB7]">
            Заполните любые 3 поля — четвёртое рассчитается автоматически (ставка ищется бисекцией)
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {loan && (
            <button
              type="button"
              onClick={fillFromLoan}
              className="min-h-[38px] rounded-[8px] border border-[#363B43] bg-[#1A1D22] px-3 py-1.5 text-[12px] font-semibold text-[#F3F4F4] transition-colors hover:border-[#E33337]"
            >
              Из моего кредита
            </button>
          )}
          {(given.length > 0 || computed) && (
            <button
              type="button"
              onClick={clearAll}
              aria-label="Сбросить поля калькулятора"
              className="flex min-h-[38px] items-center gap-1 rounded-[8px] border border-[#363B43] bg-[#1A1D22] px-2.5 py-1.5 text-[12px] font-semibold text-[#A9AFB7] transition-colors hover:text-[#F3F4F4]"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              Сброс
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {FIELD_ORDER.map((f) => {
            const meta = labels[f]
            const isComputed = computed === f
            return (
              <Field
                key={f}
                label={meta.label}
                suffix={meta.suffix}
                placeholder={meta.placeholder}
                inputMode={meta.inputMode}
                value={values[f]}
                highlighted={isComputed}
                badge={isComputed ? 'Расчёт' : undefined}
                onChange={(e) => handleChange(f, e.target.value)}
              />
            )
          })}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-3.5 rounded-[8px] border border-[#EF4444]/40 bg-[#EF4444]/12 px-3.5 py-2.5 text-[12.5px] font-medium text-[#EF4444]"
          >
            {error}
          </div>
        )}

        {summary && !error && (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-[8px] border border-[#363B43] bg-[#0E1013]/80 p-3.5">
            <div>
              <p className="text-[11px] font-medium text-[#A9AFB7]">Итого выплат за весь срок</p>
              <p className="font-display-num mt-0.5 text-[18px] font-bold text-[#F3F4F4]">
                {fmtMoney(summary.totalPaid)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#A9AFB7]">Переплата по процентам</p>
              <p className="font-display-num mt-0.5 text-[18px] font-bold text-[#E33337]">
                +{fmtMoney(summary.overpay)}
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

/* ------------------------- Калькулятор ПДН (30% / 50%) ------------------------- */

function PdnCalculator() {
  const { loan } = useAppData()
  const [income, setIncome] = useState('115000')
  const [otherPayments, setOtherPayments] = useState('0')
  const [thisPayment, setThisPayment] = useState(() =>
    loan ? String(Math.round(loan.monthly_payment)) : '26040',
  )

  const inc = parseLocaleNumber(income)
  const other = Math.max(0, parseLocaleNumber(otherPayments) || 0)
  const curr = Math.max(0, parseLocaleNumber(thisPayment) || 0)
  const totalMonthlyDebt = other + curr

  const pdn = useMemo(() => {
    if (!(inc > 0)) return null
    return (totalMonthlyDebt / inc) * 100
  }, [inc, totalMonthlyDebt])

  const zone: 'safe' | 'warn' | 'danger' | null = useMemo(() => {
    if (pdn === null) return null
    if (pdn < 30) return 'safe'
    if (pdn <= 50) return 'warn'
    return 'danger'
  }, [pdn])

  const zoneConfig = {
    safe: {
      color: '#16B374',
      badge: 'Комфортная нагрузка (< 30%)',
      text: 'Долговая нагрузка в зелёной зоне: платежи занимают менее 30% ежемесячного дохода.',
    },
    warn: {
      color: '#F5A623',
      badge: 'Повышенная нагрузка (30–50%)',
      text: 'Умеренная зона риска: от 30% до 50% дохода уходит на кредиты. Рекомендуется финансовый резерв.',
    },
    danger: {
      color: '#EF4444',
      badge: 'Критическая нагрузка (> 50%)',
      text: 'Свыше 50% дохода уходит на платежи — высокая вероятность отказа банка и кассового разрыва.',
    },
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="border-b border-[#363B43] bg-[#23272D]/60 px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <PercentIcon className="h-4 w-4 text-[#E33337]" />
          <h3 className="font-display-num text-[16px] font-bold uppercase tracking-wide text-[#F3F4F4]">
            Показатель долговой нагрузки (ПДН)
          </h3>
          <InfoTip title="ПДН">
            ПДН = сумма всех ежемесячных платежей по кредитам ÷ ваш среднемесячный доход × 100 %.
            Банк считает его сам по данным бюро кредитных историй и обязан учитывать с 2023 года:
            при ПДН выше 50 % кредит выдают неохотно и с надбавкой к ставке, выше 80 % — почти
            всегда отказ. До 30 % — комфортная зона, когда платёж не мешает жить.
          </InfoTip>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-[#A9AFB7]">
          Оценка доли ежемесячного дохода, уходящей на обслуживание всех кредитов (пороги ЦБ: 30% и 50%)
        </p>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <Field
            label="Ваш доход в месяц"
            suffix="₽"
            inputMode="numeric"
            placeholder="115 000"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
          />
          <Field
            label="Другие кредиты"
            suffix="₽"
            inputMode="numeric"
            placeholder="0"
            value={otherPayments}
            onChange={(e) => setOtherPayments(e.target.value)}
          />
          <Field
            label="Платёж по автокредиту"
            suffix="₽"
            inputMode="numeric"
            placeholder="26 040"
            value={thisPayment}
            onChange={(e) => setThisPayment(e.target.value)}
          />
        </div>

        {loan && (
          <div className="mt-2.5 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              className="min-h-[36px] px-2.5 py-1 text-[12px]"
              onClick={() => setThisPayment(String(Math.round(loan.monthly_payment)))}
            >
              Подставить мой платёж ({fmtMoney(loan.monthly_payment)})
            </Button>
          </div>
        )}

        {/* Блок шкалы ПДН 0–100% с отметками 30% и 50% */}
        <div className="mt-4 rounded-[10px] border border-[#363B43] bg-[#0E1013] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#A9AFB7]">
                Расчётный ПДН
              </span>
              <p
                className="font-display-num mt-0.5 text-[30px] font-bold leading-none"
                style={{ color: zone ? zoneConfig[zone].color : '#F3F4F4' }}
              >
                {pdn === null ? '—' : `${Math.min(999, Math.round(pdn))}%`}
              </p>
            </div>
            {zone && (
              <span
                className="rounded-[6px] border px-2.5 py-1 text-[11.5px] font-bold"
                style={{
                  borderColor: `${zoneConfig[zone].color}55`,
                  backgroundColor: `${zoneConfig[zone].color}18`,
                  color: zoneConfig[zone].color,
                }}
              >
                {zoneConfig[zone].badge}
              </span>
            )}
          </div>

          {/* 3-зонная шкала с порогами 30% и 50% */}
          <div className="relative mt-4">
            <div className="grid h-3 w-full grid-cols-[30fr_20fr_50fr] overflow-hidden rounded-full border border-[#363B43] bg-[#1A1D22]">
              <div className="bg-[#16B374]/80" title="До 30% — безопасная зона" />
              <div className="border-x border-[#0E1013] bg-[#F5A623]/80" title="30–50% — умеренная нагрузка" />
              <div className="bg-[#EF4444]/80" title="Свыше 50% — высокая нагрузка" />
            </div>

            {/* Маркер текущего значения */}
            {pdn !== null && (
              <div
                className="pointer-events-none absolute -top-1.5 h-6 w-1.5 -translate-x-1/2 rounded-full bg-[#F3F4F4] shadow-[0_0_0_2px_#0E1013] transition-all duration-200"
                style={{ left: `${Math.min(100, Math.max(0, pdn))}%` }}
                aria-hidden="true"
              />
            )}
          </div>

          {/* Подписи порогов */}
          <div className="relative mt-1.5 h-4 text-[11px] font-mono font-semibold text-[#A9AFB7]">
            <span className="absolute left-0">0%</span>
            <span className="absolute left-[30%] -translate-x-1/2 text-[#16B374]">30%</span>
            <span className="absolute left-[50%] -translate-x-1/2 text-[#F5A623]">50%</span>
            <span className="absolute right-0 text-[#EF4444]">100%</span>
          </div>

          {zone ? (
            <div className="mt-3 border-t border-[#363B43]/70 pt-2.5 text-[12.5px] leading-relaxed text-[#A9AFB7]">
              Суммарный платёж <strong className="text-[#F3F4F4]">{fmtMoney(totalMonthlyDebt)}</strong> в месяц.{' '}
              {zoneConfig[zone].text}
            </div>
          ) : (
            <p className="mt-3 border-t border-[#363B43]/70 pt-2.5 text-[12.5px] text-[#A9AFB7]">
              Укажите ваш ежемесячный доход, чтобы рассчитать ПДН и увидеть зону нагрузки.
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
