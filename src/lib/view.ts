import type { LoanStatus, Tenant } from './types';
import type { MoveOutInput } from './repository/types';
import { bnDigits } from './format';

/**
 * Small display helpers shared by the tenant + loan screens. Pure functions,
 * no IO. Money/number formatting still goes through format.ts.
 */

/** 'রাহাত হোসেন' → 'রা' — avatar initials, matching the design canvas. */
export function initials(name: string): string {
  return name.trim().slice(0, 2);
}

/** Remaining amount on a bill, never negative (seed has a small overpayment). */
export function openAmount(total: number, paid: number): number {
  return Math.max(0, total - paid);
}

/** '01712111002' → '০১৭১২-১১১০০২' */
export function formatPhone(phone: string): string {
  const digits = bnDigits(phone);
  return digits.length === 11 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

/** Move-out resolution copy — handoff §10, canvas wording on 14. */
export const RESOLUTION_LABELS: Record<MoveOutInput['resolution'], string> = {
  refund: 'রিফান্ড',
  hold: 'হোল্ড',
  adjust: 'বকেয়ার সাথে সমন্বয়',
};

export const RESOLUTION_DESCRIPTIONS: Record<MoveOutInput['resolution'], string> = {
  refund: 'নগদে ফেরত দেওয়া হবে',
  hold: 'জমা টাকা পরের রুমে চলে যাবে',
  adjust: 'বকেয়া কেটে বাকি টাকা ফেরত',
};

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  active: 'চলমান',
  completed: 'সম্পন্ন',
  cancelled: 'বন্ধ',
};

/** '2026-08' + (−1) → '2026-07' */
export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const total = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Active tenant name per room, for room pickers / shift lists. */
export function tenantNameByRoom(tenants: Tenant[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tenant of tenants) {
    if (tenant.roomId) map.set(tenant.roomId, tenant.name);
  }
  return map;
}

/** Installment count as a Bengali fraction, e.g. '২/৫ কিস্তি'. */
export function installmentFraction(paid: number, total: number): string {
  return `${bnDigits(paid)}/${bnDigits(total)} কিস্তি`;
}
