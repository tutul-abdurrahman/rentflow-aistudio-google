import PageHeader from '../components/PageHeader';

export default function MeterEntry() {
  return (
    <>
      <PageHeader
        title="মিটার রিডিং"
        subtitle="আবাসিক ভবন — মিরপুর-১০ · খসড়া ১০:২৪"
        backTo="/"
      />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </>
  );
}
