import { useEffect, useState } from 'react';
import { useRepository } from '../app/repository';
import Input from '../components/Input';
import PageHeader from '../components/PageHeader';
import RadioCard from '../components/RadioCard';

/**
 * Screen 31 — বাড়ির তথ্য + রেট + নিয়ম (design-output/screens/31-*.html).
 *
 * Beyond the canvas, the brief locks two extra read/write settings on this
 * screen: the water split rule is shown as a read-only LOCKED rule, and the
 * mid-month rent rule is a RadioCard choice saved through updateProperty.
 * Screen 32 owns ownerName/ownerPhone too; both surfaces write the same fields.
 */

const SECTION = 'mt-4 rounded-card border border-border bg-surface-raised p-4 md:mt-4';
const SAVE_BUTTON =
  'inline-flex w-full items-center justify-center gap-2 rounded-button bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled disabled:text-ink-faint';

export default function PropertyManagement() {
  const repo = useRepository();

  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [rate, setRate] = useState('');
  const [waste, setWaste] = useState('');
  const [midMonthRule, setMidMonthRule] = useState<'day_wise' | 'full_month'>('day_wise');
  const [infoSaved, setInfoSaved] = useState(false);
  const [ratesSaved, setRatesSaved] = useState(false);
  const [rateError, setRateError] = useState<string | undefined>();
  const [wasteError, setWasteError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const property = await repo.getProperty();
      if (!alive) return;
      setName(property.name);
      setAddress(property.address);
      setOwnerName(property.ownerName);
      setOwnerPhone(property.ownerPhone);
      setRate(String(property.electricityRate));
      setWaste(String(property.wasteFee));
      setMidMonthRule(property.midMonthRule);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [repo]);

  const saveInfo = async () => {
    setSaving(true);
    try {
      await repo.updateProperty({ name, address, ownerName, ownerPhone });
      setInfoSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const saveRates = async () => {
    const parsedRate = Number(rate);
    const parsedWaste = Number(waste);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      setRateError('বিদ্যুৎ রেট লিখুন।');
      return;
    }
    if (waste === '' || !Number.isFinite(parsedWaste) || parsedWaste < 0) {
      setRateError(undefined);
      setWasteError('ওয়েস্ট ফি লিখুন।');
      return;
    }
    setRateError(undefined);
    setWasteError(undefined);
    setSaving(true);
    try {
      await repo.updateProperty({ electricityRate: parsedRate, wasteFee: parsedWaste });
      setRatesSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const chooseMidMonthRule = async (value: string) => {
    const next = value === 'full_month' ? 'full_month' : 'day_wise';
    setMidMonthRule(next);
    await repo.updateProperty({ midMonthRule: next });
  };

  return (
    <>
      <PageHeader title="বাড়ির তথ্য" subtitle={name} backTo="/more" backLabel="পেছনে" />

      <div className="mx-auto w-full max-w-3xl">
        {/* বাড়ির তথ্য */}
        <section className={SECTION} aria-label="বাড়ির তথ্য ফর্ম">
          <h2 className="text-base font-semibold text-ink">বাড়ির তথ্য</h2>
          <p className="mt-0.5 text-sm text-ink-muted">বিল ও রিসিটে এই তথ্য দেখানো হবে।</p>

          <div className="mt-4 space-y-4">
            <Input
              label="বাড়ির নাম"
              type="text"
              value={name}
              onChange={(event) => {
                setInfoSaved(false);
                setName(event.target.value);
              }}
            />

            <div>
              <label htmlFor="property-address" className="mb-1.5 block text-sm font-medium text-ink">
                ঠিকানা
              </label>
              <textarea
                id="property-address"
                rows={2}
                value={address}
                onChange={(event) => {
                  setInfoSaved(false);
                  setAddress(event.target.value);
                }}
                className="w-full resize-none rounded-input border border-border bg-surface-raised px-4 py-3 text-md text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
              />
            </div>

            <Input
              label="মালিকের নাম"
              type="text"
              value={ownerName}
              onChange={(event) => {
                setInfoSaved(false);
                setOwnerName(event.target.value);
              }}
            />

            <Input
              label="মোবাইল"
              type="tel"
              inputMode="numeric"
              value={ownerPhone}
              onChange={(event) => {
                setInfoSaved(false);
                setOwnerPhone(event.target.value);
              }}
            />

            <button type="button" onClick={saveInfo} disabled={!loaded || saving} className={SAVE_BUTTON}>
              সেভ করুন
            </button>
            {infoSaved ? <p className="text-xs text-success">সেভ হয়েছে।</p> : null}
          </div>
        </section>

        {/* রেট ও ফি */}
        <section className={SECTION} aria-label="রেট ও ফি">
          <h2 className="text-base font-semibold text-ink">রেট ও ফি</h2>
          <p className="mt-0.5 text-sm text-ink-muted">বিল হিসাবে এই রেট ব্যবহার হবে।</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Input
              label="বিদ্যুৎ রেট (৳/ইউনিট)"
              prefix="৳"
              type="text"
              inputMode="decimal"
              value={rate}
              error={rateError}
              onChange={(event) => {
                setRatesSaved(false);
                setRateError(undefined);
                setRate(event.target.value);
              }}
            />
            <Input
              label="ওয়েস্ট ফি (৳/রুম/মাস)"
              prefix="৳"
              type="text"
              inputMode="numeric"
              value={waste}
              error={wasteError}
              onChange={(event) => {
                setRatesSaved(false);
                setWasteError(undefined);
                setWaste(event.target.value);
              }}
            />
          </div>

          <button type="button" onClick={saveRates} disabled={!loaded || saving} className={`${SAVE_BUTTON} mt-4`}>
            সেভ করুন
          </button>
          {ratesSaved ? <p className="mt-2 text-xs text-success">সেভ হয়েছে।</p> : null}
        </section>

        {/* পানির ভাগের নিয়ম — LOCKED, read-only */}
        <section className={SECTION} aria-label="পানির ভাগের নিয়ম">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">পানির ভাগের নিয়ম</h2>
            <span className="shrink-0 rounded-pill bg-surface-soft px-2.5 py-1 text-xs font-medium text-ink-faint">
              লক করা
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-input border border-border bg-surface-soft px-4 py-3">
            <svg
              className="shrink-0 text-ink-faint"
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
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <p className="text-sm font-semibold text-ink">ব্যবহৃত ইউনিট ÷ (ব্যবহৃত রুম + ১)</p>
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            ভাড়া থাকা রুমের সংখ্যা অনুযায়ী পানির বিল ভাগ হয় — এই নিয়ম বদলানো যাবে না।
          </p>
        </section>

        {/* মাসের মাঝে ভাড়ার নিয়ম */}
        <section className={SECTION} aria-label="মাসের মাঝে ভাড়ার নিয়ম">
          <h2 className="text-base font-semibold text-ink">মাসের মাঝে ভাড়া</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            মাসের মাঝখানে নতুন রেন্টি এলে ভাড়া কীভাবে হিসাব হবে।
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="মাসের মাঝে ভাড়ার নিয়ম">
            <RadioCard
              name="mid-month-rule"
              value="day_wise"
              checked={midMonthRule === 'day_wise'}
              onChange={chooseMidMonthRule}
              title="দিনভিত্তিক"
              description="যে দিনে উঠেছেন, সেই দিন থেকে ভাড়া"
              className="px-3.5 py-3"
            />
            <RadioCard
              name="mid-month-rule"
              value="full_month"
              checked={midMonthRule === 'full_month'}
              onChange={chooseMidMonthRule}
              title="পুরো মাস"
              description="মাসের মাঝে উঠলেও পুরো মাসের ভাড়া"
              className="px-3.5 py-3"
            />
          </div>
        </section>
      </div>
    </>
  );
}
