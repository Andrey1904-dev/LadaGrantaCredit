import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import AddTransactionSheet from '../components/AddTransactionSheet'
import DonutChart from '../components/DonutChart'
import { Button, Card, EmptyState, SectionTitle, Spinner } from '../components/ui'
import { WalletIcon, PlusIcon, TrashIcon } from '../components/icons'
import { CATEGORY_META } from '../lib/categories'
import type { TxCategory } from '../types/domain'
import { startOfMonth } from '../utils/date'
import { fmtDate, fmtMileage, fmtMoney } from '../utils/format'

/** Вкладка 3: Расходы — аналитика, диаграмма, лента */
export default function ExpensesPage() {
  const { transactions, car, loading, removeTransaction } = useAppData()
  const [sheetOpen, setSheetOpen] = useState(false)

  const stats = useMemo(() => {
    const total = transactions.reduce((s, t) => s + t.amount, 0)
    const monthStart = startOfMonth()
    const month = transactions
      .filter((t) => new Date(t.date) >= monthStart)
      .reduce((s, t) => s + t.amount, 0)

    // Стоимость километра = Σ всех транзакций / (текущий пробег − начальный)
    let costPerKm: number | null = null
    if (car) {
      const kmDriven = car.current_mileage - (car.initial_mileage || 0)
      if (kmDriven > 0 && total > 0) costPerKm = total / kmDriven
    }

    const byCategory = new Map<TxCategory, number>()
    for (const t of transactions) {
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
    }
    const chart = [...byCategory.entries()]
      .map(([c, sum]) => ({ category: c, sum, meta: CATEGORY_META[c] }))
      .sort((a, b) => b.sum - a.sum)

    return { total, month, costPerKm, chart }
  }, [transactions, car])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="animate-pop-in">
      <div className="mb-3 flex items-center justify-between px-1">
        <h1 className="text-[20px] font-extrabold text-ink">Расходы</h1>
        <Button className="rounded-full! p-2.5!" aria-label="Добавить расход" onClick={() => setSheetOpen(true)}>
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon={<WalletIcon className="h-9 w-9" />}
          title="Пока нет расходов"
          text="Добавьте первую трату — топливо, платёж по кредиту или расходы на обслуживание"
          action={<Button onClick={() => setSheetOpen(true)}>Добавить расход</Button>}
        />
      ) : (
        <>
          {/* Сводные показатели */}
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard label="Всего" value={fmtMoney(stats.total)} />
            <StatCard label="Этот месяц" value={fmtMoney(stats.month)} />
            <StatCard
              label="Цена 1 км"
              value={stats.costPerKm === null ? '—' : `${stats.costPerKm.toFixed(1).replace('.', ',')} ₽`}
            />
          </div>

          {/* Диаграмма по категориям */}
          <SectionTitle>Структура трат</SectionTitle>
          <Card>
            <DonutChart
              labels={stats.chart.map((c) => c.meta.label)}
              values={stats.chart.map((c) => c.sum)}
              colors={stats.chart.map((c) => c.meta.color)}
              total={stats.total}
            />
            <div className="mt-4 flex flex-col gap-2">
              {stats.chart.map(({ category, sum, meta }) => (
                <div key={category} className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="flex-1 text-[13px] font-medium text-ink">{meta.label}</span>
                  <span className="text-[13px] font-semibold text-ink">{fmtMoney(sum)}</span>
                  <span className="w-10 text-right text-[12px] text-muted">
                    {Math.round((sum / stats.total) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Лента операций */}
          <div className="mb-2.5 mt-6 flex items-center justify-between px-1">
            <h2 className="text-[15px] font-bold text-ink">История операций</h2>
            <span className="text-[12px] text-muted">{transactions.length} записей</span>
          </div>
          <Card className="p-0!">
            {transactions.map((t, i) => {
              const meta = CATEGORY_META[t.category]
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i !== 0 ? 'border-t border-black/[0.05]' : ''}`}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
                  >
                    <meta.Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink">{meta.label}</p>
                    <p className="truncate text-[12px] text-muted">
                      {fmtDate(t.date)}
                      {t.mileage_at_transaction !== null && ` · ${fmtMileage(t.mileage_at_transaction)}`}
                    </p>
                  </div>
                  <p className="text-[14px] font-bold text-ink">{fmtMoney(t.amount)}</p>
                  <button
                    aria-label="Удалить"
                    onClick={() => {
                      if (window.confirm(`Удалить расход «${meta.label}» на ${fmtMoney(t.amount)}?`)) {
                        void removeTransaction(t.id)
                      }
                    }}
                    className="rounded-lg p-1.5 text-black/25 transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </Card>
        </>
      )}

      <AddTransactionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 truncate text-[15px] font-extrabold text-ink">{value}</p>
    </div>
  )
}
