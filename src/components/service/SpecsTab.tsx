import { Card, SectionTitle } from '../ui'
import { DropletIcon, InfoIcon, SparklesIcon, TyreIcon } from '../icons'
import { FLUID_SPECS, SPORT_SPECS, WHEEL_SPECS, fuelGrade, type SpecRow } from '../../lib/ownership'
import { engineInfo, engineSpecLine, type EngineId } from '../../lib/service'

function SpecList({ rows }: { rows: SpecRow[] }) {
  return (
    <div className="flex flex-col divide-y divide-[#363B43]/70">
      {rows.map((row) => (
        <div key={row.label} className="py-2.5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-[12.5px] text-[#A9AFB7]">{row.label}</p>
            <p className="font-display-num text-[13.5px] font-bold text-[#F3F4F4]">{row.value}</p>
          </div>
          {row.note && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-[#A9AFB7]">{row.note}</p>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Справочник владельца: то, что обычно ищут в интернете с телефона у гаража —
 * какое масло и сколько лить, какое давление в шинах, каким моментом тянуть
 * колёса и какой бензин заливать.
 */
export default function SpecsTab({ engine }: { engine: EngineId }) {
  const info = engineInfo(engine)

  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#23272D] text-[#A9AFB7]">
            <InfoIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
              Ваш автомобиль
            </p>
            <p className="font-display-num text-[16px] font-bold leading-tight text-[#F3F4F4]">
              {info.car}
            </p>
            <p className="mt-0.5 text-[12px] text-[#A9AFB7]">Двигатель {engineSpecLine(engine)}</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[#A9AFB7]">{info.note}</p>
          </div>
        </div>
        <div className="rounded-[9px] border border-[#E33337]/40 bg-[#E33337]/10 px-3 py-2 text-center">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
            Бензин
          </p>
          <p className="font-display-num text-[15px] font-bold text-[#E33337]">
            {fuelGrade(engine)}
          </p>
        </div>
      </Card>

      <SectionTitle
        action={
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#A9AFB7]">
            <DropletIcon className="h-3.5 w-3.5" />
            руководство по эксплуатации
          </span>
        }
      >
        Жидкости и заправочные объёмы
      </SectionTitle>
      <Card>
        <SpecList rows={FLUID_SPECS} />
      </Card>

      <SectionTitle
        action={
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#A9AFB7]">
            <TyreIcon className="h-3.5 w-3.5" />
            колёса
          </span>
        }
      >
        Шины, давление, затяжка
      </SectionTitle>
      <Card>
        <SpecList rows={WHEEL_SPECS} />
      </Card>

      <SectionTitle
        action={
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#A9AFB7]">
            <SparklesIcon className="h-3.5 w-3.5" />
            версия Sport
          </span>
        }
      >
        Паспорт Granta Sport
      </SectionTitle>
      <Card>
        <SpecList rows={SPORT_SPECS} />
      </Card>

      <p className="px-1 text-[11px] leading-relaxed text-[#A9AFB7]">
        Данные — из руководства по эксплуатации LADA Granta, каталога дилера и клубных форумов.
        Это ориентир владельца, а не замена сервисной книжке конкретного автомобиля: перед
        заменой жидкостей сверяйтесь с табличкой под капотом и документами на вашу комплектацию.
      </p>
    </>
  )
}
