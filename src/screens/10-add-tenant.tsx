import PageHeader from '../components/PageHeader';

export default function AddTenant() {
  return (
    <>
      <PageHeader title="নতুন রেন্টি" backTo="/tenants" />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </>
  );
}
