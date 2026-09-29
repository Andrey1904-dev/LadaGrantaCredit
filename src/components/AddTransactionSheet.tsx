import { useEffect, useMemo, useState } from 'react'
import Sheet from './Sheet'
import { Button, Field } from './ui'
import { CATEGORY_META } from '../lib/categories'
import { TX_CATEGORIES, type Transaction, type TxCategory } from '../types/domain'
import { parseLocaleNumber, toDateInputValue } from '../utils/format'
import { useAppData } from '../context/AppDataContext'

interface Props {
  open: boolean
  onClose(): void
  initialCategory?: TxCategory
  /** Если передана существующая операция — форма работает в режиме редактирования */
  editingTransaction?: Transaction | null
}

/** BottomSheet добавления и редактирования расхода */
export default function AddTransactionSheet({
  open,
  onClose,
  initialCategory = 'other',
  editingTransaction = null,
}: Props) {
  const { addTransaction, removeTransaction, car, loan, saveCar } = useAppData()
  const [category, setCategory] = useState<TxCategory>(initialCategory)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(toDateInputValue(new Date()))
  const [mileage, setMileage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editingTransaction) {
      setCategory(editingTransaction.category)
      setAmount(String(editingTransaction.amount))
      setDate(toDateInputValue(new Date(editingTransaction.date)))
      setMileage(
        editingTransaction.mileage_at_transaction !== null
          ? String(editingTransaction.mileage_at_transaction)
          : '',
      )
      setError('')
      return
    }
    setCategory(initialCategory)
    // для категории «Кредит» подставляем платёж из параметров кредита
    setAmount(
      initialCategory === 'loan' && loan ? String(Math.round(loan.monthly_payment)) : '',
    )
    setDate(toDateInputValue(new Date()))
    setMileage(car ? String(car.current_mileage) : '')
    setError('')
  }, [open, initialCategory, editingTransaction, car, loan])

  const meta = CATEGORY_META[category]
  const showMileage = meta.requiresMileage || meta.suggestsMileage

  const mileageLabel = useMemo(() => {
    if (meta.requiresMileage) return 'Текущий пробег (обязательно для топлива)'
    return 'Пробег на момент операции (необязательно)'
  }, [meta])

  const handleCategoryChange = (nextCat: TxCategory) => {
    setCategory(nextCat)
    setError('')
    if (!editingTransaction && nextCat === 'loan' && loan && !amount.trim()) {
      setAmount(String(Math.round(loan.monthly_payment)))
    }
  }

  const handleSubmit = async () => {
    const value = parseLocaleNumber(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Введите корректную сумму расхода')
      return
    }
    const km = mileage.trim() === '' ? null : Math.round(parseLocaleNumber(mileage))
    if (meta.requiresMileage && (km === null || !Number.isFinite(km) || km < 0)) {
      setError('Для категории «Топливо» обязательно укажите пробег — нужен для расчёта стоимости километра')
      return
    }
    if (km !== null && (!Number.isFinite(km) || km < 0)) {
      setError('Пробег должен быть положительным числом')
      return
    }
    setSaving(true)
    try {
      await addTransaction({
        amount: Math.round(value * 100) / 100,
        category,
        date: new Date(date + 'T12:00:00').toISOString(),
        mileage_at_transaction: showMileage ? km : null,
      })
      if (editingTransaction) {
        await removeTransaction(editingTransaction.id)
      }
      // если указан пробег больше текущего — синхронизируем одометр автомобиля
      if (showMileage && km !== null && car && km > car.current_mileage) {
        await saveCar({ current_mileage: km })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить расход')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editingTransaction ? 'Редактировать расход' : 'Новый расход'}
    >
      <div className="mb-4">
        <span className="mb-2 block text-[12.5px] font-semibold text-[#A9AFB7]">
          Категория расхода
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TX_CATEGORIES.map((c) => {
            const m = CATEGORY_META[c]
            const active = c === category
            return (
              <button
                key={c}
                type="button"
                onClick={() => handleCategoryChange(c)}
                className={`flex min-h-[44px] items-center gap-2 rounded-[8px] border px-3 py-2 text-left text-[13px] font-semibold transition-all duration-160 ${
                  active
                    ? 'border-[#E33337] bg-[#23272D] text-[#F3F4F4] shadow-[inset_3px_0_0_0_#E33337]'
                    : 'border-[#363B43] bg-[#0E1013]/60 text-[#A9AFB7] hover:border-[#A9AFB7]/50 hover:text-[#F3F4F4]'
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: m.color }}
                  aria-hidden="true"
                />
                <m.Icon className="h-4 w-4 shrink-0 text-[#F3F4F4]" />
                <span className="truncate">{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <Field
          label="Сумма"
          suffix="₽"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        <Field
          label="Дата операции"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {showMileage && (
          <Field
            label={mileageLabel}
            suffix="км"
            inputMode="numeric"
            placeholder={car ? String(car.current_mileage) : 'Например, 18500'}
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
          />
        )}

        {error && (
          <div
            role="alert"
            className="rounded-[8px] border border-[#EF4444]/40 bg-[#EF4444]/12 px-3.5 py-2.5 text-[13px] font-medium text-[#EF4444]"
          >
            {error}
          </div>
        )}

        <div className="mt-1 flex gap-2.5">
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving} className="flex-1">
            {saving
              ? 'Сохраняем…'
              : editingTransaction
                ? 'Сохранить изменения'
                : 'Добавить расход'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
