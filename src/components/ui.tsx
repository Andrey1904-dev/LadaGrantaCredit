import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

/** Базовые UI-примитивы дизайн-системы LADA */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-card rounded-2xl p-4 ${className}`}>{children}</div>
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const styles: Record<string, string> = {
    primary: 'bg-lada text-white hover:bg-lada-dark disabled:bg-lada/40 shadow-sm shadow-lada/25',
    secondary: 'bg-lada-light text-lada hover:bg-[#d3e5f6] disabled:opacity-50',
    ghost: 'bg-transparent text-muted hover:bg-black/5 disabled:opacity-50',
    danger: 'bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-50',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.97] disabled:pointer-events-none ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  suffix?: string
  hint?: string
}

export function Field({ label, suffix, hint, className = '', ...props }: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      <div className="relative">
        <input
          className={`w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] font-medium text-ink outline-none transition-colors placeholder:font-normal placeholder:text-black/30 focus:border-lada focus:ring-2 focus:ring-lada/15 ${suffix ? 'pr-12' : ''}`}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm font-medium text-muted">
            {suffix}
          </span>
        )}
      </div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-6 flex items-center justify-between px-1">
      <h2 className="text-[15px] font-bold text-ink">{children}</h2>
      {action}
    </div>
  )
}

export function Spinner({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <div
      className={`animate-spin rounded-full border-[3px] border-lada/15 border-t-lada ${className}`}
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
}: {
  icon: ReactNode
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-black/10 px-6 py-8 text-center">
      <div className="text-black/25">{icon}</div>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {text && <p className="text-[13px] leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Горизонтальный переключатель-табы */
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
    <div className="flex rounded-xl bg-card p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[10px] py-2 text-[13px] font-semibold transition-all ${
            value === o.value ? 'bg-white text-lada shadow-sm' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select({ label, className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>}
      <select
        className="w-full appearance-none rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] font-medium text-ink outline-none focus:border-lada"
        {...props}
      >
        {children}
      </select>
    </label>
  )
}
