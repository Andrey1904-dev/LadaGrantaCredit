import { useState } from 'react'
import { SegmentedControl } from '../components/ui'
import MySchedule from '../components/credit/MySchedule'
import Modeling from '../components/credit/Modeling'

/** Вкладка 2: Кредит — «Мой график» (БД) и «Моделирование» (локальные расчёты и ПДН) */
export default function CreditPage() {
  const [tab, setTab] = useState<'schedule' | 'modeling'>('schedule')

  return (
    <div className="animate-pop-in">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="h-5 w-1.5 rounded-full bg-[#E33337]" aria-hidden="true" />
          <h1 className="font-display-num text-[22px] font-bold uppercase tracking-wide text-[#F3F4F4]">
            Управление автокредитом
          </h1>
        </div>
        <span className="text-[12px] font-medium text-[#A9AFB7]">
          Аннуитетный расчёт · ПДН 30% / 50%
        </span>
      </div>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'schedule', label: 'Мой график' },
          { value: 'modeling', label: 'Моделирование и ПДН' },
        ]}
      />

      <div className="mt-4">{tab === 'schedule' ? <MySchedule /> : <Modeling />}</div>
    </div>
  )
}
