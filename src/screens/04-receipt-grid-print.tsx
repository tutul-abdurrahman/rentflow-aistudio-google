import PageHeader from '../components/PageHeader';

export default function ReceiptGridPrint() {
  return (
    <div className="mx-auto w-full max-w-[48rem] px-3 pt-5 sm:px-5 lg:px-8">
      <PageHeader
        title="মাসিক কাগজ — আগস্ট ২০২৬ · ৬টি / A4"
        subtitle="এখন ভাড়াটেদের হাতে দিন · Margin: None"
      />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </div>
  );
}
