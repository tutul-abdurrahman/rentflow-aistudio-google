import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useRepository } from '../app/repository';
import Button from '../components/Button';
import { CheckIcon, ChevronDownIcon, HomeIcon, LockIcon, UserIcon } from '../components/Icons';
import Input from '../components/Input';
import PageHeader from '../components/PageHeader';
import { asciiDigits, bnDigits, bnMonth } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import type { MonthKey, Property, Room, Tenant } from '../lib/types';

interface EditTenantData {
  tenant: Tenant;
  room: Room | null;
  property: Property;
  activeMonth: MonthKey;
}

export default function EditTenant() {
  const repository = useRepository();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data, loading, error } = useAsync<EditTenantData | null>(async () => {
    if (!id) return null;
    const tenant = await repository.getTenant(id);
    if (!tenant) return null;
    const [rooms, property, activeMonth] = await Promise.all([
      repository.listRooms(),
      repository.getProperty(),
      repository.getActiveMonth(),
    ]);
    const room = rooms.find((candidate) => candidate.id === tenant.roomId) ?? null;
    return { tenant, room, property, activeMonth };
  }, [repository, id]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data && !hydrated) {
      setName(data.tenant.name);
      setPhone(data.tenant.phone);
      setHydrated(true);
    }
  }, [data, hydrated]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) return;
    setFormError(null);

    const nextErrors: typeof errors = {};
    const digits = asciiDigits(phone).replace(/\D/g, '');
    if (!name.trim()) nextErrors.name = 'নাম লিখুন';
    if (digits.length !== 11) nextErrors.phone = 'সঠিক ১১ সংখ্যার নম্বর দিন';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await repository.updateTenant(id, { name: name.trim(), phone: digits });
      navigate(`/tenants/${id}`);
    } catch {
      setFormError('পরিবর্তন সেভ করা যায়নি। আবার চেষ্টা করুন।');
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="mt-6 h-40 animate-pulse rounded-card bg-surface-soft" aria-hidden="true" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="রেন্টি এডিট" backTo="/tenants" />
        <p className="mt-4 rounded-card border border-border bg-surface-raised px-4 py-6 text-center text-sm text-ink-muted">
          রেন্টি খুঁজে পাওয়া যায়নি।
        </p>
      </div>
    );
  }

  const { tenant, room, property, activeMonth } = data;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="রেন্টি এডিট"
        subtitle={`${tenant.name} · রুম ${bnDigits(room?.number ?? '—')}`}
        backTo={`/tenants/${tenant.id}`}
        action={
          <span className="ml-auto shrink-0 rounded-pill border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink-faint">
            {bnMonth(activeMonth)}
          </span>
        }
      />

      <form className="mt-4" noValidate onSubmit={handleSubmit}>
        <section className="rounded-card border border-border bg-surface-raised" aria-label="ব্যক্তিগত তথ্য">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <UserIcon className="shrink-0 text-primary" />
            <h2 className="text-base font-semibold text-ink">ব্যক্তিগত তথ্য</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <Input
              label="নাম *"
              placeholder="পূর্ণ নাম লিখুন"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={errors.name}
            />
            <Input
              label="মোবাইল *"
              type="tel"
              inputMode="numeric"
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={(event) => setPhone(asciiDigits(event.target.value).replace(/\D/g, '').slice(0, 11))}
              error={errors.phone}
            />
          </div>
        </section>

        <section className="mt-3 rounded-card border border-border bg-surface-raised" aria-label="রুম">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <HomeIcon className="shrink-0 text-primary" />
            <h2 className="text-base font-semibold text-ink">রুম</h2>
          </div>
          <div className="p-5">
            <label htmlFor="te-room" className="mb-1.5 block text-sm font-medium text-ink">
              রুম
            </label>
            <div className="relative">
              <select
                id="te-room"
                value={room?.id ?? ''}
                disabled
                className="w-full cursor-not-allowed appearance-none rounded-input border border-border bg-surface-sunken px-4 py-3 pr-10 text-md text-ink-muted"
              >
                <option value={room?.id ?? ''}>রুম {bnDigits(room?.number ?? '—')} — {tenant.name}</option>
              </select>
              <ChevronDownIcon size={18} className="pointer-events-none absolute inset-y-0 right-4 my-auto text-ink-faint" />
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-faint">
              <LockIcon size={14} />
              রুম বদলাতে প্রোফাইল থেকে “রুম বদল” ব্যবহার করুন
            </p>
          </div>
        </section>

        {formError ? (
          <p role="alert" className="mt-3 rounded-card border border-danger bg-danger-tint px-4 py-3 text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <Link
            to={`/tenants/${tenant.id}`}
            className="inline-flex w-full items-center justify-center rounded-button border border-secondary bg-transparent px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active sm:flex-1"
          >
            বাতিল
          </Link>
          <Button type="submit" className="w-full sm:flex-1" disabled={saving} leadingIcon={<CheckIcon size={18} />}>
            {saving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}
          </Button>
        </div>
      </form>
      <p className="mt-4 text-center text-xs text-ink-faint">{property.name}</p>
    </div>
  );
}
