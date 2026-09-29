import { useEffect, useMemo, useState } from 'react'
import Sheet from './Sheet'
import { Button, Field } from './ui'
import { CATEGORY_META } from '../lib/categories'
import { TX_CATEGORIES, type TxCategory } from '../types/domain'
import { parseLocaleNumber, toDateInputValue } from '../utils/format'
import { useAppData } from '../context/AppDataContext'

interface Props {
  open: boolean
  onClose(): void
  initialCategory?: TxCategory
}

/** BottomSheet добавления расхода (быстрые действия с главной и со страницы расходов) */
export default function AddTransactionSheet({ open, onClose, initialCategory = 'other' }: Props) {
  const { addTransaction, car, loan, saveCar } = useAppData()
  const [category, setCategory] = useState<TxCategory>(initialCategory)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(toDateInputValue(new Date()))
  const [mileage, setMileage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setCategory(initialCategory)
      // для категории «Кредит» подставляем платёж из параметров кредита
      setAmount(
        initialCategory === 'loan' && loan ? String(Math.round(loan.monthly_payment)) : '',
      )
      setDate(toDateInputValue(new Date()))
      setMileage(car ? String(car.current_mileage) : '')
      setError('')
    }
  }, [open, initialCategory, car, loan])

  const meta = CATEGORY_META[category]
  const showMileage = meta.requiresMileage || meta.suggestsMileage

  const mileageLabel = useMemo(() => {
    if (meta.requiresMileage) return 'Текущий пробег (обязательно для топлива)'
    return 'Пробег (необязательно)'
  }, [meta])

  const handleSubmit = async () => {
    const value = parseLocaleNumber(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Введите корректную сумму')
      return
    }
    const km = mileage.trim() === '' ? null : Math.round(parseLocaleNumber(mileage))
    if (meta.requiresMileage && (km === null || !Number.isFinite(km) || km < 0)) {
      setError('Для категории «Топливо» обязательно укажите пробег — нужен для расчёта расхода')
      return
    }
    if (km !== null && !Number.isFinite(km)) {
      setError('Пробег должен быть числом')
      return
    }
    setSaving(true)
    try {
      await addTransaction({
        amount: Math.round(value * 100) / 100,
        category,
        date: new Date(date + 'T12:00:00').toISOString(),
        mileage_at_transaction: km,
      })
      // если указан пробег больше текущего — синхронизируем одометр автомобиля
      if (km !== null && car && km > car.current_mileage) {
        await saveCar({ current_mileage: km })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Новый расход">
      <div className="mb-4 flex flex-wrap gap-2">
        {TX_CATEGORIES.map((c) => {
          const m = CATEGORY_META[c]
          const active = c === category
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-semibold transition-all ${
                active ? 'border-transparent text-white' : 'border-black/10 bg-white text-muted'
              }`}
              style={active ? { backgroundColor: m.color } : undefined}
            >
              <m.Icon className="h-4 w-4" />
              {m.label}
            </button>
          )
        })}
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
        <Field label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
          <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}

        <Button onClick={handleSubmit} disabled={saving} className="mt-1 w-full">
          {saving ? 'Сохраняем…' : 'Добавить расход'}
        </Button>
      </div>
    </Sheet>
  )
}
