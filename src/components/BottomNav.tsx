import { NavLink } from 'react-router-dom'
import { CardIcon, CarIcon, HomeIcon, WalletIcon } from './icons'

const TABS = [
  { to: '/', label: 'Главная', Icon: HomeIcon, end: true },
  { to: '/credit', label: 'Кредит', Icon: CardIcon, end: false },
  { to: '/expenses', label: 'Расходы', Icon: WalletIcon, end: false },
  { to: '/garage', label: 'Гараж', Icon: CarIcon, end: false },
]

/** Нижний Tab Bar, закреплённый внизу мобильного контейнера */
export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-black/[0.07] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="grid grid-cols-4">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-lada' : 'text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="h-[22px] w-[22px]" />
                <span>{label}</span>
                <span
                  className={`h-1 w-1 rounded-full transition-all ${isActive ? 'bg-lada opacity-100' : 'opacity-0'}`}
                />
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
