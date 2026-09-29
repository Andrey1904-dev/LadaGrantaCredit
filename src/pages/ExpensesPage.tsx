import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import AddTransactionSheet from '../components/AddTransactionSheet'
import DonutChart from '../components/DonutChart'
import { Button, Card, EmptyState, SectionTitle, Spinner } from '../components/ui'
import PageHero, { HeroChip } from '../components/PageHero'
import { EditIcon, FuelIcon, PlusIcon, TrashIcon, WalletIcon } from '../components/icons'
import { CATEGORY_META } from '../lib/categories'
import { PAGE_MEDIA } from '../lib/assets'
import { useSettings } from '../lib/settings'
import { TX_CATEGORIES, type Transaction, type TxCategory } from '../types/domain'
import { startOfMonth } from '../utils/date'
import { computeFuelStats } from '../utils/fuel'
import { fmtDate, fmtMileage, fmtMoney, fmtNumber } from '../utils/format'

/** Вкладка 3: Расходы — аналитика стоимости владения, Donut-диаграмма и лента операций */
export default function ExpensesPage() {
  const { transactions, car, loading, removeTransaction } = useAppData()
  const [settings] = useSettings()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [filterCat, setFilterCat] = useState<TxCategory | 'all'>('all')

  const stats = useMemo(() => {
    const total = transactions.reduce((s, t) => s + t.amount, 0)
    const monthStart = startOfMonth()
    const month = transactions
      .filter((t) => new Date(t.date) >= monthStart)
      .reduce((s, t) => s + t.amount, 0)

    // Стоимость километра = сумма всех транзакций / (текущий пробег − начальный)
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

  /* Топливная аналитика: расход л/100 км и стоимость километра по чекам */
  const fuel = useMemo(
    () => computeFuelStats(transactions, settings.fuelPrice, settings.tankLiters),
    [transactions, settings.fuelPrice, settings.tankLiters],
  )

  const filteredTransactions = useMemo(() => {
    if (filterCat === 'all') return transactions
    return transactions.filter((t) => t.category === filterCat)
  }, [transactions, filterCat])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="animate-pop-in">
      <div className="mb-4">
        <PageHero
          media={PAGE_MEDIA.expenses}
          eyebrow="Стоимость владения"
          title="Расходы и аналитика"
          subtitle="Структура трат по категориям, стоимость километра и реальный расход топлива по чекам заправок."
          priority
          action={
            <Button
              onClick={() => {
                setEditingTx(null)
                setSheetOpen(true)
              }}
            >
              <PlusIcon className="h-4 w-4" />
              Добавить расход
            </Button>
          }
          chips={
            <>
              <HeroChip label="Записей" value={String(transactions.length)} />
              <HeroChip
                icon={<FuelIcon className="h-3.5 w-3.5" />}
                label={fuel.avgPer100 ? 'Расход' : 'Топливо'}
                value={
                  fuel.avgPer100
                    ? `${fuel.avgPer100.toFixed(1).replace('.', ',')} л/100 км`
                    : fmtMoney(fuel.totalRub)
                }
              />
              {stats.costPerKm !== null && (
                <HeroChip
                  label="Километр"
                  value={`${stats.costPerKm.toFixed(1).replace('.', ',')} ₽`}
                />
              )}
            </>
          }
        />
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          showSportDetail
          icon={<WalletIcon className="h-6 w-6" />}
          title="Пока нет записанных расходов"
          text="Добавьте первую трату — заправку топливом (с пробегом), платёж по кредиту, страховку или ТО"
          action={
            <Button
              onClick={() => {
                setEditingTx(null)
                setSheetOpen(true)
              }}
            >
              Добавить первый расход
            </Button>
          }
        />
      ) : (
        <>
          {/* Сводные показатели стоимости владения */}
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard label="Всего за период" value={fmtMoney(stats.total)} />
            <StatCard label="Этот месяц" value={fmtMoney(stats.month)} />
            <StatCard
              label="Стоимость 1 км"
              value={
                stats.costPerKm === null
                  ? '—'
                  : `${stats.costPerKm.toFixed(1).replace('.', ',')} ₽`
              }
              accent
            />
          </div>

          {/* Топливо: расход, стоимость километра, запас хода */}
          <SectionTitle
            action={
              <span className="text-[11.5px] text-[#A9AFB7]">
                оценка по цене {fmtNumber(settings.fuelPrice)} ₽/л
              </span>
            }
          >
            Топливо и расход
          </SectionTitle>
          {fuel.legs.length === 0 ? (
            <Card className="text-[12.5px] leading-relaxed text-[#A9AFB7]">
              Чтобы приложение посчитало расход, добавьте минимум две заправки
              <strong className="text-[#F3F4F4]"> «до полного»</strong> с показаниями одометра.
              Цена литра настраивается на вкладке «ТО» → «Шины и документы».
            </Card>
          ) : (
            <Card className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FuelStat
                label="Средний расход"
                value={`${fuel.avgPer100!.toFixed(1).replace('.', ',')} л`}
                sub="на 100 км"
                accent
              />
              <FuelStat
                label="Последние заправки"
                value={`${fuel.recentPer100!.toFixed(1).replace('.', ',')} л`}
                sub={
                  fuel.recentPer100! > fuel.avgPer100!
                    ? 'выше среднего'
                    : 'не выше среднего'
                }
              />
              <FuelStat
                label="Топливо на километр"
                value={`${fuel.rubPerKm!.toFixed(1).replace('.', ',')} ₽`}
                sub={`бак ≈ ${fmtMileage(Math.round(fuel.rangePerTank ?? 0))}`}
              />
              <FuelStat
                label="Залито всего"
                value={`${Math.round(fuel.totalLiters)} л`}
                sub={`${fuel.count} заправок на ${fmtMoney(fuel.totalRub)}`}
              />
            </Card>
          )}

          {/* Диаграмма и таблица структуры трат по категориям */}
          <SectionTitle>Структура расходов по категориям</SectionTitle>
          <Card className="grid grid-cols-1 items-center gap-6 md:grid-cols-[220px_1fr]">
            <DonutChart
              labels={stats.chart.map((c) => c.meta.label)}
              values={stats.chart.map((c) => c.sum)}
              colors={stats.chart.map((c) => c.meta.color)}
              total={stats.total}
            />
            <div className="flex flex-col gap-3">
              {stats.chart.map(({ category, sum, meta }) => {
                const pct = Math.round((sum / stats.total) * 100)
                return (
                  <div key={category} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                          style={{ backgroundColor: meta.color }}
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-[#F3F4F4]">{meta.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-display-num text-[15px] font-bold text-[#F3F4F4]">
                          {fmtMoney(sum)}
                        </span>
                        <span className="w-10 text-right font-mono text-[12px] font-semibold text-[#A9AFB7]">
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0E1013]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(3, pct)}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Лента операций с фильтром по категориям */}
          <div className="mb-2.5 mt-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-[#E33337]" aria-hidden="true" />
              <h2 className="font-display-num text-[16px] font-semibold uppercase tracking-wide text-[#F3F4F4]">
                История операций
              </h2>
            </div>
            <span className="text-[12px] font-semibold text-[#A9AFB7]">
              Записей: {filteredTransactions.length}
            </span>
          </div>

          {/* Фильтр по категориям */}
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Фильтр категорий">
            <button
              type="button"
              onClick={() => setFilterCat('all')}
              className={`min-h-[38px] rounded-[8px] border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                filterCat === 'all'
                  ? 'border-[#E33337] bg-[#23272D] text-[#F3F4F4]'
                  : 'border-[#363B43] bg-[#1A1D22] text-[#A9AFB7] hover:text-[#F3F4F4]'
              }`}
            >
              Все ({transactions.length})
            </button>
            {TX_CATEGORIES.map((c) => {
              const m = CATEGORY_META[c]
              const active = filterCat === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilterCat(c)}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    active
                      ? 'border-[#E33337] bg-[#23272D] text-[#F3F4F4]'
                      : 'border-[#363B43] bg-[#1A1D22] text-[#A9AFB7] hover:text-[#F3F4F4]'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: m.color }}
                    aria-hidden="true"
                  />
                  {m.label}
                </button>
              )
            })}
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-[#363B43]/60">
              {filteredTransactions.map((t) => {
                const meta = CATEGORY_META[t.category]
                return (
                  <div
                    key={t.id}
                    className="relative flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#23272D]/40"
                  >
                    <span
                      className="absolute inset-y-2 left-0 w-[3px] rounded-r-full"
                      style={{ backgroundColor: meta.color }}
                      aria-hidden="true"
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-3 pl-1">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#363B43] bg-[#23272D] text-[#F3F4F4]">
                        <meta.Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[14px] font-bold text-[#F3F4F4]">{meta.label}</p>
                          {t.mileage_at_transaction !== null && (
                            <span className="rounded-[5px] border border-[#363B43] bg-[#0E1013] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#A9AFB7]">
                              {fmtMileage(t.mileage_at_transaction)}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-[#A9AFB7]">
                          {fmtDate(t.date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="font-display-num mr-1 text-[17px] font-bold text-[#F3F4F4]">
                        {fmtMoney(t.amount)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Редактировать операцию ${meta.label} на сумму ${fmtMoney(t.amount)}`}
                        onClick={() => {
                          setEditingTx(t)
                          setSheetOpen(true)
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-[8px] text-[#A9AFB7] transition-colors hover:bg-[#23272D] hover:text-[#F3F4F4]"
                      >
                        <EditIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Удалить операцию ${meta.label} на сумму ${fmtMoney(t.amount)}`}
                        onClick={() => {
                          if (window.confirm('Удалить эту запись о расходе?')) {
                            void removeTransaction(t.id)
                          }
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-[8px] text-[#A9AFB7] transition-colors hover:bg-[#EF4444]/15 hover:text-[#EF4444]"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}

      <AddTransactionSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setEditingTx(null)
        }}
        editingTransaction={editingTx}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
        {label}
      </p>
      <p
        className={`font-display-num mt-1 truncate text-[18px] font-bold leading-tight sm:text-[22px] ${
          accent ? 'text-[#E33337]' : 'text-[#F3F4F4]'
        }`}
      >
        {value}
      </p>
    </Card>
  )
}

/** Показатель топливной статистики внутри карточки */
function FuelStat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div>
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
        {label}
      </p>
      <p
        className={`font-display-num mt-1 text-[20px] font-bold leading-tight sm:text-[22px] ${
          accent ? 'text-[#E33337]' : 'text-[#F3F4F4]'
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-[#A9AFB7]">{sub}</p>}
    </div>
  )
}
