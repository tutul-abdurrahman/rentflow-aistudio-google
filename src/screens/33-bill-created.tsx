import PageHeader from '../components/PageHeader';

export default function BillCreated() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col justify-center px-5 py-10">
      <PageHeader
        title="কাগজ প্রস্তুত"
        subtitle="আগস্ট ২০২৬ · ৫টি কাগজ · রুম ১০৬ খালি"
      />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </div>
  );
}
