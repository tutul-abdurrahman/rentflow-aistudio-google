import { cn } from '../lib/cn';

/**
 * RentFlow radio card — port of design-output/components/radio-card.html.
 * A choice list, not a tiny radio: whole card is the hit target, selected card
 * takes the focus border + a saffron-tint mix. Dot is 20px with a 10px fill.
 */
export interface RadioCardProps {
  /** radio group name (grouping key) */
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description?: string;
  /** 'radio' (exclusive pick) or 'checkbox' (independent) */
  inputType?: 'radio' | 'checkbox';
  disabled?: boolean;
  className?: string;
}

/** design's `.radio-card.selected` background: 45% saffron tint over raised */
const SELECTED_BG =
  'color-mix(in srgb, var(--color-primary-tint) 45%, var(--color-surface-raised))';

export default function RadioCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  inputType = 'radio',
  disabled = false,
  className,
}: RadioCardProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-card border bg-surface-raised px-4 py-3.5 transition-colors',
        checked ? 'border-border-focus' : 'border-border',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
      style={checked ? { backgroundColor: SELECTED_BG } : undefined}
    >
      <input
        type={inputType}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="sr-only"
      />

      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          checked ? 'border-primary' : 'border-border-strong',
        )}
      >
        <span
          className={cn(
            'h-2.5 w-2.5 rounded-full bg-primary transition-opacity',
            checked ? 'opacity-100' : 'opacity-0',
          )}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        {description ? (
          <span className="block text-xs text-ink-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
