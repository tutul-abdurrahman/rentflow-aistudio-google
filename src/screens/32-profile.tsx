import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepository } from '../app/repository';
import Input from '../components/Input';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import { signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { asciiDigits, bnDigits } from '../lib/format';

/**
 * Screen 32 — প্রোফাইল (design-output/screens/32-profile.html).
 *
 * Owner name/phone come from getProperty(); email comes from the Supabase
 * session. Password change follows handoff §8: OTP is required, so the flow is
 * email → 'ওটিপি পাঠান' (signInWithOtp) → token (verifyOtp) → new password
 * (updateUser). The canvas designs the OTP step against the owner's phone; the
 * brief locks the email channel, so only that copy is adapted.
 *
 * Warning: never fire the OTP during automated checks — the free SMTP tier is
 * limited to ~2 emails/hour.
 */

type PwStep = 'request' | 'verify' | 'password' | 'done';

const SECTION = 'mt-4 rounded-card border border-border bg-surface-raised p-4';

function PasswordIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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
  );
}

function formatPhone(phone: string): string {
  const digits = bnDigits(phone);
  return digits.length >= 6 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors ${
        checked ? 'bg-primary' : 'bg-border'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface-raised shadow-pop transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

export default function Profile() {
  const repo = useRepository();
  const navigate = useNavigate();

  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [infoSaved, setInfoSaved] = useState(false);

  // password change
  const [pwStep, setPwStep] = useState<PwStep>('request');
  const [pwEmail, setPwEmail] = useState('');
  const [otp, setOtp] = useState<string[]>(Array.from({ length: 6 }, () => ''));
  const [otpError, setOtpError] = useState<string | undefined>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMessage, setPwMessage] = useState<string | undefined>();
  const [pwError, setPwError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // ui-only preferences (no persistence surface in the foundation)
  const [language, setLanguage] = useState<'bn' | 'en'>('bn');
  const [notifyDue, setNotifyDue] = useState(true);
  const [notifyBill, setNotifyBill] = useState(true);
  const [notifyCollection, setNotifyCollection] = useState(false);

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [property, { data }] = await Promise.all([
        repo.getProperty(),
        supabase.auth.getUser(),
      ]);
      if (!alive) return;
      setOwnerName(property.ownerName);
      setOwnerPhone(property.ownerPhone);
      const email = data.user?.email ?? '';
      setAuthEmail(email);
      setPwEmail(email);
    })();
    return () => {
      alive = false;
    };
  }, [repo]);

  const saveInfo = async () => {
    await repo.updateProperty({ ownerName, ownerPhone });
    setInfoSaved(true);
  };

  const sendOtp = async () => {
    if (!pwEmail.trim()) {
      setPwError('ইমেইল লিখুন।');
      return;
    }
    setBusy(true);
    setPwError(undefined);
    setPwMessage(undefined);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: pwEmail.trim() });
      if (error) {
        setPwError('ওটিপি পাঠানো যায়নি। আবার চেষ্টা করুন।');
        return;
      }
      setOtp(Array.from({ length: 6 }, () => ''));
      setOtpError(undefined);
      setPwStep('verify');
      requestAnimationFrame(() => otpRefs.current[0]?.focus());
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    const token = otp.join('');
    if (token.length !== 6) {
      setOtpError('৬ সংখ্যার ওটিপি দিন।');
      return;
    }
    setBusy(true);
    setOtpError(undefined);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: pwEmail.trim(),
        token,
        type: 'email',
      });
      if (error) {
        setOtpError('ওটিপি মেলেনি বা মেয়াদ শেষ হয়েছে।');
        return;
      }
      setPwStep('password');
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    setBusy(true);
    setOtpError(undefined);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: pwEmail.trim() });
      if (error) {
        setOtpError('আবার পাঠানো যায়নি।');
        return;
      }
      setOtp(Array.from({ length: 6 }, () => ''));
      setPwMessage('নতুন ওটিপি পাঠানো হয়েছে।');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 6) {
      setPwError('কমপক্ষে ৬ অক্ষরের নতুন পাসওয়ার্ড দিন।');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('দুই জায়গায় একই পাসওয়ার্ড লিখুন।');
      return;
    }
    setBusy(true);
    setPwError(undefined);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPwError('পাসওয়ার্ড বদলানো যায়নি। আবার চেষ্টা করুন।');
        return;
      }
      setNewPassword('');
      setConfirmPassword('');
      setPwStep('done');
      setPwMessage('পাসওয়ার্ড বদলানো হয়েছে।');
    } finally {
      setBusy(false);
    }
  };

  const handleOtpChange = (index: number, raw: string) => {
    const digit = asciiDigits(raw).replace(/\D/g, '').slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setOtpError(undefined);
    if (digit && index < otpRefs.current.length - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const confirmLogout = async () => {
    setSigningOut(true);
    try {
      await signOut(navigate);
    } finally {
      setSigningOut(false);
      setLogoutOpen(false);
    }
  };

  return (
    <>
      <PageHeader title="প্রোফাইল" backTo="/more" backLabel="পেছনে" />

      <div className="mx-auto w-full max-w-3xl">
        {/* profile header */}
        <div className="mt-4 flex flex-col items-center text-center md:mt-6">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-tint text-3xl font-bold text-ink">
            {ownerName ? ownerName.charAt(0) : 'র'}
          </span>
          <h1 className="mt-3 text-xl font-bold text-ink">{ownerName || '—'}</h1>
          <p className="text-sm font-medium text-ink-muted">মালিক</p>
          <p className="text-xs text-ink-faint">{ownerPhone ? formatPhone(ownerPhone) : '—'}</p>
        </div>

        {/* প্রোফাইল তথ্য */}
        <section className={SECTION} aria-label="প্রোফাইল তথ্য">
          <h2 className="text-base font-semibold text-ink">প্রোফাইল তথ্য</h2>
          <div className="mt-4 space-y-4">
            <Input
              label="নাম"
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
            <Input
              label="ইমেইল (ঐচ্ছিক)"
              type="email"
              value={authEmail}
              readOnly
              helper="অ্যাকাউন্টের ইমেইল — এখান থেকে বদলানো যাবে না।"
            />
            <button
              type="button"
              onClick={saveInfo}
              className="inline-flex w-full items-center justify-center gap-2 rounded-button border border-transparent bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active sm:w-auto"
            >
              সংরক্ষণ করুন
            </button>
            {infoSaved ? <p className="text-xs text-success">সংরক্ষণ হয়েছে।</p> : null}
          </div>
        </section>

        {/* পাসওয়ার্ড পরিবর্তন */}
        <section className={SECTION} aria-label="পাসওয়ার্ড পরিবর্তন">
          <h2 className="text-base font-semibold text-ink">পাসওয়ার্ড পরিবর্তন</h2>

          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="pw-email" className="mb-1.5 block text-sm font-medium text-ink">
                ইমেইল
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  id="pw-email"
                  type="email"
                  inputMode="email"
                  value={pwEmail}
                  onChange={(event) => setPwEmail(event.target.value)}
                  className="w-full rounded-input border border-border bg-surface-raised px-4 py-3 text-md text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
                />
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={busy}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-button bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled disabled:text-ink-faint"
                >
                  ওটিপি পাঠান
                </button>
              </div>
              <p className="mt-1.5 text-xs text-ink-faint">ওটিপি ছাড়া পাসওয়ার্ড বদলাবে না।</p>
            </div>

            {pwStep !== 'request' ? (
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-ink">ওটিপি দিন</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  <span className="font-semibold text-ink">{pwEmail}</span> ইমেইলে পাঠানো ৬ সংখ্যার
                  ওটিপি লিখুন।
                </p>

                <div className="mt-4 grid grid-cols-6 gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(node) => {
                        otpRefs.current[index] = node;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      disabled={pwStep !== 'verify'}
                      onChange={(event) => handleOtpChange(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKeyDown(index, event.key)}
                      aria-label={`ওটিপি ${bnDigits(index + 1)} নম্বর অঙ্ক`}
                      className={`w-full rounded-input border bg-surface-raised py-3 text-center text-md text-ink transition-colors focus:border-border-focus ${
                        otpError ? 'border-danger' : 'border-border'
                      }`}
                    />
                  ))}
                </div>

                {otpError ? <p className="mt-2 text-xs text-danger">{otpError}</p> : null}

                {pwStep === 'verify' ? (
                  <>
                    <button
                      type="button"
                      onClick={verifyOtp}
                      disabled={busy}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-button bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled disabled:text-ink-faint sm:w-auto"
                    >
                      ওটিপি যাচাই করুন
                    </button>
                    <p className="mt-3 text-center text-sm text-ink-muted">
                      ওটিপি পাননি?{' '}
                      <button
                        type="button"
                        onClick={resendOtp}
                        disabled={busy}
                        className="font-semibold text-primary transition-colors hover:text-primary-hover"
                      >
                        আবার পাঠান
                      </button>
                    </p>
                  </>
                ) : null}

                {pwStep === 'password' || pwStep === 'done' ? (
                  <div className="mt-4 space-y-4">
                    {pwStep === 'password' ? (
                      <>
                        <Input
                          label="নতুন পাসওয়ার্ড"
                          type="password"
                          placeholder="নতুন পাসওয়ার্ড দিন"
                          value={newPassword}
                          onChange={(event) => {
                            setPwError(undefined);
                            setNewPassword(event.target.value);
                          }}
                        />
                        <Input
                          label="নতুন পাসওয়ার্ড আবার দিন"
                          type="password"
                          placeholder="নতুন পাসওয়ার্ড আবার লিখুন"
                          value={confirmPassword}
                          onChange={(event) => {
                            setPwError(undefined);
                            setConfirmPassword(event.target.value);
                          }}
                        />
                        <button
                          type="button"
                          onClick={changePassword}
                          disabled={busy}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-button bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled disabled:text-ink-faint sm:w-auto"
                        >
                          পাসওয়ার্ড বদলান
                        </button>
                      </>
                    ) : (
                      <p className="flex items-center gap-2 text-sm font-semibold text-success">
                        <PasswordIcon size={18} />
                        পাসওয়ার্ড বদলানো হয়েছে।
                      </p>
                    )}
                  </div>
                ) : null}

                {pwMessage ? (
                  <p className="mt-3 text-center text-sm font-semibold text-success">{pwMessage}</p>
                ) : null}
              </div>
            ) : null}

            {pwError ? <p className="text-xs text-danger">{pwError}</p> : null}
          </div>
        </section>

        {/* ভাষা */}
        <section className={SECTION} aria-label="ভাষা">
          <h2 className="text-base font-semibold text-ink">ভাষা</h2>
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-md bg-surface-soft p-1">
            <button
              type="button"
              aria-pressed={language === 'bn'}
              onClick={() => setLanguage('bn')}
              className={`rounded-md px-4 py-2 text-sm transition-colors ${
                language === 'bn'
                  ? 'bg-surface-raised font-semibold text-ink shadow-pop'
                  : 'font-medium text-ink-muted'
              }`}
            >
              বাংলা
            </button>
            <button
              type="button"
              aria-pressed={language === 'en'}
              onClick={() => setLanguage('en')}
              className={`rounded-md px-4 py-2 text-sm transition-colors ${
                language === 'en'
                  ? 'bg-surface-raised font-semibold text-ink shadow-pop'
                  : 'font-medium text-ink-muted'
              }`}
            >
              English
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-faint">ইংরেজি ভাষা শীঘ্রই আসছে।</p>
        </section>

        {/* নোটিফিকেশন */}
        <section className="mt-4 rounded-card border border-border bg-surface-raised" aria-label="নোটিফিকেশন">
          <h2 className="px-4 pt-4 text-base font-semibold text-ink">নোটিফিকেশন</h2>
          <div className="mt-1 divide-y divide-border">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">বকেয়া রিমাইন্ডার</p>
                <p className="truncate text-xs text-ink-muted">কারও বাকি থাকলে আপনাকে মনে করিয়ে দেবে</p>
              </div>
              <span className="shrink-0 rounded-pill bg-surface-soft px-2 py-0.5 text-xs font-medium text-ink-faint">
                শীঘ্রই
              </span>
              <Switch
                checked={notifyDue}
                onChange={setNotifyDue}
                label="বকেয়া রিমাইন্ডার চালু বা বন্ধ (শীঘ্রই আসছে)"
                disabled
              />
            </div>

            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info-tint text-info">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22V2z" />
                  <path d="M9 7h6M9 11h6M9 15h4" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">বিল তৈরি</p>
                <p className="truncate text-xs text-ink-muted">নতুন বিল তৈরি হলে জানাবে</p>
              </div>
              <span className="shrink-0 rounded-pill bg-surface-soft px-2 py-0.5 text-xs font-medium text-ink-faint">
                শীঘ্রই
              </span>
              <Switch
                checked={notifyBill}
                onChange={setNotifyBill}
                label="বিল তৈরি নোটিফিকেশন চালু বা বন্ধ (শীঘ্রই আসছে)"
                disabled
              />
            </div>

            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-tint text-success">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v10M15 9.5c-.5-1-1.6-1.5-3-1.5-1.6 0-3 .8-3 2.2 0 3 6 1.3 6 4.3 0 1.4-1.4 2.2-3 2.2-1.4 0-2.5-.5-3-1.5" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">আদায়</p>
                <p className="truncate text-xs text-ink-muted">আদায় বা নতুন লেনদেনের খবর</p>
              </div>
              <span className="shrink-0 rounded-pill bg-surface-soft px-2 py-0.5 text-xs font-medium text-ink-faint">
                শীঘ্রই
              </span>
              <Switch
                checked={notifyCollection}
                onChange={setNotifyCollection}
                label="আদায় নোটিফিকেশন চালু বা বন্ধ (শীঘ্রই আসছে)"
                disabled
              />
            </div>
          </div>
        </section>

        {/* লগআউট */}
        <section className="mt-4">
          <div className="rounded-card border border-border bg-surface-raised">
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-danger-tint"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-danger">লগআউট</span>
                <span className="block truncate text-xs text-ink-muted">এই অ্যাকাউন্ট থেকে বের হন</span>
              </span>
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
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </section>
      </div>

      <Sheet
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        ariaLabel="লগআউট নিশ্চিত করুন"
      >
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">নিশ্চিতভাবে লগআউট করবেন?</h2>
            <p className="text-sm text-ink-muted">
              তথ্য সংরক্ষিত থাকবে — আবার লগইন করলেই সব ফিরে পাবেন।
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => setLogoutOpen(false)}
            className="inline-flex flex-1 items-center justify-center rounded-button border border-secondary bg-transparent px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={confirmLogout}
            disabled={signingOut}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-button bg-danger px-5 py-3 text-base font-semibold text-surface-raised transition-opacity hover:opacity-90 active:opacity-100 disabled:opacity-60"
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            লগআউট
          </button>
        </div>
      </Sheet>
    </>
  );
}
