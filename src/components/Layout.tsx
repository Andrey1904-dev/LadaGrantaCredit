import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppDataContext'
import BottomNav from './BottomNav'
import { InfoIcon, LogoutIcon } from './icons'

/**
 * Мобильный каркас приложения: на десктопе интерфейс центрируется
 * и выглядит как мобильное приложение (max-w 480px).
 */
export default function Layout() {
  const { signOut, mode, user } = useAuth()
  const { error, refresh } = useAppData()
  const navigate = useNavigate()

  const handleLogout = async () => {
    if (!window.confirm('Выйти из аккаунта?')) return
    await signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-white shadow-[0_0_40px_rgba(0,0,0,0.08)]">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-black/[0.06] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <img src="./favicon.svg" alt="LADA" className="h-8 w-8 rounded-lg" />
          <div className="leading-tight">
            <p className="text-[15px] font-extrabold tracking-tight text-ink">
              LADA <span className="text-lada">Кредит&nbsp;&&nbsp;Гараж</span>
            </p>
            <p className="text-[11px] text-muted">
              {mode === 'demo' ? 'Демо-режим' : user?.email || 'LADA Granta'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Выйти"
          className="rounded-xl p-2 text-muted transition-colors hover:bg-black/5 hover:text-ink"
        >
          <LogoutIcon className="h-5 w-5" />
        </button>
      </header>

      {/* Баннер ошибки БД (например, таблицы ещё не созданы) */}
      {error && (
        <div className="border-b border-warning/30 bg-warning/10 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <InfoIcon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#9a6700]" />
            <div className="flex-1">
              <p className="text-[12.5px] leading-relaxed text-[#9a6700]">{error}</p>
              <button
                onClick={() => void refresh()}
                className="mt-1.5 rounded-lg bg-[#9a6700]/10 px-2.5 py-1 text-[12px] font-semibold text-[#9a6700] transition-colors hover:bg-[#9a6700]/20"
              >
                Повторить
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
