import PageHeader from '../components/PageHeader';

export default function SingleReceipt() {
  return (
    <div className="mx-auto w-full max-w-[48rem] px-3 pt-5 sm:px-5 lg:px-8">
      <PageHeader
        title="হারানো কাগজ — ১০২ · আগস্ট ২০২৬"
        subtitle="মাসিক কাগজ আবার ছাপুন · Margin: None"
      />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </div>
  );
}
