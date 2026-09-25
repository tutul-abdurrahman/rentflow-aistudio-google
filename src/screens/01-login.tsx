import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Input from '../components/Input';
import { supabase } from '../lib/supabase';

/**
 * 01 — লগ ইন (bare shell). Email + password (Tutul confirmed email-only),
 * visual card from design-output/screens/01-login.html. The annotated error
 * card is a real state on this route, not a separate screen.
 */

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
      <p className="mt-1 text-sm text-ink-faint">ভাড়া ও বিল ব্যবস্থাপনা</p>
    </div>
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

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (!email.trim() || !password) {
      setError('ইমেইল আর পাসওয়ার্ড দুটোই দিন।');
      return;
    }

    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (authError) {
      setError('ইমেইল বা পাসওয়ার্ড মিলছে না।');
      return;
    }

    navigate('/', { replace: true });
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-12">
      <div className="mx-auto w-full max-w-md">
        <BrandLockup />

        <div className="mt-8 rounded-card border border-border bg-surface-raised p-5">
          <h1 className="text-lg font-semibold text-ink">লগ ইন করুন</h1>
          <p className="mt-1 text-sm text-ink-muted">
            ইমেইল আর পাসওয়ার্ড দিয়ে লগ ইন করুন
          </p>

          <form className="mt-6" onSubmit={handleSubmit} noValidate>
            <Input
              label="ইমেইল"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <div className="mt-5 flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="text-sm font-medium text-ink"
              >
                পাসওয়ার্ড
              </label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-primary transition-colors hover:text-primary-hover"
              >
                পাসওয়ার্ড ভুলে গেছেন?
              </Link>
            </div>
            <div className="relative mt-1.5">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
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

            <Button type="submit" fullWidth disabled={submitting} className="mt-6">
              {submitting ? 'লগ ইন হচ্ছে…' : 'লগ ইন'}
            </Button>
          </form>

          <div className="mt-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-ink-faint">অথবা</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Link
            to="/signup"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-button border border-secondary bg-transparent px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
          >
            নতুন অ্যাকাউন্ট খুলুন
          </Link>
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-ink-faint">
          ভাষা — বাংলা
        </p>

        {error ? (
          <section
            className="mt-10 border-t border-border-strong pt-8"
            aria-label="লগইন ব্যর্থ"
          >
            <div className="flex items-start gap-2.5 rounded-card border border-border bg-surface-raised px-4 py-3.5">
              <svg
                className="mt-0.5 shrink-0 text-danger"
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
                <path d="M12 3 1 21h22L12 3z" />
                <path d="M12 10v5" />
                <path d="M12 18h.01" />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  লগ ইন করা যায়নি
                </p>
                <p className="mt-0.5 text-sm font-medium text-danger">{error}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-faint">
                  আবার চেষ্টা করুন — ভুলে গেলে{' '}
                  <Link
                    to="/forgot-password"
                    className="font-medium text-primary transition-colors hover:text-primary-hover"
                  >
                    পাসওয়ার্ড বদলান
                  </Link>
                  ।
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
