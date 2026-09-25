import PageHeader from '../components/PageHeader';

export default function Profile() {
  return (
    <>
      <PageHeader title="প্রোফাইল" backTo="/more" />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </>
  );
}
