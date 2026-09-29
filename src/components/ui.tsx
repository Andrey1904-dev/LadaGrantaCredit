import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { GRANTA_ASSETS } from '../lib/assets'

/** Базовые UI-примитивы дизайн-системы LADA Granta Sport */

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-[10px] border border-[#363B43]/85 bg-[#1A1D22] p-4 text-[#F3F4F4] ${className}`}
    >
      {children}
    </div>
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  const styles: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:
      'bg-[#E33337] text-[#F3F4F4] border border-[#E33337] hover:bg-[#C82529] hover:border-[#C82529] disabled:opacity-45',
    secondary:
      'bg-[#23272D] text-[#F3F4F4] border border-[#363B43] hover:border-[#A9AFB7]/60 hover:bg-[#2B3038] disabled:opacity-45',
    ghost:
      'bg-transparent text-[#A9AFB7] border border-transparent hover:bg-[#23272D] hover:text-[#F3F4F4] disabled:opacity-45',
    danger:
      'bg-[#EF4444]/12 text-[#EF4444] border border-[#EF4444]/35 hover:bg-[#EF4444]/20 disabled:opacity-45',
  }
  return (
    <button
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold tracking-tight transition-all duration-180 active:translate-y-[1px] disabled:pointer-events-none ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  suffix?: string
  hint?: string
  badge?: string
  highlighted?: boolean
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, suffix, hint, badge, highlighted = false, className = '', ...props },
  ref,
) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-[#A9AFB7]">{label}</span>
        {badge && (
          <span className="rounded-[6px] border border-[#E33337]/45 bg-[#E33337]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#F3F4F4]">
            {badge}
          </span>
        )}
      </div>
      <div className="relative">
        <input
          ref={ref}
          className={`min-h-[46px] w-full rounded-[10px] border px-3.5 py-2.5 text-[15px] font-semibold text-[#F3F4F4] outline-none transition-colors duration-160 placeholder:font-normal placeholder:text-[#A9AFB7]/40 ${
            highlighted
              ? 'border-[#E33337] bg-[#E33337]/10 focus:border-[#E33337]'
              : 'border-[#363B43] bg-[#23272D] focus:border-[#E33337]'
          } ${suffix ? 'pr-13' : ''}`}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] font-semibold text-[#A9AFB7]">
            {suffix}
          </span>
        )}
      </div>
      {hint && <span className="mt-1.5 block text-[11.5px] leading-relaxed text-[#A9AFB7]">{hint}</span>}
    </label>
  )
})

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-2.5 mt-6 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="h-4 w-1 rounded-full bg-[#E33337]" aria-hidden="true" />
        <h2 className="font-display-num text-[16px] font-semibold uppercase tracking-wide text-[#F3F4F4]">
          {children}
        </h2>
      </div>
      {action}
    </div>
  )
}

export function Spinner({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <div
      className={`animate-spin rounded-full border-[2.5px] border-[#363B43] border-t-[#E33337] ${className}`}
      role="status"
      aria-label="Загрузка"
    />
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  showSportDetail = false,
}: {
  icon: ReactNode
  title: string
  text?: string
  action?: ReactNode
  /** Показывать ли сверху спокойный кадр шильдика SPORT без наложения текста поверх него */
  showSportDetail?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[#363B43] bg-[#1A1D22]">
      {showSportDetail && (
        <div className="relative h-28 w-full overflow-hidden border-b border-[#363B43]/70 bg-[#0E1013]">
          <img
            src={GRANTA_ASSETS.detail.src}
            data-webp-src={GRANTA_ASSETS.detail.webp}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-center opacity-80"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1A1D22] via-transparent to-transparent"
            aria-hidden="true"
          />
        </div>
      )}
      <div className="flex flex-col items-center gap-2.5 px-5 py-7 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#363B43] bg-[#23272D] text-[#E33337]">
          {icon}
        </div>
        <p className="text-[15px] font-bold text-[#F3F4F4]">{title}</p>
        {text && <p className="max-w-[340px] text-[13px] leading-relaxed text-[#A9AFB7]">{text}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  )
}

/** Горизонтальный переключатель-табы в эстетике Granta Sport */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div
      role="tablist"
      // колонки по числу вкладок: контрол используется и с двумя, и с тремя режимами
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      className="grid gap-1 rounded-[10px] border border-[#363B43] bg-[#1A1D22] p-1"
    >
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative min-h-[44px] truncate rounded-[8px] px-2.5 py-2 text-[13px] font-bold transition-all duration-180 ${
              active
                ? 'bg-[#23272D] text-[#F3F4F4] shadow-[inset_0_-2px_0_0_#E33337]'
                : 'text-[#A9AFB7] hover:text-[#F3F4F4]'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Select({
  label,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-[12.5px] font-semibold text-[#A9AFB7]">{label}</span>
      )}
      <select
        className="min-h-[46px] w-full appearance-none rounded-[10px] border border-[#363B43] bg-[#23272D] px-3.5 py-2.5 text-[15px] font-semibold text-[#F3F4F4] outline-none transition-colors focus:border-[#E33337]"
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

/** Техническая табличка госномера РФ в тёмной палитре */
export function LicensePlate({ plate }: { plate?: string | null }) {
  const clean = plate?.trim()
  if (!clean) {
    return (
      <div className="inline-flex items-center gap-2 rounded-[8px] border border-[#363B43] bg-[#23272D] px-2.5 py-1 font-mono text-[12px] font-semibold tracking-wider text-[#A9AFB7]">
        НОМЕР НЕ УКАЗАН
      </div>
    )
  }

  return (
    <div className="inline-flex items-center overflow-hidden rounded-[8px] border border-[#363B43] bg-[#0E1013] shadow-inner">
      <span className="px-2.5 py-1 font-mono text-[13.5px] font-bold uppercase tracking-wider text-[#F3F4F4]">
        {clean}
      </span>
      <span className="flex items-center gap-1 border-l border-[#363B43] bg-[#23272D] px-2 py-1 text-[10px] font-bold tracking-tight text-[#A9AFB7]">
        RUS
      </span>
    </div>
  )
}
