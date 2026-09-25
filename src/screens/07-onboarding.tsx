import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Input from '../components/Input';
import { useRepository } from '../app/repository';
import { bnDigits, bnNumber } from '../lib/format';

/**
 * 07 — বাড়ি সেটআপ (bare shell). Wizard from 07-onboarding.html:
 * ভাষা → বাড়ির তথ্য → রুম ও রেট. On finish the property is updated and, only
 * for a genuinely new property (no rooms yet), the configured rooms are added.
 * The mid-month rule is shown as property-level info (default day-wise).
 */

type Step = 1 | 2 | 3;

/** Starting rent for rooms created during onboarding (settings can change it). */
const DEFAULT_ROOM_RENT = 9000;

const STEP_TITLES: Record<Step, string> = {
  1: 'ভাষা নির্বাচন',
  2: 'বাড়ির তথ্য',
  3: 'রুম ও রেট',
};

function BrandLockup() {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      </span>
      <p className="mt-2 text-lg font-bold tracking-tight text-ink">RentFlow</p>
      <p className="text-xs text-ink-faint">আপনার বাড়ি সেটআপ করুন</p>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
      <path d="M2 12h20" />
      <path d="M12 2c2.5 2.6 4 6.3 4 10s-1.5 7.4-4 10c-2.5-2.6-4-6.3-4-10s1.5-7.4 4-10z" />
    </svg>
  );
}

function CheckIcon({ size = 12, strokeWidth = 2.4 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
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
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg
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
      <path d="M5 12h14" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
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
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

interface LangCardProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
  sub: string;
  icon: ReactNode;
  disabled?: boolean;
}

function LangCard({ selected, onSelect, label, sub, icon, disabled }: LangCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      className={`relative flex flex-col items-center rounded-md border p-4 text-center transition-colors ${
        selected
          ? 'border-primary bg-primary-tint'
          : disabled
            ? 'border-border bg-surface-sunken opacity-60'
            : 'border-border bg-surface-raised hover:bg-surface-soft'
      }`}
    >
      <span
        className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-on-primary transition-opacity ${
          selected ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      >
        <CheckIcon />
      </span>
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full ${
          selected ? 'bg-primary text-on-primary' : 'bg-surface-soft text-ink-muted'
        }`}
      >
        {icon}
      </span>
      <span className="mt-3 text-base font-semibold text-ink">{label}</span>
      <span className="mt-0.5 text-xs text-ink-muted">{sub}</span>
    </button>
  );
}

export default function Onboarding() {
  const repo = useRepository();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>(1);
  const [language, setLanguage] = useState<'bn' | 'en'>('bn');

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [propertyError, setPropertyError] = useState(false);

  const [roomCount, setRoomCount] = useState(6);
  const [initialRooms, setInitialRooms] = useState(0);
  const [rate, setRate] = useState('7.5');
  const [waste, setWaste] = useState('200');
  const [submeter, setSubmeter] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [property, rooms] = await Promise.all([
        repo.getProperty(),
        repo.listRooms(),
      ]);
      if (!active) return;
      setName(property.name);
      setAddress(property.address);
      setPhone(property.ownerPhone);
      setRate(String(property.electricityRate));
      setWaste(String(property.wasteFee));
      setInitialRooms(rooms.length);
      setRoomCount(rooms.length > 0 ? rooms.length : 6);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [repo]);

  function goNext() {
    if (step === 2) {
      const ok = name.trim().length > 0 && address.trim().length > 0;
      setPropertyError(!ok);
      if (!ok) return;
    }
    if (step === 3) {
      void finish();
      return;
    }
    setStep((current) => (current + 1) as Step);
  }

  function goBack() {
    setStep((current) => (current - 1) as Step);
  }

  async function finish() {
    if (submitting) return;
    setSubmitting(true);

    const rooms = await repo.listRooms();
    const brandNew = rooms.length === 0;

    await repo.updateProperty({
      name: name.trim(),
      address: address.trim(),
      ownerPhone: phone.trim(),
      electricityRate: Number.parseFloat(rate) || 0,
      wasteFee: Number.parseInt(waste, 10) || 0,
      midMonthRule: 'day_wise',
    });

    // A genuinely new property gets the rooms the owner configured. The demo
    // account already has its seeded rooms, so it is left as-is.
    if (brandNew) {
      for (let index = 0; index < roomCount; index += 1) {
        await repo.addRoom({ number: String(102 + index), rent: DEFAULT_ROOM_RENT });
      }
    }

    setSubmitting(false);
    navigate('/onboarding/success');
  }

  if (loading) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        role="status"
        aria-label="লোড হচ্ছে"
      >
        <span
          className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary"
          aria-hidden="true"
        />
      </div>
    );
  }

  const stepNumber = bnDigits(step);

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <BrandLockup />

        <div className="mt-5 rounded-card border border-border bg-surface-raised p-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-faint">
                ধাপ <span>{stepNumber}</span>/৩
              </span>
              <span className="text-xs font-semibold text-ink">
                {STEP_TITLES[step]}
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={`h-1 flex-1 rounded-full ${step >= index ? 'bg-primary' : 'bg-border'}`}
                />
              ))}
            </div>
          </div>

          {step === 1 ? (
            <section className="mt-6">
              <h1 className="text-lg font-semibold text-ink">ভাষা নির্বাচন</h1>
              <p className="mt-1 text-sm text-ink-muted">
                অ্যাপটি বাংলায় চলে।
              </p>

              <div
                className="mt-4 grid grid-cols-2 gap-3"
                role="radiogroup"
                aria-label="ভাষা নির্বাচন"
              >
                <LangCard
                  selected={language === 'bn'}
                  onSelect={() => setLanguage('bn')}
                  label="বাংলা"
                  sub="মাতৃভাষা"
                  icon={<HomeIcon />}
                />
                <LangCard
                  selected={false}
                  onSelect={() => setLanguage('en')}
                  label="English"
                  sub="ইংরেজি · শীঘ্রই"
                  icon={<GlobeIcon />}
                  disabled
                />
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="mt-6">
              <h1 className="text-lg font-semibold text-ink">বাড়ির তথ্য</h1>
              <p className="mt-1 text-sm text-ink-muted">
                রেন্ট-বিল হিসাবের জন্য বাড়ির নাম আর ঠিকানা দিন।
              </p>

              <div className="mt-5">
                <Input
                  label="বাড়ির নাম"
                  type="text"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setPropertyError(false);
                  }}
                  error={
                    propertyError && !name.trim()
                      ? 'বাড়ির নাম দিন।'
                      : undefined
                  }
                />
                <Input
                  containerClassName="mt-4"
                  label="ঠিকানা"
                  type="text"
                  value={address}
                  onChange={(event) => {
                    setAddress(event.target.value);
                    setPropertyError(false);
                  }}
                  error={
                    propertyError && !address.trim()
                      ? 'ঠিকানা দিন।'
                      : undefined
                  }
                />
                <Input
                  containerClassName="mt-4"
                  label="মোবাইল নম্বর"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />

                <p className="mt-2 text-xs text-ink-faint">
                  এই সব তথ্য পরে সেটিংস থেকে বদলাতে পারবেন।
                </p>
                <p className="mt-2 rounded-md border border-border bg-surface-soft p-3 text-xs leading-relaxed text-ink-muted">
                  মাসের মাঝখানে ভাড়াটে উঠলে ভাড়া দিন-ভিত্তিক হিসাব হবে
                  (ডিফল্ট)। পরে সেটিংস থেকে এটা বদলানো যাবে।
                </p>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="mt-6">
              <h1 className="text-lg font-semibold text-ink">রুম ও রেট</h1>
              <p className="mt-1 text-sm text-ink-muted">
                কয়টা রুম আর কোন রেটে বিল হবে সেটা দিন। পরে বদলানো যাবে।
              </p>

              <div className="mt-4">
                <div className="flex items-center justify-between rounded-md border border-border p-4">
                  <div>
                    <p className="text-sm font-medium text-ink">রুম সংখ্যা</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      ভাড়া দেওয়ার মোট রুম
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="রুম সংখ্যা কমান"
                      onClick={() =>
                        setRoomCount((value) => Math.max(1, value - 1))
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-secondary text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
                    >
                      <MinusIcon />
                    </button>
                    <span className="w-8 text-center text-lg font-bold text-ink">
                      {bnDigits(roomCount)}
                    </span>
                    <button
                      type="button"
                      aria-label="রুম সংখ্যা বাড়ান"
                      onClick={() =>
                        setRoomCount((value) => Math.min(20, value + 1))
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Input
                    label="বিদ্যুৎ রেট (৳/ইউনিট)"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    prefix="৳"
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                  />
                  <Input
                    label="ওয়েস্ট ফি (৳/রুম/মাস)"
                    type="number"
                    inputMode="numeric"
                    prefix="৳"
                    value={waste}
                    onChange={(event) => setWaste(event.target.value)}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink">
                        সাব-মিটার আছে
                      </p>
                      <span className="shrink-0 rounded-pill bg-surface-soft px-2 py-0.5 text-xs font-medium text-ink-faint">
                        শীঘ্রই
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      আলাদা সাব-মিটার শীঘ্রই আসছে — এখন মেইন মিটারের রিডিং দিয়ে ভাগ হবে।
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={submeter}
                    aria-disabled="true"
                    disabled
                    aria-label="সাব-মিটার আছে কিনা (শীঘ্রই আসছে)"
                    onClick={() => setSubmeter((value) => !value)}
                    className={`relative h-[26px] w-11 shrink-0 rounded-pill opacity-60 transition-colors ${
                      submeter ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-[22px] w-[22px] rounded-full bg-surface-raised shadow-pop transition-transform ${
                        submeter ? 'translate-x-[18px]' : 'translate-x-0.5'
                      }`}
                      style={{ left: 0 }}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                <p className="mt-3 text-xs text-ink-faint">
                  {bnNumber(roomCount)}টি রুম{' '}
                  {initialRooms > 0 ? 'আছে' : 'যোগ হবে'} · ভাড়াটে যোগ করার সময়
                  প্রতি রুমের ভাড়া বদলাতে পারবেন।
                </p>
              </div>
            </section>
          ) : null}
        </div>

        <div className="mt-4 flex gap-3">
          {step > 1 ? (
            <Button variant="secondary" className="flex-1" onClick={goBack}>
              পিছনে
            </Button>
          ) : null}
          <Button
            className="flex-1"
            disabled={submitting}
            onClick={goNext}
            leadingIcon={step === 3 ? undefined : <ArrowRightIcon />}
          >
            {step === 3 ? (
              submitting ? (
                'সেটআপ হচ্ছে…'
              ) : (
                'শুরু করুন'
              )
            ) : (
              'পরের ধাপ'
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
