import { useEffect, useMemo, useState } from 'react'
import Sheet from '../Sheet'
import { Button, Card, EmptyState, Field } from '../ui'
import { CardIcon } from '../icons'
import { useAppData } from '../../context/AppDataContext'
import { addMonths, monthsBetween, nextPaymentDate } from '../../utils/date'
import {
  fmtDate,
  fmtMoney,
  parseLocaleNumber,
  pluralMonths,
  toDateInputValue,
} from '../../utils/format'
import { annuityPayment, remainingBalance } from '../../utils/loan'
import type { Loan } from '../../types/domain'

/** Режим 1: «Мой график» — реальный кредит из БД + внесённые платежи из transactions */
export default function MySchedule() {
  const { loan, transactions, saveLoan, addTransaction, removeTransaction } = useAppData()
  const [formOpen, setFormOpen] = useState(false)
  const [marking, setMarking] = useState(false)

  const payments = useMemo(
    () => transactions.filter((t) => t.category === 'loan'),
    [transactions],
  )

  const stats = useMemo(() => {
    if (!loan) return null
    const paidCount = payments.length
    const remaining = remainingBalance(loan.total_amount, loan.interest_rate, loan.term_months, paidCount)
    const elapsed = Math.max(0, Math.min(loan.term_months, monthsBetween(new Date(loan.start_date + 'T00:00:00'), new Date())))
    const endDate = addMonths(new Date(loan.start_date + 'T00:00:00'), loan.term_months)
    const principalPaid = loan.total_amount - remaining
    const progress = loan.total_amount > 0 ? principalPaid / loan.total_amount : 0
    return {
      paidCount,
      remaining,
      elapsed,
      endDate,
      progress,
      monthsLeft: Math.max(0, loan.term_months - paidCount),
      dueNow: paidCount <= elapsed, // по графику уже мог быть внесён платёж
    }
  }, [loan, payments])

  const markPayment = async () => {
    if (!loan) return
    setMarking(true)
    try {
      await addTransaction({
        amount: loan.monthly_payment,
        category: 'loan',
        date: new Date().toISOString(),
        mileage_at_transaction: null,
      })
    } finally {
      setMarking(false)
    }
  }

  if (!loan) {
    return (
      <>
        <EmptyState
          icon={<CardIcon className="h-9 w-9" />}
          title="Кредит не подключён"
          text="Укажите параметры автокредита — приложение построит график и будет считать остаток долга по вашим платежам"
          action={
            <Button variant="secondary" onClick={() => setFormOpen(true)}>
              Добавить кредит
            </Button>
          }
        />
        <LoanFormSheet open={formOpen} onClose={() => setFormOpen(false)} loan={null} onSave={saveLoan} />
      </>
    )
  }

  const s = stats!

  return (
    <div className="flex flex-col gap-3">
      {/* Остаток долга */}
      <Card className="bg-lada! text-white">
        <p className="text-[12px] font-medium text-white/70">Остаток долга</p>
        <p className="text-[28px] font-extrabold leading-tight">{fmtMoney(s.remaining)}</p>
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-white/75">
            <span>Выплачено {s.paidCount} из {loan.term_months} платежей</span>
            <span>{Math.round(s.progress * 100)}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${Math.max(2, s.progress * 100)}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Параметры */}
      <Card className="grid grid-cols-2 gap-x-3 gap-y-4">
        <Param label="Ежемесячный платёж" value={fmtMoney(loan.monthly_payment)} />
        <Param label="Ставка" value={`${loan.interest_rate}%`} />
        <Param label="Сумма кредита" value={fmtMoney(loan.total_amount)} />
        <Param label="Срок" value={pluralMonths(loan.term_months)} />
        <Param label="Следующий платёж" value={fmtDate(nextPaymentDate(loan.start_date))} />
        <Param label="Полная выплата" value={fmtDate(s.endDate)} />
      </Card>

      <div className="flex gap-2.5">
        <Button onClick={markPayment} disabled={marking} className="flex-1">
          {marking ? 'Сохраняем…' : `Внести платёж ${fmtMoney(loan.monthly_payment)}`}
        </Button>
        <Button variant="secondary" onClick={() => setFormOpen(true)}>
          Изменить
        </Button>
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-muted">
        Платёж сохраняется в расходы (категория «Кредит»), остаток долга пересчитывается
        по аннуитетной формуле от числа внесённых платежей.
      </p>

      {/* Последние платежи */}
      {payments.length > 0 && (
        <Card className="p-0!">
          <p className="border-b border-black/[0.06] px-4 py-3 text-[13px] font-bold text-ink">
            История платежей
          </p>
          {payments.slice(0, 6).map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-[14px] font-semibold text-ink">{fmtMoney(p.amount)}</p>
                <p className="text-[11px] text-muted">{fmtDate(p.date)}</p>
              </div>
              <button
                onClick={() => {
                  if (window.confirm('Удалить этот платёж?')) void removeTransaction(p.id)
                }}
                className="text-[12px] font-medium text-muted transition-colors hover:text-danger"
              >
                Удалить
              </button>
            </div>
          ))}
        </Card>
      )}

      <LoanFormSheet open={formOpen} onClose={() => setFormOpen(false)} loan={loan} onSave={saveLoan} />
    </div>
  )
}

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-[15px] font-bold text-ink">{value}</p>
    </div>
  )
}

/** Форма создания/редактирования кредита */
function LoanFormSheet({
  open,
  onClose,
  loan,
  onSave,
}: {
  open: boolean
  onClose(): void
  loan: Loan | null
  onSave: (patch: Required<Pick<Loan, 'total_amount' | 'interest_rate' | 'monthly_payment' | 'term_months' | 'start_date'>>) => Promise<Loan>
}) {
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [payment, setPayment] = useState('')
  const [term, setTerm] = useState('')
  const [startDate, setStartDate] = useState(toDateInputValue(new Date()))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount(loan ? String(loan.total_amount) : '')
    setRate(loan ? String(loan.interest_rate) : '')
    setPayment(loan ? String(loan.monthly_payment) : '')
    setTerm(loan ? String(loan.term_months) : '')
    setStartDate(loan ? loan.start_date : toDateInputValue(new Date()))
    setError('')
  }, [open, loan])

  // автоподстановка платежа по аннуитету, если поле платежа пустое
  const tryAutoPayment = (a: string, r: string, n: string) => {
    const S = parseLocaleNumber(a)
    const R = parseLocaleNumber(r)
    const N = parseLocaleNumber(n)
    if (S > 0 && N > 0 && Number.isFinite(R)) {
      setPayment(String(Math.round(annuityPayment(S, R, N))))
    }
  }

  const submit = async () => {
    const S = parseLocaleNumber(amount)
    const R = parseLocaleNumber(rate)
    let P = parseLocaleNumber(payment)
    const N = Math.round(parseLocaleNumber(term))
    if (!(S > 0)) return setError('Введите сумму кредита')
    if (!(R >= 0)) return setError('Введите ставку')
    if (!(N > 0)) return setError('Введите срок в месяцах')
    if (!(P > 0)) {
      P = Math.round(annuityPayment(S, R, N) * 100) / 100
    }
    setSaving(true)
    try {
      await onSave({
        total_amount: S,
        interest_rate: R,
        monthly_payment: P,
        term_months: N,
        start_date: startDate,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={loan ? 'Изменить кредит' : 'Новый кредит'}>
      <div className="flex flex-col gap-3.5">
        <Field
          label="Сумма кредита"
          suffix="₽"
          inputMode="decimal"
          placeholder="1 050 000"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); tryAutoPayment(e.target.value, rate, term) }}
        />
        <Field
          label="Ставка, % годовых"
          suffix="%"
          inputMode="decimal"
          placeholder="16.9"
          value={rate}
          onChange={(e) => { setRate(e.target.value); tryAutoPayment(amount, e.target.value, term) }}
        />
        <Field
          label="Срок"
          suffix="мес"
          inputMode="numeric"
          placeholder="60"
          value={term}
          onChange={(e) => { setTerm(e.target.value); tryAutoPayment(amount, rate, e.target.value) }}
        />
        <Field
          label="Ежемесячный платёж"
          suffix="₽"
          inputMode="decimal"
          placeholder="Рассчитается автоматически"
          hint="Оставьте пустым — посчитаем по аннуитетной формуле"
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
        />
        <Field label="Дата начала кредита" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        {error && (
          <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13px] font-medium text-danger">{error}</p>
        )}
        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? 'Сохраняем…' : 'Сохранить кредит'}
        </Button>
      </div>
    </Sheet>
  )
}
