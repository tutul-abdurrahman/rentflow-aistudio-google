import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRepository } from '../app/repository';
import Input from '../components/Input';
import PageHeader from '../components/PageHeader';
import RadioCard from '../components/RadioCard';
import { bnMonth } from '../lib/format';

/**
 * Screen 27 — নতুন এন্ট্রি (design-output/screens/27-add-income-expense.html).
 *
 * Locked fields: kind (আয় / ব্যয়), category, amount (ASCII input), date, note.
 * Save → addFinanceEntry → back to 26. The design's invoice/attachment card is
 * intentionally absent: the repository contract (AddFinanceInput) has no
 * attachment field and a local-only picker would imply a persistence that does
 * not exist.
 */

type Kind = 'income' | 'expense';

const CATEGORIES: Record<Kind, string[]> = {
  income: ['ভাড়া', 'পার্কিং', 'পেনাল্টি', 'সার্ভিস চার্জ'],
  expense: ['মেরামত', 'বিদ্যুৎ বিল', 'ওয়েস্ট', 'স্টাফ বেতন'],
};

const SELECT_CLASS =
  'w-full appearance-none rounded-input border border-border bg-surface-raised px-4 py-3 text-md text-ink transition-colors focus:border-border-focus';

export default function AddIncomeExpense() {
  const repo = useRepository();
  const navigate = useNavigate();

  const [propertyName, setPropertyName] = useState('');
  const [month, setMonth] = useState('');
  const [kind, setKind] = useState<Kind>('income');
  const [category, setCategory] = useState(CATEGORIES.income[0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const activeMonth = await repo.getActiveMonth();
      const property = await repo.getProperty();
      if (!alive) return;
      setMonth(activeMonth);
      setPropertyName(property.name);
      const today = new Date().toISOString().slice(0, 10);
      setDate(today.startsWith(activeMonth) ? today : `${activeMonth}-01`);
    })();
    return () => {
      alive = false;
    };
  }, [repo]);

  const chooseKind = (value: string) => {
    const next = value as Kind;
    setKind(next);
    setCategory(CATEGORIES[next][0]);
  };

  const save = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('১ টাকার বেশি পরিমাণ লিখুন।');
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      await repo.addFinanceEntry({
        kind,
        category,
        amount: parsed,
        date,
        note: note.trim() || undefined,
      });
      navigate('/finance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="নতুন এন্ট্রি"
        subtitle={month ? `${propertyName} · ${bnMonth(month)}` : propertyName}
        backTo="/finance"
        backLabel="ফিরে যান"
      />

      <div className="mx-auto w-full max-w-3xl">
        {/* ধরন */}
        <section
          className="mt-4 rounded-card border border-border bg-surface-raised px-5 py-4"
          aria-label="এন্ট্রির ধরন"
        >
          <h2 className="text-sm font-semibold text-ink">ধরন</h2>
          <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="এন্ট্রির ধরন">
            <RadioCard
              name="finance-kind"
              value="income"
              checked={kind === 'income'}
              onChange={chooseKind}
              title="আয়"
            />
            <RadioCard
              name="finance-kind"
              value="expense"
              checked={kind === 'expense'}
              onChange={chooseKind}
              title="ব্যয়"
            />
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            আয় = ভাড়া/পার্কিং/পেনাল্টি · ব্যয় = মেরামত/বিল/বেতন
          </p>
        </section>

        {/* বিবরণ */}
        <section
          className="mt-4 rounded-card border border-border bg-surface-raised px-5 py-4"
          aria-label="এন্ট্রির বিবরণ"
        >
          <h2 className="text-sm font-semibold text-ink">বিবরণ</h2>
          <div className="mt-3 space-y-4">
            <div>
              <label
                htmlFor="finance-category"
                className="mb-1.5 block text-sm font-medium text-ink"
              >
                ক্যাটাগরি
              </label>
              <div className="relative">
                <select
                  id="finance-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className={SELECT_CLASS}
                >
                  {CATEGORIES[kind].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute inset-y-0 right-4 my-auto text-ink-faint"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>

            <Input
              label="পরিমাণ"
              prefix="৳"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="০"
              value={amount}
              error={error}
              onChange={(event) => {
                setError(undefined);
                setAmount(event.target.value);
              }}
            />

            <Input
              label="তারিখ"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />

            <div>
              <label htmlFor="finance-note" className="mb-1.5 block text-sm font-medium text-ink">
                নোট
              </label>
              <textarea
                id="finance-note"
                rows={3}
                placeholder="ঐচ্ছিক — যেমন কোন রুম বা বিলের বিবরণ"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full resize-none rounded-input border border-border bg-surface-raised px-4 py-3 text-md text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
              />
            </div>
          </div>
        </section>

        {/* actions */}
        <div className="mt-4 flex flex-col-reverse gap-3 pb-1 sm:flex-row">
          <Link
            to="/finance"
            className="inline-flex w-full items-center justify-center gap-2 rounded-button border border-secondary bg-surface-raised px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active sm:w-auto"
          >
            বাতিল
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-button border border-transparent bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled disabled:text-ink-faint sm:w-auto"
          >
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
              <path d="M20 6 9 17l-5-5" />
            </svg>
            সংরক্ষণ করুন
          </button>
        </div>
      </div>
    </>
  );
}
