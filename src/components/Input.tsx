import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * RentFlow text field — port of design-output/components/input.html.
 * Visible Bangla label above the control, hairline field, helper/error/success
 * line below. Value stays ASCII (format.ts handles Bengal numerals at render).
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** faint helper line, hidden while error/success is shown */
  helper?: string;
  /** vermillion border + message */
  error?: string;
  /** green border + message */
  success?: string;
  /** static adornment inside the field, e.g. '৳' */
  prefix?: string;
  /** static adornment inside the field, e.g. 'ইউনিট' */
  suffix?: string;
  /** wrapper spacing hook */
  containerClassName?: string;
}

const FIELD =
  'w-full rounded-input border bg-surface-raised py-3 text-md text-ink transition-colors placeholder:text-ink-faint';

export default function Input({
  label,
  helper,
  error,
  success,
  prefix,
  suffix,
  containerClassName,
  className,
  id,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;

  const state = error ? 'error' : success ? 'success' : 'default';
  const border =
    state === 'error'
      ? 'border-danger focus:border-danger'
      : state === 'success'
        ? 'border-success focus:border-success'
        : 'border-border focus:border-border-focus';

  const padding = prefix
    ? suffix
      ? 'pl-10 pr-16'
      : 'pl-10 pr-4'
    : suffix
      ? 'pl-4 pr-16'
      : 'px-4';

  return (
    <div className={containerClassName}>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-sm font-medium text-ink"
      >
        {label}
      </label>

      <div className={prefix || suffix ? 'relative' : undefined}>
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-md font-medium text-ink-faint">
            {prefix}
          </span>
        ) : null}

        <input
          id={inputId}
          className={cn(FIELD, border, padding, className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || success || helper ? messageId : undefined}
          {...rest}
        />

        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-faint">
            {suffix}
          </span>
        ) : null}
      </div>

      {error ? (
        <p id={messageId} className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3 1 21h22L12 3z" />
            <path d="M12 10v5" />
            <path d="M12 18h.01" />
          </svg>
          {error}
        </p>
      ) : success ? (
        <p id={messageId} className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m8 12 3 3 5-6" />
          </svg>
          {success}
        </p>
      ) : helper ? (
        <p id={messageId} className="mt-1.5 text-xs text-ink-faint">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
