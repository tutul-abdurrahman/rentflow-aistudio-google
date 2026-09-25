import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * RentFlow buttons — pixel port of design-output/components/button.html.
 * Four variants (primary / secondary / danger / ghost) with the five states
 * baked into Tailwind variants: default, hover, active, disabled, plus the
 * global :focus-visible ring from tokens.css. No size scale — the design has
 * exactly one size (px-5 py-3 text-base).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** fills the column: `w-full` (phone CTAs) */
  fullWidth?: boolean;
  /** inline SVG before the label (icon uses stroke-width 1.8, currentColor) */
  leadingIcon?: ReactNode;
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-button px-5 py-3 text-base font-semibold transition-colors';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border border-transparent bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled disabled:text-ink-faint',
  secondary:
    'border border-secondary bg-transparent text-secondary hover:bg-secondary-hover active:bg-secondary-active disabled:border-secondary-disabled disabled:text-secondary-disabled',
  danger:
    'border border-danger bg-transparent text-danger hover:bg-danger-tint active:bg-danger-tint disabled:border-ink-faint disabled:text-ink-faint',
  ghost:
    'bg-transparent text-ink-muted hover:bg-surface-soft active:bg-border disabled:text-ink-faint',
};

export default function Button({
  variant = 'primary',
  fullWidth = false,
  leadingIcon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(BASE, VARIANTS[variant], fullWidth && 'w-full', className)}
      {...rest}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
