import type { RentFlowRepository } from './repository/types';
import type { MonthKey } from './types';
import { addMonths } from './view';

/**
 * Month resolution shared by the bill-side screens (02, 04, 17–22, 33).
 *
 * Rule (bug 1/2): `?month=YYYY-MM` → latest billed month → active month.
 * Bill-side screens must never default to a month with no data — screen 03 is
 * the only screen that opens an empty month, as a draft. Carrying the month in
 * the query string (not router state) keeps it across refresh and print.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** True for a well-formed 'YYYY-MM' month key. */
export function isMonthKey(value: string | null | undefined): value is MonthKey {
  return typeof value === 'string' && MONTH_RE.test(value);
}

export async function resolveScreenMonth(
  repo: RentFlowRepository,
  param: string | null | undefined,
): Promise<MonthKey> {
  if (isMonthKey(param)) return param;
  const billed = await repo.getLatestBilledMonth();
  if (billed) return billed;
  return repo.getActiveMonth();
}

/**
 * Screen 03's cycle picker options: every month that has data (a meter entry
 * or bills) unioned with the trailing 12 calendar months up to and including
 * `current`, newest first, never a future month.
 */
export function monthPickerOptions(dataMonths: MonthKey[], current: MonthKey): MonthKey[] {
  const options = new Set<MonthKey>(dataMonths);
  for (let index = 0; index < 12; index += 1) options.add(addMonths(current, -index));
  return [...options].filter((month) => month <= current).sort((a, b) => b.localeCompare(a));
}
