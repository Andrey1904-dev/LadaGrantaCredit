import { Bar } from 'react-chartjs-2'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type TooltipItem,
} from 'chart.js'
import { CATEGORY_META } from '../lib/categories'
import { TX_CATEGORIES } from '../types/domain'
import type { MonthPoint } from '../utils/stats'
import { fmtMoney } from '../utils/format'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

/**
 * Расходы по месяцам с разбивкой по категориям (stacked bar).
 * Показывает сезонность: шины осенью, страховка раз в год, всплески ремонта.
 */
export default function MonthlyChart({ points }: { points: MonthPoint[] }) {
  const max = Math.max(...points.map((p) => p.total), 0)
  return (
    <div className="h-52 w-full">
      <Bar
        data={{
          labels: points.map((p) => p.label),
          datasets: TX_CATEGORIES.map((category) => ({
            label: CATEGORY_META[category].label,
            data: points.map((p) => p.byCategory[category]),
            backgroundColor: CATEGORY_META[category].color,
            borderRadius: 3,
            borderSkipped: false,
            stack: 'total',
            maxBarThickness: 28,
          })),
        }}
        options={{
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
              border: { color: '#363B43' },
              ticks: { color: '#A9AFB7', font: { size: 10 } },
            },
            y: {
              stacked: true,
              suggestedMax: max * 1.1,
              grid: { color: '#363B43' },
              border: { display: false },
              ticks: {
                color: '#A9AFB7',
                font: { size: 10 },
                maxTicksLimit: 4,
                callback: (value) =>
                  Number(value) >= 1000
                    ? `${Math.round(Number(value) / 1000)} тыс.`
                    : String(value),
              },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0E1013',
              titleColor: '#A9AFB7',
              bodyColor: '#F3F4F4',
              borderColor: '#363B43',
              borderWidth: 1,
              padding: 10,
              filter: (ctx: TooltipItem<'bar'>) => Number(ctx.parsed.y) > 0,
              callbacks: {
                label: (ctx: TooltipItem<'bar'>) =>
                  ` ${ctx.dataset.label}: ${fmtMoney(Number(ctx.parsed.y))}`,
                footer: (items: TooltipItem<'bar'>[]) =>
                  `Итого: ${fmtMoney(items.reduce((s, i) => s + Number(i.parsed.y), 0))}`,
              },
            },
          },
        }}
      />
    </div>
  )
}
