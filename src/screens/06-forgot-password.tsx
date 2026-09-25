import PageHeader from '../components/PageHeader';

export default function ForgotPassword() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col justify-center px-5 py-10">
      <PageHeader
        title="পাসওয়ার্ড ভুলে গেছেন?"
        subtitle="চিন্তার কিছু নেই। মোবাইল নম্বর দিয়ে নতুন পাসওয়ার্ড সেট করুন।"
      />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </div>
  );
}
