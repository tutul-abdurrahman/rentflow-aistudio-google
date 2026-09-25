import PageHeader from '../components/PageHeader';

export default function TenantProfile() {
  return (
    <>
      <PageHeader title="রেন্টি প্রোফাইল" backTo="/tenants" />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </>
  );
}
