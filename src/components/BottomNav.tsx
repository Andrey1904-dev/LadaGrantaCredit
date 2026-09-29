import { NavLink } from 'react-router-dom'
import { CardIcon, CarIcon, HomeIcon, WalletIcon } from './icons'

export const NAV_TABS = [
  { to: '/', label: 'Главная', Icon: HomeIcon, end: true },
  { to: '/credit', label: 'Кредит', Icon: CardIcon, end: false },
  { to: '/expenses', label: 'Расходы', Icon: WalletIcon, end: false },
  { to: '/garage', label: 'Гараж', Icon: CarIcon, end: false },
]

/** Нижняя панель навигации с отчётливым красным акцентом активной вкладки и поддержкой safe-area */
export default function BottomNav() {
  return (
    <nav
      aria-label="Основная навигация"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#363B43] bg-[#1A1D22]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <div className="mx-auto grid max-w-[680px] grid-cols-4 px-1.5">
        {NAV_TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-1.5 transition-colors duration-160 ${
                isActive ? 'text-[#F3F4F4]' : 'text-[#A9AFB7] hover:text-[#F3F4F4]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Верхняя планка акцента Sport Red */}
                <span
                  className={`absolute top-0 left-3 right-3 h-[3px] rounded-b-full transition-all duration-180 ${
                    isActive ? 'bg-[#E33337] opacity-100' : 'bg-transparent opacity-0'
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`flex h-7 w-11 items-center justify-center rounded-[8px] transition-colors duration-160 ${
                    isActive ? 'bg-[#E33337]/16 text-[#E33337]' : 'text-[#A9AFB7] group-hover:text-[#F3F4F4]'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={`text-[11.5px] leading-none tracking-tight ${
                    isActive ? 'font-bold text-[#F3F4F4]' : 'font-medium text-[#A9AFB7]'
                  }`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
