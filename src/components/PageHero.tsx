import type { ReactNode } from 'react'
import type { DuoAssetMeta } from '../lib/assets'

interface PageHeroProps {
  media: { asset: DuoAssetMeta; caption: string }
  /** Надзаголовок — короткая метка раздела */
  eyebrow?: string
  title: string
  subtitle?: string
  /** Строка статусов под заголовком */
  chips?: ReactNode
  /** Кнопка действия справа (на мобильном уходит под заголовок) */
  action?: ReactNode
  /** Низкая обложка для второстепенных экранов */
  compact?: boolean
  /** Приоритетная загрузка (для первого экрана) */
  priority?: boolean
}

/**
 * Обложка раздела: у каждой вкладки свой кадр дуэта Granta + Vesta
 * (см. PAGE_MEDIA в src/lib/assets.ts), чтобы экраны различались визуально.
 */
export default function PageHero({
  media,
  eyebrow,
  title,
  subtitle,
  chips,
  action,
  compact = false,
  priority = false,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[12px] border border-[#363B43] bg-[#1A1D22]">
      <div className={`relative w-full overflow-hidden bg-[#0E1013] ${compact ? 'h-32 sm:h-40' : 'h-44 sm:h-56'}`}>
        <img
          src={media.asset.src}
          data-webp-src={media.asset.webp}
          alt={media.asset.alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="animate-kenburns h-full w-full object-cover object-center"
        />
        {/* Градиент под текст: не перекрывает автомобиль плашкой */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0E1013] via-[#0E1013]/55 to-[#0E1013]/5"
          aria-hidden="true"
        />
        <span className="absolute right-3 top-3 rounded-[6px] border border-[#363B43] bg-[#0E1013]/80 px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[#A9AFB7] backdrop-blur-sm">
          {media.caption}
        </span>

        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-4">
          <div className="min-w-0">
            {eyebrow && (
              <span className="mb-1 inline-flex items-center gap-1.5 rounded-[6px] border border-[#E33337]/50 bg-[#0E1013]/70 px-2 py-0.5 font-display-num text-[10.5px] font-bold uppercase tracking-widest text-[#E33337] backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E33337]" aria-hidden="true" />
                {eyebrow}
              </span>
            )}
            <h1 className="font-display-num text-[22px] font-bold uppercase leading-tight tracking-wide text-[#F3F4F4] drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] sm:text-[26px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 max-w-[540px] text-[12.5px] leading-relaxed text-[#D3D7DC] drop-shadow-[0_1px_6px_rgba(0,0,0,0.75)]">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>

      {chips && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#363B43]/80 bg-[#1A1D22] px-4 py-2.5">
          {chips}
        </div>
      )}
    </section>
  )
}

/** Компактный статус-чип для строки под обложкой */
export function HeroChip({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon?: ReactNode
  label: string
  value: string
  tone?: 'default' | 'warn' | 'danger' | 'success'
}) {
  const tones: Record<string, string> = {
    default: 'border-[#363B43] bg-[#23272D] text-[#F3F4F4]',
    warn: 'border-[#F5A623]/50 bg-[#F5A623]/12 text-[#F5A623]',
    danger: 'border-[#EF4444]/50 bg-[#EF4444]/12 text-[#EF4444]',
    success: 'border-[#16B374]/50 bg-[#16B374]/12 text-[#16B374]',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[7px] border px-2.5 py-1 text-[12px] font-semibold ${tones[tone]}`}
    >
      {icon}
      <span className="text-[#A9AFB7]">{label}</span>
      <strong className="font-semibold">{value}</strong>
    </span>
  )
}
