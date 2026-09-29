import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppDataContext'
import { resetDemoData } from '../lib/local'
import BottomNav, { NAV_TABS } from './BottomNav'
import { AlertIcon, LogoutIcon, RefreshIcon } from './icons'

/**
 * Основной каркас личного кабинета владельца LADA Granta Sport.
 * Mobile-first (360–390px), адаптируется к планшету (768px) и десктопу (1440px).
 */
export default function Layout() {
  const { signOut, mode, user } = useAuth()
  const { error, refresh } = useAppData()
  const navigate = useNavigate()
  const location = useLocation()
  const isDemo = mode === 'demo'

  const handleLogout = async () => {
    if (!window.confirm(isDemo ? 'Выйти из демо-режима?' : 'Выйти из аккаунта?')) return
    await signOut()
    navigate('/auth', { replace: true })
  }

  const handleResetDemo = async () => {
    if (!window.confirm('Пересоздать демо-данные? Ваши изменения в демо-кабинете будут потеряны.')) return
    resetDemoData()
    await refresh()
  }

  return (
    <div className="min-h-dvh w-full bg-[#0E1013] text-[#F3F4F4]">
      {/* Верхняя шапка */}
      <header className="sticky top-0 z-40 border-b border-[#363B43] bg-[#0E1013]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <img
              src="./logo.png"
              alt="Эмблема кабинета LADA Granta Sport"
              title="«Можно, а зачем?» — а мы уже сделали"
              className="h-9 w-9 shrink-0 rounded-[8px] border border-[#363B43]"
            />
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <p className="font-display-num text-[16px] font-bold uppercase tracking-wide text-[#F3F4F4]">
                  LADA Кредит &amp; Гараж
                </p>
                <span className="rounded-[5px] border border-[#E33337]/50 bg-[#E33337]/15 px-1.5 py-0.5 font-display-num text-[10px] font-bold uppercase tracking-widest text-[#E33337]">
                  SPORT
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-[#A9AFB7]">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    mode === 'demo' ? 'bg-[#F5A623]' : 'bg-[#16B374]'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate max-w-[160px] sm:max-w-[300px]">
                  {isDemo ? 'Демо-режим · данные в браузере' : user?.email || 'Кабинет владельца'}
                </span>
                {isDemo && (
                  <button
                    type="button"
                    onClick={() => void handleResetDemo()}
                    className="hidden shrink-0 items-center gap-1 rounded-[6px] border border-[#F5A623]/45 bg-[#F5A623]/10 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#F5A623] transition-colors hover:bg-[#F5A623]/20 sm:inline-flex"
                  >
                    <RefreshIcon className="h-3 w-3" />
                    Сбросить демо
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Навигация в шапке на широких экранах (дополняет нижнюю панель) */}
          <div className="hidden items-center gap-1 md:flex" role="navigation" aria-label="Быстрые разделы">
            {NAV_TABS.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex min-h-[40px] items-center gap-2 rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    isActive
                      ? 'border border-[#E33337]/50 bg-[#23272D] text-[#F3F4F4]'
                      : 'text-[#A9AFB7] hover:bg-[#1A1D22] hover:text-[#F3F4F4]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-4 w-4 ${isActive ? 'text-[#E33337]' : 'text-[#A9AFB7]'}`} />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            aria-label={isDemo ? 'Выйти из демо-режима' : 'Выйти из аккаунта'}
            title={isDemo ? 'Выйти из демо-режима' : 'Выйти из аккаунта'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#363B43] bg-[#1A1D22] text-[#A9AFB7] transition-colors hover:border-[#E33337]/60 hover:bg-[#23272D] hover:text-[#F3F4F4]"
          >
            <LogoutIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Баннер ошибки БД (например, таблицы ещё не созданы в Supabase) */}
        {error && (
          <div className="border-t border-[#F5A623]/35 bg-[#F5A623]/10 px-4 py-3">
            <div className="mx-auto flex max-w-[960px] items-start gap-3">
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#F5A623]" />
              <div className="flex-1">
                <p className="text-[12.5px] leading-relaxed text-[#F3F4F4]">{error}</p>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="mt-2 inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] border border-[#F5A623]/45 bg-[#23272D] px-3 py-1.5 text-[12px] font-semibold text-[#F5A623] transition-colors hover:bg-[#2B3038]"
                >
                  <RefreshIcon className="h-3.5 w-3.5" />
                  Повторить
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Рабочая область: анимированный переход между разделами */}
      <main className="mx-auto w-full max-w-[960px] flex-1 px-4 pb-28 pt-4">
        <div key={location.pathname} className="animate-page-enter">
          <Outlet />
        </div>

        <footer className="mt-10 border-t border-[#363B43]/50 pt-4 text-center text-[11px] leading-relaxed text-[#A9AFB7]/75">
          Личный кабинет владельца автомобиля (концепт в эстетике LADA Granta Sport). Не является официальным сервисом АО «АВТОВАЗ».
        </footer>
      </main>

      <BottomNav />
    </div>
  )
}
