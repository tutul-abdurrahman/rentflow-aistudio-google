import PageHeader from '../components/PageHeader';

export default function BillPreview() {
  return (
    <>
      <PageHeader
        title="বিল — আগস্ট ২০২৬"
        subtitle="আবাসিক ভবন — মিরপুর-১০"
        backTo="/bills/meters"
      />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </>
  );
}
