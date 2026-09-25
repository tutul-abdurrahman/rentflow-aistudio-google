import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * RentFlow status chip — port of design-output/components/status-chip.html.
 * Tint background + small dot + label. Semantic mapping:
 * paid=green · partial=amber · due=amber tin+ink · overdue=vermillion · loan=teal.
 */
export type StatusChipVariant =
  | 'paid'
  | 'partial'
  | 'due'
  | 'overdue'
  | 'loan';

export interface StatusChipProps {
  variant: StatusChipVariant;
  /** override the default Bangla label for the variant */
  label?: string;
  children?: ReactNode;
  className?: string;
}

const STYLES: Record<StatusChipVariant, string> = {
  paid: 'bg-success-tint text-success',
  partial: 'bg-warning-tint text-warning',
  due: 'bg-warning-tint text-ink',
  overdue: 'bg-danger-tint text-danger',
  loan: 'bg-info-tint text-info',
};

const DOTS: Record<StatusChipVariant, string> = {
  paid: 'bg-success',
  partial: 'bg-warning',
  due: 'bg-warning',
  overdue: 'bg-danger',
  loan: 'bg-info',
};

const LABELS: Record<StatusChipVariant, string> = {
  paid: 'পরিশোধিত',
  partial: 'আংশিক',
  due: 'বাকি',
  overdue: 'অতিরিক্ত বকেয়া',
  loan: 'লোন',
};

export default function StatusChip({
  variant,
  label,
  children,
  className,
}: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium',
        STYLES[variant],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[variant])} aria-hidden="true" />
      {children ?? label ?? LABELS[variant]}
    </span>
  );
}
