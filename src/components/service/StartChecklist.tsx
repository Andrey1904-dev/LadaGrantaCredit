import { useMemo } from 'react'
import { Card, InfoTip, SectionTitle } from '../ui'
import { CheckIcon, GaugeIcon, InfoIcon } from '../icons'
import { START_STEPS, STEP_KIND_LABEL, type StepKind } from '../../lib/ownership'
import { fmtMileage, fmtMoney } from '../../utils/format'

const KIND_ORDER: StepKind[] = ['law', 'service', 'upgrade']

const KIND_HINT: Record<StepKind, string> = {
  law: 'Сроки считаются от даты в договоре купли-продажи. Пропуск бьёт по кошельку сразу — это штрафы, а не рекомендации.',
  service: 'Обкатка и первое масло. Завод разрешает ехать до 15 000 км, владельцы на форумах сливают обкаточное масло в 2–3 тысячи — в нём стружка притирки.',
  upgrade: 'Недорогие доработки, которые в бортжурналах Гранты советуют делать в первые недели: они лечат известные болячки кузова и салона.',
}

interface Props {
  /** Текущий пробег — по нему видно, пройдена ли обкатка */
  mileage: number
  /** Отмеченные пункты */
  done: string[]
  onToggle(id: string): void
}

/**
 * «После покупки» — чек-лист первых шагов владельца Гранты:
 * закон (учёт, ОСАГО, техосмотр), обкатка с первым ТО и доработки с форумов.
 * Отметки хранятся в настройках браузера, схема Supabase не меняется.
 */
export default function StartChecklist({ mileage, done, onToggle }: Props) {
  const doneSet = useMemo(() => new Set(done), [done])
  const total = START_STEPS.length
  const completed = START_STEPS.filter((s) => doneSet.has(s.id)).length

  const breakIn = Math.min(1, mileage / 3000)
  const breakInLeft = Math.max(0, 3000 - mileage)

  return (
    <>
      {/* Обкатка: первые 3 000 км */}
      <Card className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#23272D] text-[#A9AFB7]">
              <GaugeIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A9AFB7]">
                Обкатка двигателя
              </p>
              <p className="font-display-num text-[18px] font-bold leading-tight text-[#F3F4F4]">
                {breakInLeft > 0 ? `осталось ${fmtMileage(breakInLeft)}` : 'пройдена'}
              </p>
            </div>
          </div>
          <span className="font-display-num text-[13px] font-bold text-[#A9AFB7]">
            {fmtMileage(Math.min(mileage, 3000))} / 3 000 км
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#23272D]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${breakIn * 100}%`,
              backgroundColor: breakInLeft > 0 ? '#F5A623' : '#16B374',
            }}
          />
        </div>
        <p className="text-[11.5px] leading-relaxed text-[#A9AFB7]">
          {breakInLeft > 0
            ? 'До 3 000 км держите обороты до 3 000 и скорость до 90–110 км/ч, избегайте полного газа, буксировки прицепа и долгой работы на холостых. Тормозите двигателем и меняйте режимы, а не едьте «внатяг».'
            : 'Обкатка позади: можно раскручивать мотор, но масло по опыту форумов меняют каждые 7 500–10 000 км, а не раз в 15 000.'}
        </p>
      </Card>

      <SectionTitle
        action={
          <span className="font-display-num text-[12.5px] font-bold text-[#A9AFB7]">
            {completed} из {total}
          </span>
        }
      >
        Чек-лист первых шагов
      </SectionTitle>

      <div className="flex flex-col gap-3">
        {KIND_ORDER.map((kind) => {
          const steps = START_STEPS.filter((s) => s.kind === kind)
          return (
            <div key={kind} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <InfoIcon className="h-3.5 w-3.5 text-[#A9AFB7]" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#A9AFB7]">
                  {STEP_KIND_LABEL[kind]}
                </p>
                <InfoTip title={STEP_KIND_LABEL[kind]}>{KIND_HINT[kind]}</InfoTip>
              </div>

              {steps.map((step) => {
                const checked = doneSet.has(step.id)
                return (
                  <Card
                    key={step.id}
                    className={`flex items-start gap-3 py-3 transition-colors ${
                      checked ? 'border-[#16B374]/40 bg-[#16B374]/5' : ''
                    }`}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => onToggle(step.id)}
                      aria-label={checked ? `Снять отметку: ${step.title}` : `Отметить: ${step.title}`}
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border transition-colors ${
                        checked
                          ? 'border-[#16B374] bg-[#16B374] text-[#0E1013]'
                          : 'border-[#4A5058] text-transparent hover:border-[#A9AFB7]'
                      }`}
                    >
                      <CheckIcon className="h-4 w-4" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p
                          className={`text-[13.5px] font-bold ${
                            checked ? 'text-[#A9AFB7] line-through' : 'text-[#F3F4F4]'
                          }`}
                        >
                          {step.title}
                        </p>
                        <span className="rounded-[6px] border border-[#363B43] bg-[#23272D] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#A9AFB7]">
                          {step.when}
                        </span>
                        {step.cost && (
                          <span className="font-display-num text-[11.5px] font-bold text-[#A9AFB7]">
                            {step.cost[0] === 0 ? 'бесплатно' : fmtMoney(step.cost[0])}
                            {step.cost[1] > step.cost[0] ? ` – ${fmtMoney(step.cost[1])}` : ''}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-[#A9AFB7]">
                        {step.detail}
                      </p>
                      {step.risk && (
                        <p className="mt-1 text-[11.5px] leading-relaxed text-[#F5A623]">
                          Если пропустить: {step.risk}
                        </p>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )
        })}
      </div>
    </>
  )
}
