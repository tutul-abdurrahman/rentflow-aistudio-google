import PageHeader from '../components/PageHeader';

export default function AddLoan() {
  return (
    <>
      <PageHeader title="নতুন লোন" backTo="/loans" />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </>
  );
}
