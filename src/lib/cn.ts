/**
 * Tiny class-name joiner for component variants.
 * No dependency (clsx/tailwind-merge are intentionally not added).
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
