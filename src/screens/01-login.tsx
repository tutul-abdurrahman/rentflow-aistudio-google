import PageHeader from '../components/PageHeader';

export default function Login() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col justify-center px-5 py-10">
      <PageHeader
        title="লগ ইন করুন"
        subtitle="মোবাইল নম্বর আর পাসওয়ার্ড দিয়ে লগ ইন করুন"
      />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </div>
  );
}
