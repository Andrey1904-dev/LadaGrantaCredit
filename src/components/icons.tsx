interface IconProps {
  className?: string
}

const base = (className?: string) => className ?? 'w-6 h-6'

export const HomeIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={base(className)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </svg>
)

export const CardIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={base(className)}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M2.5 9.5h19" />
    <path d="M6.5 15h4" />
  </svg>
)

export const WalletIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={base(className)}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1" />
    <path d="M3 7.5V17a2.5 2.5 0 0 0 2.5 2.5H19a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 7.5Z" />
    <circle cx="16.5" cy="14" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)

export const CarIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={base(className)}>
    <path d="M4 13l1.4-4.2A2.5 2.5 0 0 1 7.8 7h8.4a2.5 2.5 0 0 1 2.4 1.8L20 13" />
    <rect x="2.5" y="13" width="19" height="5.5" rx="1.5" />
    <path d="M6.5 18.5v1.2a1 1 0 0 0 1 1h.3a1 1 0 0 0 1-1v-1.2M15.2 18.5v1.2a1 1 0 0 0 1 1h.3a1 1 0 0 0 1-1v-1.2" />
    <circle cx="7" cy="15.8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="17" cy="15.8" r="0.9" fill="currentColor" stroke="none" />
  </svg>
)

export const FuelIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={base(className)}>
    <path d="M5 21V5a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 14 5v16" />
    <path d="M3.5 21h12" />
    <path d="M14 9.5h2.2a1.8 1.8 0 0 1 1.8 1.8v5.5a1.9 1.9 0 0 0 3.8 0V9.8a2 2 0 0 0-.6-1.4L18.5 5.7" />
    <path d="M7 6.5h5V11H7z" />
  </svg>
)

export const WrenchIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={base(className)}>
    <path d="M14.7 6.3a4.1 4.1 0 0 0-5.4 5.2L3.8 17a1.8 1.8 0 0 0 2.6 2.6l5.5-5.5a4.1 4.1 0 0 0 5.2-5.4l-2.7 2.7-2.3-.7-.7-2.3 3.3-3.1Z" />
  </svg>
)

export const ShieldIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={base(className)}>
    <path d="M12 3 4.5 6v5.2c0 4.6 3.2 8 7.5 9.8 4.3-1.8 7.5-5.2 7.5-9.8V6L12 3Z" />
    <path d="m9 11.6 2.1 2.1 3.9-4" />
  </svg>
)

export const DotsIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={base(className)}>
    <circle cx="5.5" cy="12" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="18.5" cy="12" r="1.7" />
  </svg>
)

export const PlusIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className={base(className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const CloseIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={base(className)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const TrashIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={base(className)}>
    <path d="M4 7h16M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 12.2a1.5 1.5 0 0 0 1.5 1.3h7a1.5 1.5 0 0 0 1.5-1.3L18 7" />
    <path d="M10 11v6M14 11v6" />
  </svg>
)

export const EditIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={base(className)}>
    <path d="M4 20h4l11-11a2.1 2.1 0 0 0-3-3L5 17l-1 3Z" />
    <path d="m13.5 6.5 3 3" />
  </svg>
)

export const RefreshIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={base(className)}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <path d="M20 3.5V7h-3.5" />
  </svg>
)

export const LogoutIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={base(className)}>
    <path d="M14 4h-7a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 7 20h7" />
    <path d="M10 12h11M17.5 8.5 21 12l-3.5 3.5" />
  </svg>
)

export const CalendarIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={base(className)}>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
)

export const GaugeIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={base(className)}>
    <path d="M4 14a8 8 0 1 1 16 0" />
    <path d="M12 14l3.6-4.4" />
    <circle cx="12" cy="14" r="1.6" fill="currentColor" stroke="none" />
    <path d="M3 19.5h18" />
  </svg>
)

export const PercentIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={base(className)}>
    <path d="M18 6 6 18" />
    <circle cx="8" cy="8" r="2.4" />
    <circle cx="16" cy="16" r="2.4" />
  </svg>
)

export const InfoIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" className={base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)
