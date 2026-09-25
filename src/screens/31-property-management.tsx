import PageHeader from '../components/PageHeader';

export default function PropertyManagement() {
  return (
    <>
      <PageHeader
        title="বাড়ির তথ্য"
        subtitle="আবাসিক ভবন — মিরপুর-১০"
        backTo="/more"
      />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </>
  );
}
