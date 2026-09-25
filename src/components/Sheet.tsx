import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * RentFlow bottom sheet / modal — EXACT recipe from handoff §7 and
 * design-output/components/sheet.html.
 *
 * Phone: bottom sheet. md+: vertically centered card. The panel class below is
 * the locked one-liner (never `md:bottom-auto`). `hidden` is toggled at runtime
 * so the DOM keeps the same element the design uses.
 */
const PANEL_CLASS =
  'fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[28rem] rounded-t-(--radius-card) bg-(--color-surface-raised) px-6 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 shadow-(--shadow-overlay) md:inset-0 md:my-auto md:h-fit md:max-h-[90vh] md:overflow-y-auto md:rounded-(--radius-card) md:pb-6';

const SCRIM_CLASS = 'fixed inset-0 z-40 bg-(--color-ink)/50';

export interface SheetProps {
  open: boolean;
  /** called by scrim click, Esc, or the caller's বাতিল button */
  onClose: () => void;
  /** aria-label for the dialog (the design labels sheets in Bangla) */
  ariaLabel?: string;
  /** panel extras (e.g. a wider max width) */
  className?: string;
  children: ReactNode;
}

export default function Sheet({
  open,
  onClose,
  ariaLabel = 'শিট',
  className,
  children,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const index =
        document.activeElement instanceof HTMLElement
          ? focusable.indexOf(document.activeElement)
          : -1;

      if (event.shiftKey) {
        if (index <= 0) {
          event.preventDefault();
          last.focus();
        }
      } else if (index === focusable.length - 1) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  return (
    <>
      <div
        className={cn(SCRIM_CLASS, !open && 'hidden')}
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={cn(PANEL_CLASS, !open && 'hidden', className)}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
      >
        <div className="mx-auto h-1.5 w-12 rounded-(--radius-pill) bg-(--color-border) md:hidden" />
        {children}
      </div>
    </>
  );
}
