import { Doughnut } from 'react-chartjs-2'
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'
import { fmtMoney } from '../utils/format'

ChartJS.register(ArcElement, Tooltip, Legend)

interface DonutChartProps {
  labels: string[]
  values: number[]
  colors: string[]
  total: number
}

/** Круговая диаграмма трат по категориям с общей суммой в центре (адаптирована под тёмную поверхность #1A1D22) */
export default function DonutChart({ labels, values, colors, total }: DonutChartProps) {
  return (
    <div className="relative mx-auto h-48 w-48 shrink-0">
      <Doughnut
        data={{
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: colors,
              borderWidth: 3,
              borderColor: '#1A1D22',
              hoverOffset: 5,
            },
          ],
        }}
        options={{
          cutout: '72%',
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0E1013',
              titleColor: '#A9AFB7',
              bodyColor: '#F3F4F4',
              borderColor: '#363B43',
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${fmtMoney(ctx.parsed)}`,
              },
            },
          },
        }}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
          Всего
        </span>
        <span className="font-display-num mt-0.5 text-[20px] font-bold leading-tight text-[#F3F4F4]">
          {fmtMoney(total)}
        </span>
      </div>
    </div>
  )
}
