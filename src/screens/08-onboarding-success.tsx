import PageHeader from '../components/PageHeader';

export default function OnboardingSuccess() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col justify-center px-5 py-10">
      <PageHeader
        title="সব ঠিক আছে, রফিক ভাই!"
        subtitle="বাড়ি সেটআপ শেষ। এবার থেকে বিল আর আদায় সব এক জায়গায়।"
      />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </div>
  );
}
