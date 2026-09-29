import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from './icons'

interface SheetProps {
  open: boolean
  onClose(): void
  title: string
  children: ReactNode
}

/** Модальное окно в формате BottomSheet (снизу экрана) */
export default function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="animate-fade-in absolute inset-0 bg-black/45"
        onClick={onClose}
        aria-hidden
      />
      <div className="animate-sheet-up relative max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-white px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-ink">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full bg-card p-2 text-muted transition-colors hover:text-ink"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
