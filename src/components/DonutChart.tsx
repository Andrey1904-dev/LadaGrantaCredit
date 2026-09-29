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

/** Круговая диаграмма трат по категориям с суммой в центре */
export default function DonutChart({ labels, values, colors, total }: DonutChartProps) {
  return (
    <div className="relative mx-auto h-48 w-48">
      <Doughnut
        data={{
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: colors,
              borderWidth: 2,
              borderColor: '#F5F7F9',
              hoverOffset: 6,
            },
          ],
        }}
        options={{
          cutout: '70%',
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${fmtMoney(ctx.parsed)}`,
              },
            },
          },
        }}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-medium text-muted">Всего</span>
        <span className="text-[17px] font-extrabold text-ink">{fmtMoney(total)}</span>
      </div>
    </div>
  )
}
