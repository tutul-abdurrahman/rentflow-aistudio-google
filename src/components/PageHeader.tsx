import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/cn';

/**
 * RentFlow page header — port of design-output/components/page-header.html.
 * Back is a 40×40 ghost circle (never a bordered chip), 22px stroke icon.
 * Hub screens omit the back control. Real screens use `pt-5 lg:pt-8`.
 */
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** renders the ghost back circle as a router Link */
  backTo?: string;
  /** renders the ghost back circle as a button (dynamic parents) */
  onBack?: () => void;
  /** aria-label for the back control */
  backLabel?: string;
  /** right-aligned slot (actions) at md+ */
  action?: ReactNode;
  className?: string;
}

function BackIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

const BACK_CLASS =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-soft';

export default function PageHeader({
  title,
  subtitle,
  backTo,
  onBack,
  backLabel = 'পেছনে যান',
  action,
  className,
}: PageHeaderProps) {
  const hasBack = Boolean(backTo || onBack);

  return (
    <header className={cn('pt-5 lg:pt-8', className)}>
      <div
        className={cn(
          hasBack
            ? 'flex items-center gap-2.5'
            : 'flex flex-wrap items-center justify-between gap-3',
        )}
      >
        <div className={cn('flex min-w-0 items-center gap-2.5')}>
          {hasBack ? (
            backTo ? (
              <Link to={backTo} className={BACK_CLASS} aria-label={backLabel}>
                <BackIcon />
              </Link>
            ) : (
              <button type="button" onClick={onBack} className={BACK_CLASS} aria-label={backLabel}>
                <BackIcon />
              </button>
            )
          ) : null}

          <div className="min-w-0">
            <h1
              className={cn(
                'text-xl font-bold text-ink',
                !hasBack && 'leading-tight',
              )}
            >
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {action}
      </div>
    </header>
  );
}
