import { Card, Field, InfoTip, SectionTitle } from '../ui'
import { ShieldIcon } from '../icons'
import { WARRANTY_ITEMS, WARRANTY_RULES, warrantyLeft } from '../../lib/ownership'
import { fmtMileage, plural } from '../../utils/format'

interface Props {
  purchaseDate: string | null
  mileage: number
  startMileage: number
  onPurchaseDate(value: string | null): void
}

/**
 * Гарантия LADA: 3 года / 100 000 км на автомобиль и отдельные — более короткие —
 * сроки на узлы. Считаем остаток по дате покупки и пробегу, чтобы владелец успел
 * закрыть дефект по гарантии, а не за свои.
 */
export default function WarrantyCard({
  purchaseDate,
  mileage,
  startMileage,
  onPurchaseDate,
}: Props) {
  return (
    <>
      <SectionTitle
        action={
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#A9AFB7]">
            <ShieldIcon className="h-3.5 w-3.5" />
            гарантийный талон
          </span>
        }
      >
        Гарантия завода
      </SectionTitle>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <Field
              label="Дата покупки"
              type="date"
              value={purchaseDate ?? ''}
              onChange={(e) => onPurchaseDate(e.target.value || null)}
              hint="От неё считаются и гарантия, и интервалы «раз в год»."
            />
          </div>
          <p className="flex-1 text-[11.5px] leading-relaxed text-[#A9AFB7]">
            Пробег в зачёт гарантии: {fmtMileage(Math.max(0, mileage - startMileage))} из 100 000.
          </p>
        </div>

        {!purchaseDate && (
          <p className="rounded-[8px] border border-[#F5A623]/40 bg-[#F5A623]/10 px-3 py-2 text-[11.5px] leading-relaxed text-[#F5A623]">
            Укажите дату покупки — тогда приложение посчитает, сколько гарантии осталось по
            каждому узлу.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {WARRANTY_ITEMS.map((item) => {
            const left = warrantyLeft(item, purchaseDate, mileage, startMileage)
            const color = !left ? '#A9AFB7' : left.expired ? '#EF4444' : left.used > 0.8 ? '#F5A623' : '#16B374'
            return (
              <div key={item.id} className="rounded-[9px] border border-[#363B43] bg-[#1A1D22] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-[13px] font-bold text-[#F3F4F4]">{item.title}</p>
                  <p className="font-display-num text-[12px] font-bold" style={{ color }}>
                    {!left
                      ? `${item.months / 12} ${plural(item.months / 12, ['год', 'года', 'лет'])}${item.km ? ` / ${fmtMileage(item.km)}` : ''}`
                      : left.expired
                        ? 'истекла'
                        : `${left.monthsLeft} ${plural(left.monthsLeft, ['месяц', 'месяца', 'месяцев'])}${
                            left.kmLeft !== null ? ` · ${fmtMileage(left.kmLeft)}` : ''
                          }`}
                  </p>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#23272D]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${(left?.used ?? 0) * 100}%`, backgroundColor: color }}
                  />
                </div>
                {item.note && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#A9AFB7]">{item.note}</p>
                )}
              </div>
            )
          })}
        </div>

        <div className="rounded-[9px] border border-[#363B43] bg-[#0E1013] p-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#A9AFB7]">
              Как не потерять гарантию
            </p>
            <InfoTip title="Условия гарантии">
              Данные из гарантийного талона LADA и разъяснений дилеров. Спорные случаи решает
              причинно-следственная связь: если неоригинальная деталь или пропущенное ТО не
              связаны с поломкой, остальную гарантию сохраняют.
            </InfoTip>
          </div>
          <ul className="flex flex-col gap-1.5">
            {WARRANTY_RULES.map((rule) => (
              <li key={rule} className="flex gap-2 text-[11.5px] leading-relaxed text-[#A9AFB7]">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#E33337]" aria-hidden="true" />
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </>
  )
}
