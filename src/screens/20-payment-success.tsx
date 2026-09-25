import PageHeader from '../components/PageHeader';

export default function PaymentSuccess() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col justify-center px-5 py-10">
      <PageHeader
        title="লেজারে আদায় লেখা হয়েছে"
        subtitle="রুম ১০২ · রাহাত হোসেন · নগদে"
      />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </div>
  );
}
