import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { LADA_DUO_ASSETS } from '../lib/assets'

/** Базовые UI-примитивы дизайн-системы LADA Granta Sport */

export function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      style={style}
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

/** Кружок «?» — одинаковый для подсказок в карточках и в заголовках секций */
function TipButton({
  open,
  title,
  onClick,
}: {
  open: boolean
  title: string
  onClick(): void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={open ? `Скрыть пояснение: ${title}` : `Что это: ${title}`}
      title={`Что это: ${title}`}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold leading-none transition-colors ${
        open
          ? 'border-[#E33337] bg-[#E33337]/15 text-[#E33337]'
          : 'border-[#4A5058] text-[#A9AFB7] hover:border-[#A9AFB7] hover:text-[#F3F4F4]'
      }`}
    >
      ?
    </button>
  )
}

/** Пояснение, которое раскрывается под строкой */
function TipText({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 w-full rounded-[8px] border border-[#363B43] bg-[#0E1013] px-2.5 py-2 text-[11.5px] leading-relaxed text-[#A9AFB7]">
      {children}
    </p>
  )
}

/**
 * Кнопка-подсказка «?»: раскрывает пояснение к термину прямо под строкой.
 * Нужна там, где в интерфейсе стоят сокращения и отраслевые метрики
 * (ПДН, ₽/км, «оценка по пробегу», прогноз) — чтобы владельцу не приходилось
 * гадать, что именно посчитало приложение и откуда взялась цифра.
 *
 * Родителю нужен `flex-wrap`, иначе пояснению негде развернуться.
 */
export function InfoTip({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <TipButton open={open} title={title} onClick={() => setOpen((v) => !v)} />
      {open && <TipText>{children}</TipText>}
    </>
  )
}

export function SectionTitle({
  children,
  action,
  tip,
}: {
  children: ReactNode
  action?: ReactNode
  /** Пояснение к разделу: рядом с заголовком появится кружок «?» */
  tip?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-2.5 mt-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 shrink-0 rounded-full bg-[#E33337]" aria-hidden="true" />
          <h2 className="font-display-num truncate text-[16px] font-semibold uppercase tracking-wide text-[#F3F4F4]">
            {children}
          </h2>
          {tip && (
            <TipButton
              open={open}
              title={typeof children === 'string' ? children : 'раздел'}
              onClick={() => setOpen((v) => !v)}
            />
          )}
        </div>
        {action}
      </div>
      {tip && open && <TipText>{tip}</TipText>}
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
  showDuoDetail = false,
}: {
  icon: ReactNode
  title: string
  text?: string
  action?: ReactNode
  /** Показывать ли сверху спокойный кадр шильдиков GRANTA | VESTA без наложения текста поверх него */
  showDuoDetail?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[#363B43] bg-[#1A1D22]">
      {showDuoDetail && (
        <div className="relative h-28 w-full overflow-hidden border-b border-[#363B43]/70 bg-[#0E1013]">
          <img
            src={LADA_DUO_ASSETS.detail.src}
            data-webp-src={LADA_DUO_ASSETS.detail.webp}
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
