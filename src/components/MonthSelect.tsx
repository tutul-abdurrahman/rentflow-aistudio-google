import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { bnMonth } from '../lib/format'
import { CalendarIcon, CheckIcon, ChevronDownIcon } from './Icons'

/**
 * RentFlow month dropdown — a compact alternative to the old month-picker
 * sheet. Trigger is styled exactly like the dashboard month pill; the panel is
 * a listbox anchored left/right. Not a modal: closes on option, Esc, or an
 * outside click and returns focus to the trigger.
 */
export interface MonthSelectProps {
  /** currently viewed month, 'YYYY-MM' */
  value: string
  /** selectable months, 'YYYY-MM' */
  months: string[]
  onChange: (month: string) => void
  /** panel anchor; mobile always anchors left and only sm+ honours 'right' */
  align?: 'left' | 'right'
  className?: string
}

const TRIGGER_CLASS =
  'inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-raised px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft active:bg-primary-tint'

const PANEL_CLASS =
  'absolute z-30 mt-1 max-h-72 w-[min(16rem,calc(100vw-1.5rem))] overflow-y-auto rounded-card border border-border bg-surface-raised p-1.5 shadow-pop'

export default function MonthSelect({
  value,
  months,
  onChange,
  align = 'left',
  className,
}: MonthSelectProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const choose = (month: string) => {
    if (month !== value) onChange(month)
    close()
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={TRIGGER_CLASS}
        aria-label="মাস পরিবর্তন করুন"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <CalendarIcon size={16} />
        {bnMonth(value)}
        <ChevronDownIcon size={16} />
      </button>

      {open ? (
        <>
          {/* invisible backdrop catches outside clicks (z-20) */}
          <div
            className="fixed inset-0 z-20"
            aria-hidden="true"
            onClick={close}
          />

          <div
            role="listbox"
            aria-label="মাস"
            className={cn(
              PANEL_CLASS,
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            {months.map((month) => {
              const isCurrent = month === value
              return (
                <button
                  key={month}
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  onClick={() => choose(month)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-button px-3 py-2 text-left text-sm',
                    isCurrent
                      ? 'bg-primary-tint font-semibold text-ink'
                      : 'font-medium text-ink-muted hover:bg-surface-soft',
                  )}
                >
                  <span>{bnMonth(month)}</span>
                  {isCurrent ? (
                    <CheckIcon size={14} className="shrink-0 text-primary" />
                  ) : null}
                </button>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}
