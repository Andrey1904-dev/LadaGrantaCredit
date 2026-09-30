import { useEffect, useMemo, useState } from 'react'
import Sheet from '../Sheet'
import { Button, Card, EmptyState, Field } from '../ui'
import { CalendarIcon, CardIcon, CheckIcon, EditIcon, TrashIcon } from '../icons'
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
import { confirmAction } from '../../lib/telegram-mini-app'

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
    const remaining = remainingBalance(
      loan.total_amount,
      loan.interest_rate,
      loan.term_months,
      paidCount,
      loan.monthly_payment,
    )
    const elapsed = Math.max(
      0,
      Math.min(
        loan.term_months,
        monthsBetween(new Date(loan.start_date + 'T00:00:00'), new Date()),
      ),
    )
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
      dueNow: paidCount <= elapsed,
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
          showSportDetail
          icon={<CardIcon className="h-6 w-6" />}
          title="Кредит не подключён"
          text="Укажите параметры автокредита — приложение построит график и будет считать остаток долга по вашим платежам"
          action={
            <Button onClick={() => setFormOpen(true)}>
              Добавить параметры кредита
            </Button>
          }
        />
        <LoanFormSheet
          open={formOpen}
          onClose={() => setFormOpen(false)}
          loan={null}
          onSave={saveLoan}
        />
      </>
    )
  }

  const s = stats!
  const nextDate = nextPaymentDate(loan.start_date)

  return (
    <div className="flex flex-col gap-3.5">
      {/* Главный технический блок остатка долга */}
      <Card className="relative overflow-hidden border-[#363B43] bg-gradient-to-b from-[#23272D] to-[#1A1D22] p-5">
        <span
          className="absolute inset-y-0 left-0 w-1 bg-[#E33337]"
          aria-hidden="true"
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-wider text-[#A9AFB7]">
              Остаток основного долга
            </p>
            <p className="font-display-num mt-1 text-[34px] font-bold leading-none text-[#F3F4F4] sm:text-[38px]">
              {fmtMoney(s.remaining)}
            </p>
          </div>
          <div className="rounded-[8px] border border-[#363B43] bg-[#0E1013]/70 px-3 py-1.5 text-right">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
              Статус графика
            </p>
            <p
              className={`mt-0.5 text-[12.5px] font-bold ${
                s.dueNow ? 'text-[#F5A623]' : 'text-[#16B374]'
              }`}
            >
              {s.dueNow ? 'Ожидается платёж' : 'По графику'}
            </p>
          </div>
        </div>

        {/* Шкала погашения тела кредита */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[12px] font-semibold text-[#A9AFB7]">
            <span>
              Внесено <strong className="text-[#F3F4F4]">{s.paidCount}</strong> из{' '}
              <strong className="text-[#F3F4F4]">{loan.term_months}</strong> платежей
            </span>
            <span className="font-display-num text-[15px] font-bold text-[#F3F4F4]">
              {Math.round(s.progress * 100)}%
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-[#363B43] bg-[#0E1013]">
            <div
              className="h-full rounded-full bg-[#E33337] transition-all duration-240"
              style={{ width: `${Math.min(100, Math.max(2, s.progress * 100))}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-[#A9AFB7]">
            <span>Погашено тела: {fmtMoney(Math.max(0, loan.total_amount - s.remaining))}</span>
            <span>Осталось: {pluralMonths(s.monthsLeft)}</span>
          </div>
        </div>
      </Card>

      {/* Сетка параметров кредита */}
      <Card className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
        <Param label="Ежемесячный платёж" value={fmtMoney(loan.monthly_payment)} highlight />
        <Param label="Процентная ставка" value={`${loan.interest_rate}% годовых`} />
        <Param label="Сумма кредита" value={fmtMoney(loan.total_amount)} />
        <Param label="Срок договора" value={pluralMonths(loan.term_months)} />
        <Param label="Следующий платёж" value={fmtDate(nextDate)} />
        <Param label="Окончание графика" value={fmtDate(s.endDate)} />
      </Card>

      {/* Действия */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Button onClick={() => void markPayment()} disabled={marking} className="flex-1">
          <CheckIcon className="h-4 w-4" />
          {marking ? 'Сохраняем…' : `Внести платёж ${fmtMoney(loan.monthly_payment)}`}
        </Button>
        <Button variant="secondary" onClick={() => setFormOpen(true)}>
          <EditIcon className="h-4 w-4" />
          Изменить параметры
        </Button>
      </div>
      <p className="px-1 text-[11.5px] leading-relaxed text-[#A9AFB7]">
        Платёж фиксируется в расходах (категория «Кредит»), а остаток долга автоматически
        пересчитывается по аннуитетной формуле от числа внесённых платежей.
      </p>

      {/* История внесённых платежей */}
      {payments.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#363B43] bg-[#23272D]/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-[#E33337]" />
              <p className="font-display-num text-[14px] font-bold uppercase tracking-wide text-[#F3F4F4]">
                История платежей
              </p>
            </div>
            <span className="text-[12px] font-semibold text-[#A9AFB7]">
              Всего: {payments.length}
            </span>
          </div>
          <div className="divide-y divide-[#363B43]/60">
            {payments.slice(0, 8).map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#23272D]/40"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[#363B43] bg-[#23272D] font-mono text-[11px] font-bold text-[#A9AFB7]">
                    #{payments.length - idx}
                  </span>
                  <div>
                    <p className="font-display-num text-[16px] font-bold text-[#F3F4F4]">
                      {fmtMoney(p.amount)}
                    </p>
                    <p className="text-[11.5px] text-[#A9AFB7]">{fmtDate(p.date)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Удалить платёж от ${fmtDate(p.date)}`}
                  onClick={() => {
                    void confirmAction('Удалить этот платёж из истории?').then((ok) => {
                      if (ok) void removeTransaction(p.id)
                    })
                  }}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-semibold text-[#A9AFB7] transition-colors hover:bg-[#EF4444]/15 hover:text-[#EF4444]"
                >
                  <TrashIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Удалить</span>
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <LoanFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        loan={loan}
        onSave={saveLoan}
      />
    </div>
  )
}

function Param({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="border-l-2 border-[#363B43] pl-3">
      <p className="text-[11.5px] font-medium text-[#A9AFB7]">{label}</p>
      <p
        className={`mt-0.5 font-display-num text-[17px] font-bold tracking-tight ${
          highlight ? 'text-[#E33337]' : 'text-[#F3F4F4]'
        }`}
      >
        {value}
      </p>
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
  onSave: (
    patch: Required<
      Pick<
        Loan,
        'total_amount' | 'interest_rate' | 'monthly_payment' | 'term_months' | 'start_date'
      >
    >,
  ) => Promise<Loan>
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

  // автоподстановка платежа по аннуитету при изменении суммы, ставки или срока
  const tryAutoPayment = (a: string, r: string, n: string) => {
    const S = parseLocaleNumber(a)
    const R = parseLocaleNumber(r)
    const N = parseLocaleNumber(n)
    if (S > 0 && N > 0 && Number.isFinite(R) && R >= 0) {
      setPayment(String(Math.round(annuityPayment(S, R, N))))
    }
  }

  const submit = async () => {
    const S = parseLocaleNumber(amount)
    const R = parseLocaleNumber(rate)
    let P = parseLocaleNumber(payment)
    const N = Math.round(parseLocaleNumber(term))
    if (!(S > 0)) return setError('Введите сумму кредита')
    if (!(R >= 0)) return setError('Введите процентную ставку')
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
      setError(e instanceof Error ? e.message : 'Не удалось сохранить параметры кредита')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={loan ? 'Параметры кредита' : 'Подключить кредит'}
    >
      <div className="flex flex-col gap-3.5">
        <Field
          label="Сумма кредита"
          suffix="₽"
          inputMode="numeric"
          placeholder="1 050 000"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
            tryAutoPayment(e.target.value, rate, term)
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Ставка годовых"
            suffix="%"
            inputMode="decimal"
            placeholder="16.9"
            value={rate}
            onChange={(e) => {
              setRate(e.target.value)
              tryAutoPayment(amount, e.target.value, term)
            }}
          />
          <Field
            label="Срок"
            suffix="мес"
            inputMode="numeric"
            placeholder="60"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value)
              tryAutoPayment(amount, rate, e.target.value)
            }}
          />
        </div>
        <Field
          label="Ежемесячный платёж (рассчитывается автоматически)"
          suffix="₽"
          inputMode="decimal"
          placeholder="Авто по аннуитету"
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
        />
        <Field
          label="Дата первого платежа"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        {error && (
          <p
            role="alert"
            className="rounded-[8px] border border-[#EF4444]/40 bg-[#EF4444]/12 px-3.5 py-2.5 text-[13px] font-medium text-[#EF4444]"
          >
            {error}
          </p>
        )}

        <Button onClick={() => void submit()} disabled={saving} className="mt-1 w-full">
          {saving ? 'Сохраняем…' : 'Сохранить график'}
        </Button>
      </div>
    </Sheet>
  )
}
