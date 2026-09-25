/**
 * RentFlow — Bangla display formatting.
 *
 * Rule (handoff §4): Bangla UI text, Bengali display numerals (৳১২,৫০০),
 * ASCII form inputs, ৳ currency. Screens format at render time; data
 * stays ASCII everywhere else.
 */

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

/** '01711' → '০১৭১১' */
export function bnDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

/** '০১৭১১' → '01711' — normalize Bengali-digit input back to ASCII */
export function asciiDigits(value: string): string {
  const table = BN_DIGITS as readonly string[];
  return value.replace(/[০-৯]/g, (d) => String(table.indexOf(d)));
}

/** 12345 → '১২,৩৪৫' (Indian/Bangla grouping: last 3, then 2s) */
export function bnNumber(value: number): string {
  const ascii = groupTaka(value);
  return bnDigits(ascii);
}

/** ASCII grouping for ৳ amounts: 12345 → '12,345'; 1234567 → '12,34,567' */
export function groupTaka(value: number): string {
  const neg = value < 0;
  const abs = Math.abs(value);
  let s = String(Math.round(abs));
  if (s.length > 3) {
    const last3 = s.slice(-3);
    let rest = s.slice(0, -3);
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    s = `${rest},${last3}`;
  }
  return (neg ? '-' : '') + s;
}

/** 12345 → '৳১২,৩৪৫' */
export function bnTaka(value: number): string {
  return `৳${bnNumber(value)}`;
}

const BN_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
] as const;

/** '2026-08' → 'আগস্ট ২০২৬' */
export function bnMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${BN_MONTHS[m - 1]} ${bnDigits(y)}`;
}

/** '2026-08-14' → '১৪ আগস্ট ২০২৬' */
export function bnDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${bnDigits(d)} ${BN_MONTHS[m - 1]} ${bnDigits(y)}`;
}

/** Days in a 'YYYY-MM' month. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
