import { useEffect, useRef, useState } from 'react'

const prefersReduced = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Плавно «докручивает» число до целевого значения (ease-out cubic, ~700 мс).
 * Используется для одометра и ключевых сумм, чтобы цифры оживали, а не
 * прыгали. При prefers-reduced-motion значение выставляется сразу.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(() => (prefersReduced() ? target : 0))
  const shownRef = useRef(prefersReduced() ? target : 0)

  useEffect(() => {
    if (prefersReduced()) {
      shownRef.current = target
      setValue(target)
      return
    }
    const from = shownRef.current
    if (from === target) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = from + (target - from) * eased
      shownRef.current = v
      setValue(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}
