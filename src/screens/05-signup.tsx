import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Input from '../components/Input';
import { supabase } from '../lib/supabase';

/**
 * 05 — নতুন অ্যাকাউন্ট (bare shell). Visual card from 05-signup.html.
 * Flow is email-based (Tutul confirmed email-only): signUp(email, password)
 * sends the confirmation OTP, then verifyOtp type 'signup'. Password boxes
 * replaced the design's single "মোবাইল নম্বর" step; OTP client-side
 * auto-advance/backspace behaviour is kept.
 */

const OTP_LENGTH = 6;
const OTP_LABELS = [
  'ওটিপি প্রথম সংখ্যা',
  'ওটিপি দ্বিতীয় সংখ্যা',
  'ওটিপি তৃতীয় সংখ্যা',
  'ওটিপি চতুর্থ সংখ্যা',
  'ওটিপি পঞ্চম সংখ্যা',
  'ওটিপি ষষ্ঠ সংখ্যা',
];

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

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    if (password.length < 6) {
      setFormError('অন্তত ৬টি অক্ষরের পাসওয়ার্ড দিন।');
      return;
    }
    if (password !== confirm) {
      setFormError('দুটো পাসওয়ার্ড এক নয়, আবার লিখুন।');
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (error) {
      setFormError(authErrorMessage(error.message));
      return;
    }
    if (data.session) {
      // Email confirmation is disabled for this project — already signed in.
      setStep(3);
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
    // Paste of the full code fills every box; typing advances one step.
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
      type: 'signup',
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
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    });
    if (error) {
      setOtpError(authErrorMessage(error.message));
      return;
    }
    setOtp(Array(OTP_LENGTH).fill(''));
    setResendNote(true);
    focusOtp(0);
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-12">
      <div className="mx-auto w-full max-w-md">
        <BrandLockup />

        <div className="mt-8 rounded-card border border-border bg-surface-raised p-5">
          {step !== 3 ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-faint">
                  ধাপ <span>{step === 1 ? '১' : '২'}</span>/২
                </span>
                <span className="text-xs font-semibold text-ink">
                  {step === 1 ? 'ইমেইল' : 'যাচাই'}
                </span>
              </div>
              <div className="mt-2 flex gap-1.5">
                <span
                  className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-border'}`}
                />
                <span
                  className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-border'}`}
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <section className="mt-6">
              <h1 className="text-lg font-semibold text-ink">নতুন অ্যাকাউন্ট</h1>
              <p className="mt-1 text-sm text-ink-muted">
                ইমেইল আর পাসওয়ার্ড দিন। ইমেইলে পাঠানো ওটিপি দিয়ে যাচাই হবে।
              </p>

              <form className="mt-5" onSubmit={handleSendOtp} noValidate>
                <Input
                  label="ইমেইল"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />

                <label
                  htmlFor="signup-pass"
                  className="mt-4 block text-sm font-medium text-ink"
                >
                  পাসওয়ার্ড
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="signup-pass"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="********"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
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
                  htmlFor="signup-pass-2"
                  className="mt-4 block text-sm font-medium text-ink"
                >
                  পাসওয়ার্ড আবার দিন
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="signup-pass-2"
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
                  অ্যাকাউন্ট তৈরি হয়েছে
                </h1>
                <p className="mt-1.5 text-sm text-ink-muted">
                  স্বাগতম! এক মিনিটেই আপনার বাড়ি সেটআপ করে নিন।
                </p>
                <Button
                  fullWidth
                  className="mt-6"
                  onClick={() => navigate('/onboarding')}
                >
                  অনবোর্ডিং শুরু করুন <ArrowRightIcon />
                </Button>
                <p className="mt-4 text-sm text-ink-muted">
                  আগেই অ্যাকাউন্ট আছে?{' '}
                  <Link
                    to="/login"
                    className="font-semibold text-primary transition-colors hover:text-primary-hover"
                  >
                    লগ ইন
                  </Link>
                </p>
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
