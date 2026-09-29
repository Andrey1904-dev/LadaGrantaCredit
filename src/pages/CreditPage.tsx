import { useState } from 'react'
import { SegmentedControl } from '../components/ui'
import MySchedule from '../components/credit/MySchedule'
import Modeling from '../components/credit/Modeling'

/** Вкладка 2: Кредит — «Мой график» (БД) и «Моделирование» (локальные расчёты) */
export default function CreditPage() {
  const [tab, setTab] = useState<'schedule' | 'modeling'>('schedule')

  return (
    <div className="animate-pop-in">
      <h1 className="mb-3 px-1 text-[20px] font-extrabold text-ink">Кредит</h1>
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'schedule', label: 'Мой график' },
          { value: 'modeling', label: 'Моделирование' },
        ]}
      />
      <div className="mt-3.5">{tab === 'schedule' ? <MySchedule /> : <Modeling />}</div>
    </div>
  )
}
