import { useEffect, useState } from 'react'

/**
 * Заставка при входе на сайт: эмблема-«кораблик», название кабинета
 * и отсылка к народному мему про LADA — «можно, а зачем?».
 * Показывается один раз на загрузку страницы (~1.3 с), затем плавно уходит.
 */
export default function SplashScreen() {
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setLeaving(true), 1250)
    const goneTimer = window.setTimeout(() => setGone(true), 1700)
    return () => {
      window.clearTimeout(leaveTimer)
      window.clearTimeout(goneTimer)
    }
  }, [])

  if (gone) return null

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#0E1013] ${
        leaving ? 'animate-splash-out' : ''
      }`}
    >
      {/* Красное свечение позади эмблемы */}
      <div
        className="animate-glow-pulse pointer-events-none absolute h-72 w-72 rounded-full bg-[#E33337]/14 blur-3xl"
        aria-hidden="true"
      />

      <img
        src="./logo.png"
        alt=""
        className="animate-splash-logo h-24 w-24 rounded-[20px] border border-[#363B43] shadow-2xl shadow-black/70"
      />

      <p
        className="animate-splash-logo font-display-num mt-5 text-[20px] font-bold uppercase tracking-widest text-[#F3F4F4]"
        style={{ animationDelay: '120ms' }}
      >
        LADA <span className="text-[#E33337]">Кредит</span> &amp; Гараж
      </p>

      {/* Народный мем про качество LADA — с юмором и уже без вопроса «зачем» */}
      <p
        className="animate-splash-logo mt-1.5 text-[12px] font-medium tracking-wide text-[#A9AFB7]"
        style={{ animationDelay: '220ms' }}
      >
        «Можно, а зачем?» — а мы уже сделали
      </p>

      {/* Полоса прогресса */}
      <div className="mt-6 h-[3px] w-40 overflow-hidden rounded-full bg-[#23272D]">
        <div className="animate-splash-line h-full w-full bg-[#E33337]" />
      </div>
    </div>
  )
}
