import PageHeader from '../components/PageHeader';

export default function Signup() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col justify-center px-5 py-10">
      <PageHeader
        title="নতুন অ্যাকাউন্ট"
        subtitle="মোবাইল নম্বর দিয়ে শুরু করুন। ওটিপি দিয়ে যাচাই হবে।"
      />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </div>
  );
}
