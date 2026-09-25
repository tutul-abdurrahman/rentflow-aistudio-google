import PageHeader from '../components/PageHeader';

export default function CashflowSummary() {
  return (
    <>
      <PageHeader
        title="ক্যাশফ্লো"
        subtitle="আবাসিক ভবন — মিরপুর-১০"
        backTo="/finance"
      />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </>
  );
}
