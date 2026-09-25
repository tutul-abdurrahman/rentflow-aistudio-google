import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Input from '../components/Input';
import { supabase } from '../lib/supabase';

/**
 * 06 — পাসওয়ার্ড ভুলে গেছেন (bare shell). Visual card from
 * 06-forgot-password.html. Email-based recovery (Tutul confirmed email-only):
 * resetPasswordForEmail sends the OTP, verifyOtp type 'recovery' proves
 * ownership, then updateUser sets the new password.
 */

const OTP_LENGTH = 6;
const OTP_LABELS = [
  'ওটিপি প্রথম অঙ্ক',
  'ওটিপি দ্বিতীয় অঙ্ক',
  'ওটিপি তৃতীয় অঙ্ক',
  'ওটিপি চতুর্থ অঙ্ক',
  'ওটিপি পঞ্চম অঙ্ক',
  'ওটিপি ষষ্ঠ অঙ্ক',
];
const STEP_LABELS = ['ইমেইল', 'ওটিপি', 'নতুন পাসওয়ার্ড'];

function authErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।';
  }
  if (lower.includes('password')) {
    return 'পাসওয়ার্ড দুর্বল। অন্তত ৬ অক্ষরের পাসওয়ার্ড দিন।';
  }
  if (lower.includes('email')) {
    return 'ইমেইল ঠিকানা সঠিক নয়।';
  }
  return 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।';
}

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
      <p className="mt-3 text-xl font-bold tracking-tight text-ink">RentFlow</p>
      <p className="mt-0.5 text-sm text-ink-faint">ভাড়া ও বিল ব্যবস্থাপনা</p>
    </div>
  );
}

function SendIcon() {
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
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function RefreshIcon() {
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
      <path d="M20 12a8 8 0 1 1-8-8" />
      <path d="M22 4v6h-6" />
    </svg>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  if (off) {
    return (
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
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <path d="m1 1 22 22" />
      </svg>
    );
  }
  return (
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
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const OTP_BOX_CLASS =
  'h-[3.25rem] w-full rounded-md border bg-surface-raised text-center text-lg font-semibold text-ink caret-primary transition-colors focus:border-border-focus';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [otp, setOtp] = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendNote, setResendNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  function focusOtp(index: number) {
    requestAnimationFrame(() => otpRefs.current[index]?.focus());
  }

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    if (!email.trim()) {
      setFormError('ইমেইল দিন।');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setSubmitting(false);
    if (error) {
      setFormError(authErrorMessage(error.message));
      return;
    }
    setStep(2);
    focusOtp(0);
  }

  function handleOtpChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/[^\d]/g, '');
    setOtpError(null);
    setResendNote(false);
    if (!digits) {
      setOtp((prev) => prev.map((value, i) => (i === index ? '' : value)));
      return;
    }
    if (digits.length > 1) {
      const next = [...otp];
      for (let i = 0; i < OTP_LENGTH; i += 1) {
        next[i] = digits[i] ?? next[i];
      }
      setOtp(next);
      focusOtp(Math.min(digits.length, OTP_LENGTH - 1));
      return;
    }
    setOtp((prev) => prev.map((value, i) => (i === index ? digits : value)));
    if (index < OTP_LENGTH - 1) focusOtp(index + 1);
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      focusOtp(index - 1);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const token = otp.join('');
    if (token.length !== OTP_LENGTH) {
      setOtpError('৬ সংখ্যার ওটিপি দিন।');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'recovery',
    });
    setSubmitting(false);
    if (error) {
      setOtpError('ওটিপি মিলছে না। আবার চেষ্টা করুন।');
      return;
    }
    setStep(3);
  }

  async function handleResend() {
    setOtpError(null);
    setResendNote(false);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) {
      setOtpError(authErrorMessage(error.message));
      return;
    }
    setOtp(Array(OTP_LENGTH).fill(''));
    setResendNote(true);
    focusOtp(0);
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);

    if (newPassword.length < 6) {
      setFormError('অন্তত ৬টি অক্ষরের পাসওয়ার্ড দিন।');
      return;
    }
    if (newPassword !== confirm) {
      setFormError('দুটো পাসওয়ার্ড এক নয়, আবার লিখুন।');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setSubmitting(false);
      setFormError(authErrorMessage(error.message));
      return;
    }
    // Recovery session done — sign out so the owner logs in with the new password.
    await supabase.auth.signOut();
    setSubmitting(false);
    setStep(4);
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-12">
      <div className="mx-auto w-full max-w-md">
        <BrandLockup />

        <div className="mt-8 rounded-card border border-border bg-surface-raised p-5">
          {step !== 4 ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-faint">
                  ধাপ <span>{['১', '২', '৩'][step - 1]}</span>/৩
                </span>
                <span className="text-xs font-semibold text-ink">
                  {STEP_LABELS[step - 1]}
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
          ) : null}

          {step === 1 ? (
            <section className="mt-6">
              <h1 className="text-lg font-semibold text-ink">
                পাসওয়ার্ড ভুলে গেছেন?
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                চিন্তার কিছু নেই। ইমেইল দিয়ে নতুন পাসওয়ার্ড সেট করুন।
              </p>

              <form className="mt-5" onSubmit={handleSendOtp} noValidate>
                <Input
                  label="ইমেইল"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  helper="এই ইমেইলে ওটিপি পাঠানো হবে।"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                {formError ? (
                  <p className="mt-2 text-xs text-danger">{formError}</p>
                ) : null}

                <Button
                  type="submit"
                  fullWidth
                  disabled={submitting}
                  leadingIcon={<SendIcon />}
                  className="mt-5"
                >
                  {submitting ? 'ওটিপি পাঠানো হচ্ছে…' : 'ওটিপি পাঠান'}
                </Button>
              </form>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="mt-6">
              <h1 className="text-lg font-semibold text-ink">ওটিপি দিন</h1>
              <p className="mt-1 text-sm text-ink-muted">
                <span className="font-semibold text-ink">{email.trim()}</span>{' '}
                ঠিকানায় পাঠানো ৬ সংখ্যার ওটিপি লিখুন।
              </p>

              <form className="mt-5" onSubmit={handleVerify} noValidate>
                <div className="grid grid-cols-6 gap-2">
                  {otp.map((value, index) => (
                    <input
                      key={OTP_LABELS[index]}
                      ref={(element) => {
                        otpRefs.current[index] = element;
                      }}
                      value={value}
                      onChange={(event) => handleOtpChange(index, event)}
                      onKeyDown={(event) => handleOtpKeyDown(index, event)}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={OTP_LENGTH}
                      aria-label={OTP_LABELS[index]}
                      aria-invalid={otpError ? true : undefined}
                      className={`${OTP_BOX_CLASS} ${otpError ? 'border-danger' : 'border-border'}`}
                    />
                  ))}
                </div>
                {otpError ? (
                  <p className="mt-2 text-xs text-danger">{otpError}</p>
                ) : null}

                <Button
                  type="submit"
                  fullWidth
                  disabled={submitting}
                  className="mt-4"
                >
                  {submitting ? 'যাচাই হচ্ছে…' : 'ওটিপি যাচাই করুন'}
                </Button>

                <p className="mt-4 text-center text-sm text-ink-muted">
                  ওটিপি পাননি?{' '}
                  <button
                    type="button"
                    onClick={handleResend}
                    className="font-semibold text-primary transition-colors hover:text-primary-hover"
                  >
                    আবার পাঠান
                  </button>
                </p>
                {resendNote ? (
                  <p className="mt-2 text-center text-xs text-success">
                    নতুন ওটিপি পাঠানো হয়েছে।
                  </p>
                ) : null}
              </form>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="mt-6">
              <h1 className="text-lg font-semibold text-ink">নতুন পাসওয়ার্ড</h1>
              <p className="mt-1 text-sm text-ink-muted">
                অ্যাকাউন্টে ঢোকার জন্য নতুন পাসওয়ার্ড দিন।
              </p>

              <form className="mt-5" onSubmit={handleReset} noValidate>
                <label
                  htmlFor="new-pass"
                  className="block text-sm font-medium text-ink"
                >
                  নতুন পাসওয়ার্ড
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="new-pass"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="********"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-input border border-border bg-surface-raised py-3 pl-4 pr-12 text-md text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label="পাসওয়ার্ড দেখান/লুকান"
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-3 flex items-center text-ink-faint transition-colors hover:text-ink-muted"
                  >
                    <EyeIcon off={showPassword} />
                  </button>
                </div>

                <label
                  htmlFor="new-pass-2"
                  className="mt-4 block text-sm font-medium text-ink"
                >
                  পাসওয়ার্ড আবার দিন
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="new-pass-2"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="********"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    className="w-full rounded-input border border-border bg-surface-raised py-3 pl-4 pr-12 text-md text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((value) => !value)}
                    aria-label="পাসওয়ার্ড দেখান/লুকান"
                    aria-pressed={showConfirm}
                    className="absolute inset-y-0 right-3 flex items-center text-ink-faint transition-colors hover:text-ink-muted"
                  >
                    <EyeIcon off={showConfirm} />
                  </button>
                </div>

                <p className="mt-2 text-xs text-ink-faint">
                  অন্তত ৬টি অক্ষর। সহজে মনে রাখা যায় এমন পাসওয়ার্ড দিন।
                </p>
                {formError ? (
                  <p className="mt-2 text-xs text-danger">{formError}</p>
                ) : null}

                <Button
                  type="submit"
                  fullWidth
                  disabled={submitting}
                  className="mt-5"
                >
                  {submitting ? 'বদলানো হচ্ছে…' : 'পাসওয়ার্ড বদলান'}
                </Button>
              </form>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="mt-2">
              <div className="flex flex-col items-center pt-2 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint text-primary">
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <h1 className="mt-4 text-lg font-semibold text-ink">
                  পাসওয়ার্ড বদলানো হয়েছে
                </h1>
                <p className="mt-1.5 text-sm text-ink-muted">
                  নতুন পাসওয়ার্ড দিয়ে আবার লগ ইন করুন।
                </p>
                <Button
                  fullWidth
                  className="mt-6"
                  leadingIcon={<RefreshIcon />}
                  onClick={() => navigate('/login')}
                >
                  লগ ইন করুন
                </Button>
              </div>
            </section>
          ) : null}
        </div>

        <p className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
          >
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
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            লগ ইন এ ফিরে যান
          </Link>
        </p>
      </div>
    </main>
  );
}
