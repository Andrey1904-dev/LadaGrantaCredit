import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  backButtonPlan,
  backHandlerCount,
  getMiniApp,
  markMiniAppReady,
  parentRoute,
  peekPendingStartRoute,
  runTopBackHandler,
  subscribeBackHandlers,
  supports,
  takePendingStartRoute,
} from '../lib/telegram-mini-app'

/** Индекс текущей записи React Router в истории сайта (0 — первая запись сессии). */
function routerHistoryIndex(): number {
  const state = window.history.state as { idx?: unknown } | null
  return typeof state?.idx === 'number' ? state.idx : 0
}

/**
 * React-слой Telegram Mini App. Рендерится внутри HashRouter и AuthProvider,
 * ничего не рисует. Вне Telegram — ничего не делает.
 *
 *   • сообщает Telegram `ready()` после первого рендера;
 *   • синхронизирует BackButton с навигацией (на корне кнопка скрыта и Mini App
 *     не закрывается);
 *   • открывает раздел из deep link после штатной проверки авторизации.
 */
export default function TelegramMiniAppBridge() {
  const webApp = getMiniApp()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const handlers = useSyncExternalStore(subscribeBackHandlers, backHandlerCount, backHandlerCount)

  useEffect(() => {
    markMiniAppReady()
  }, [])

  // Deep link: RequireAuth сначала отправит на /auth, а после входа — открываем раздел.
  useEffect(() => {
    if (!webApp || loading || !user || location.pathname === '/auth') return
    if (!peekPendingStartRoute()) return
    const target = takePendingStartRoute()
    if (target && target !== location.pathname) navigate(target, { replace: true })
  }, [webApp, user, loading, location.pathname, navigate])

  const planRef = useRef(backButtonPlan({ pathname: location.pathname, historyIndex: 0, pendingHandlers: 0 }))
  const plan = backButtonPlan({
    pathname: location.pathname,
    historyIndex: routerHistoryIndex(),
    pendingHandlers: handlers,
  })
  planRef.current = plan

  const onBack = useCallback(() => {
    const current = planRef.current
    if (current.action === 'handler' && runTopBackHandler()) return
    if (current.action === 'history') {
      navigate(-1)
      return
    }
    if (current.action === 'parent') navigate(parentRoute(location.pathname), { replace: true })
  }, [navigate, location.pathname])

  const back = webApp && supports(webApp, '6.1') ? webApp.BackButton : undefined

  useEffect(() => {
    if (!back) return
    try {
      back.onClick?.(onBack)
    } catch {
      return
    }
    return () => {
      try {
        back.offClick?.(onBack)
      } catch {
        /* SDK недоступен — нечего снимать */
      }
    }
  }, [back, onBack])

  useEffect(() => {
    if (!back) return
    try {
      if (plan.visible) back.show?.()
      else back.hide?.()
    } catch {
      /* кнопка необязательна */
    }
  }, [back, plan.visible])

  return null
}
