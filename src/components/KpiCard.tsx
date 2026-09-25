import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * RentFlow KPI card — port of design-output/components/kpi-card.html.
 * Flat raised surface, hairline border, no shadow. Label (faint) + big number
 * (already formatted with ৳ + Bengali numerals) + one context/trend line.
 */
export type KpiTrendTone = 'warning' | 'success' | 'danger' | 'muted';

export interface KpiTrend {
  text: string;
  tone?: KpiTrendTone;
  /** inline 14px stroke svg */
  icon?: ReactNode;
}

export interface KpiCardProps {
  label: string;
  /** preformatted display string, e.g. bnTaka(52800) */
  value: string;
  /** plain muted context line (use when there is no trend) */
  context?: string;
  trend?: KpiTrend;
  className?: string;
}

const TONES: Record<KpiTrendTone, string> = {
  warning: 'text-warning',
  success: 'text-success',
  danger: 'text-danger',
  muted: 'text-ink-muted',
};

export default function KpiCard({
  label,
  value,
  context,
  trend,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-surface-raised p-4',
        className,
      )}
    >
      <p className="text-sm text-ink-faint">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      {trend ? (
        <p
          className={cn(
            'mt-1 flex items-center gap-1 text-xs',
            TONES[trend.tone ?? 'muted'],
          )}
        >
          {trend.icon}
          {trend.text}
        </p>
      ) : context ? (
        <p className="mt-1 text-xs text-ink-muted">{context}</p>
      ) : null}
    </div>
  );
}
