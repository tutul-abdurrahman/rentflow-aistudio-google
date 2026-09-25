import type { ReactNode } from 'react';
import Button from './Button';
import { cn } from '../lib/cn';

/**
 * RentFlow empty state — port of design-output/components/empty-state.html.
 * Tinted icon disc + title + one caption + a single CTA. Illustration-less.
 */
export interface EmptyStateProps {
  title: string;
  caption?: string;
  /** overrides the default bill-document disc icon */
  icon?: ReactNode;
  /** pass a full node for custom CTAs */
  action?: ReactNode;
  /** convenience: renders a primary Button with a add icon */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

function DefaultIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22V2z" />
      <path d="M9 7h6M9 11h6" />
    </svg>
  );
}

export default function EmptyState({
  title,
  caption,
  icon,
  action,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-card border border-border bg-surface-raised px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint text-primary">
        {icon ?? <DefaultIcon />}
      </span>
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      {caption ? (
        <p className="mt-1.5 max-w-60 text-sm text-ink-muted">{caption}</p>
      ) : null}
      {action ??
        (actionLabel && onAction ? (
          <Button
            className="mt-5"
            onClick={onAction}
            leadingIcon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            }
          >
            {actionLabel}
          </Button>
        ) : null)}
    </div>
  );
}
