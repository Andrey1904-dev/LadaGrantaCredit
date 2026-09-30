import { useCallback, useEffect, type ReactNode } from 'react'
import { CloseIcon } from './icons'
import { useTelegramBackHandler, useTelegramClosingConfirmation, useTelegramSwipeLock } from '../lib/telegram-mini-app-hooks'
import { confirmAction } from '../lib/telegram-mini-app'

interface SheetProps {
  open: boolean
  onClose(): void
  title: string
  children: ReactNode
  /**
   * В форме есть несохранённые изменения. Используется только внутри Telegram
   * Mini App: BackButton спросит подтверждение, а закрытие Mini App — предупредит.
   */
  dirty?: boolean
}

/** Модальное окно в формате BottomSheet (снизу экрана на мобильном, по центру на десктопе) */
export default function Sheet({ open, onClose, title, children, dirty = false }: SheetProps) {
  // BackButton Telegram закрывает окно, а не уводит со страницы.
  const handleTelegramBack = useCallback(() => {
    if (!dirty) {
      onClose()
      return
    }
    void confirmAction('Закрыть без сохранения? Введённые данные будут потеряны.').then((ok) => {
      if (ok) onClose()
    })
  }, [dirty, onClose])
  useTelegramBackHandler(open, handleTelegramBack)
  useTelegramClosingConfirmation(open && dirty)
  useTelegramSwipeLock(open)

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
    <div
      className="tg-fit-viewport fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="animate-fade-in absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="tg-sheet-panel animate-sheet-up relative max-h-[92dvh] w-full max-w-[500px] overflow-y-auto rounded-t-[14px] border-t border-[#363B43] bg-[#1A1D22] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 text-[#F3F4F4] sm:rounded-[12px] sm:border sm:pb-6">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#363B43] sm:hidden" />
        <div className="mb-4 flex items-center justify-between border-b border-[#363B43]/70 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-[#E33337]" aria-hidden="true" />
            <h3 className="font-display-num text-[18px] font-bold uppercase tracking-wide text-[#F3F4F4]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#363B43] bg-[#23272D] text-[#A9AFB7] transition-colors hover:border-[#A9AFB7] hover:text-[#F3F4F4]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
