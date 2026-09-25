import PageHeader from '../components/PageHeader';

export default function Onboarding() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col justify-center px-5 py-10">
      <PageHeader title="ভাষা নির্বাচন" subtitle="কোন ভাষায় ব্যবহার করবেন?" />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </div>
  );
}
