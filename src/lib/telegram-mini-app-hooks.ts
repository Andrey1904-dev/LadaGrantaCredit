import { useEffect, useRef } from 'react'
import { getMiniApp, lockVerticalSwipes, pushBackHandler, requestClosingConfirmation } from './telegram-mini-app'

/**
 * Пока `active` — BackButton Telegram вызывает `handler` (например, закрывает
 * открытое окно) вместо перехода по истории. Вне Mini App хук ничего не делает.
 */
export function useTelegramBackHandler(active: boolean, handler: () => void) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  useEffect(() => {
    if (!active || !getMiniApp()) return
    return pushBackHandler(() => handlerRef.current())
  }, [active])
}

/** Подтверждение закрытия Mini App, пока в форме есть несохранённые изменения. */
export function useTelegramClosingConfirmation(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    return requestClosingConfirmation()
  }, [dirty])
}

/** Пока открыто окно — свайп вниз внутри него не сворачивает Mini App. */
export function useTelegramSwipeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    return lockVerticalSwipes()
  }, [active])
}
