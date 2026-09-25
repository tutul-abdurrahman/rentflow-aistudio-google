import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRepository } from '../app/repository';
import Button from '../components/Button';
import { CardIcon, ChevronDownIcon, InfoIcon, MinusIcon, PlusIcon, UserIcon } from '../components/Icons';
import PageHeader from '../components/PageHeader';
import { cn } from '../lib/cn';
import { bnDigits, bnMonth } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import type { MonthKey, Property, Room, Tenant } from '../lib/types';

interface AddLoanData {
  tenants: Tenant[];
  rooms: Room[];
  property: Property;
  activeMonth: MonthKey;
}

const MAX_INSTALLMENTS = 60;

export default function AddLoan() {
  const repository = useRepository();
  const navigate = useNavigate();

  const { data, loading } = useAsync<AddLoanData>(async () => {
    const [tenants, rooms, property, activeMonth] = await Promise.all([
      repository.listTenants('active'),
      repository.listRooms(),
      repository.getProperty(),
      repository.getActiveMonth(),
    ]);
    return { tenants, rooms, property, activeMonth };
  }, [repository]);

  const [tenantId, setTenantId] = useState('');
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState(5);
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [amountEdited, setAmountEdited] = useState(false);
  const [addToBill, setAddToBill] = useState(true);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ tenant?: string; amount?: string; installment?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (amountEdited) return;
    const total = Number(amount || 0);
    const per = count > 0 && total > 0 ? Math.round(total / count) : 0;
    setInstallmentAmount(per > 0 ? String(per) : '');
  }, [amount, count, amountEdited]);

  const tenants = data?.tenants ?? [];
  const roomById = new Map((data?.rooms ?? []).map((room) => [room.id, room]));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const total = Number(amount || 0);
    const per = Number(installmentAmount || 0);
    const nextErrors: typeof errors = {};
    if (!tenantId) nextErrors.tenant = 'রেন্টি বেছে নিন';
    if (!(total > 0)) nextErrors.amount = 'পরিমাণ দিন';
    if (!(per > 0)) nextErrors.installment = 'কিস্তির পরিমাণ দিন';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const loan = await repository.addLoan({
        tenantId,
        totalAmount: total,
        installmentCount: count,
        installmentAmount: per,
        addToBill,
        note: note.trim() ? note.trim() : undefined,
      });
      navigate(`/loans/${loan.id}`);
    } catch {
      setFormError('লোন যোগ করা যায়নি। আবার চেষ্টা করুন।');
      setSaving(false);
    }
  };

  const suggested = count > 0 && Number(amount || 0) > 0 ? Math.round(Number(amount) / count) : 0;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="নতুন লোন"
        subtitle={data?.property.name}
        backTo="/loans"
        action={
          data ? (
            <span className="ml-auto shrink-0 rounded-pill border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink-faint">
              {bnMonth(data.activeMonth)}
            </span>
          ) : undefined
        }
      />

      <form className="mt-4" noValidate onSubmit={handleSubmit}>
        <section className="rounded-card border border-border bg-surface-raised" aria-label="রেন্টি">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <UserIcon className="shrink-0 text-primary" />
            <h2 className="text-base font-semibold text-ink">রেন্টি</h2>
          </div>
          <div className="p-5">
            <label htmlFor="loan-tenant" className="mb-1.5 block text-sm font-medium text-ink">
              কার জন্য <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <select
                id="loan-tenant"
                value={tenantId}
                disabled={loading && !data}
                onChange={(event) => setTenantId(event.target.value)}
                className="w-full appearance-none rounded-input border border-border bg-surface-raised px-4 py-3 pr-10 text-md text-ink transition-colors focus:border-border-focus disabled:cursor-not-allowed disabled:bg-surface-sunken"
              >
                <option value="">রেন্টি বেছে নিন</option>
                {tenants.map((tenant) => {
                  const room = tenant.roomId ? roomById.get(tenant.roomId) : undefined;
                  return (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                      {room ? ` · রুম ${bnDigits(room.number)}` : ''}
                    </option>
                  );
                })}
              </select>
              <ChevronDownIcon size={18} className="pointer-events-none absolute inset-y-0 right-4 my-auto text-ink-faint" />
            </div>
            {errors.tenant ? (
              <p className="mt-1.5 text-xs text-danger">{errors.tenant}</p>
            ) : (
              <p className="mt-1.5 text-xs text-ink-faint">সক্রিয় রেন্টির মধ্যে থেকে বেছে নিন</p>
            )}
          </div>
        </section>

        <section className="mt-3 rounded-card border border-border bg-surface-raised" aria-label="লোনের বিবরণ">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <CardIcon className="shrink-0 text-primary" />
            <h2 className="text-base font-semibold text-ink">লোনের বিবরণ</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <div>
              <label htmlFor="loan-amount" className="mb-1.5 block text-sm font-medium text-ink">
                পরিমাণ <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-md font-medium text-ink-faint">৳</span>
                <input
                  id="loan-amount"
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="0"
                  className="w-full rounded-input border border-border bg-surface-raised py-3 pl-10 pr-4 text-md text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
                />
              </div>
              {errors.amount ? <p className="mt-1.5 text-xs text-danger">{errors.amount}</p> : null}
            </div>

            <div>
              <label htmlFor="installment-minus" className="mb-1.5 block text-sm font-medium text-ink">
                কিস্তির সংখ্যা <span className="text-danger">*</span>
              </label>
              <div className="flex items-center justify-between rounded-input border border-border bg-surface-raised px-2 py-1.5">
                <button
                  id="installment-minus"
                  type="button"
                  onClick={() => setCount((value) => Math.max(1, value - 1))}
                  aria-label="কিস্তি কমান"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button border border-border bg-surface-raised text-ink-muted transition-colors hover:bg-surface-soft"
                >
                  <MinusIcon size={18} />
                </button>
                <span className="text-lg font-bold text-ink">{bnDigits(count)}</span>
                <button
                  type="button"
                  onClick={() => setCount((value) => Math.min(MAX_INSTALLMENTS, value + 1))}
                  aria-label="কিস্তি বাড়ান"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button border border-border bg-surface-raised text-ink-muted transition-colors hover:bg-surface-soft"
                >
                  <PlusIcon size={18} />
                </button>
              </div>
              <p className="mt-1.5 text-xs text-ink-faint">মাসিক কিস্তিতে ভাগ হবে</p>
            </div>

            <div>
              <label htmlFor="per-installment" className="mb-1.5 block text-sm font-medium text-ink">
                প্রতি কিস্তি <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-md font-medium text-ink-faint">৳</span>
                <input
                  id="per-installment"
                  type="text"
                  inputMode="numeric"
                  value={installmentAmount}
                  onChange={(event) => {
                    setAmountEdited(true);
                    setInstallmentAmount(event.target.value.replace(/\D/g, '').slice(0, 9));
                  }}
                  placeholder="0"
                  className="w-full rounded-input border border-border bg-surface-raised py-3 pl-10 pr-4 text-md font-semibold text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
                />
              </div>
              {errors.installment ? (
                <p className="mt-1.5 text-xs text-danger">{errors.installment}</p>
              ) : (
                <p className="mt-1.5 text-xs text-ink-faint">
                  {amountEdited && suggested > 0 ? `পরিমাণ ÷ কিস্তি = ৳${bnDigits(suggested)}` : 'পরিমাণ ÷ কিস্তি — নিজে থেকেই হিসাব হবে'}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="loan-note" className="mb-1.5 block text-sm font-medium text-ink">
                নোট (ইচ্ছা হলে)
              </label>
              <textarea
                id="loan-note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="লোনের কারণ বা অন্য কোনো নোট লিখুন…"
                className="w-full resize-none rounded-input border border-border bg-surface-raised px-4 py-3 text-md text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
              />
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-card border border-border bg-surface-raised" aria-label="কিস্তি কীভাবে আদায় হবে">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <CardIcon className="shrink-0 text-primary" />
            <h2 className="text-base font-semibold text-ink">কিস্তি কীভাবে আদায় হবে</h2>
          </div>
          <div className="flex items-start gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info-tint text-info">
              <CardIcon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug text-ink">মাসিক বিলে যোগ</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                চালু থাকলে কিস্তি প্রতি মাসের ভাড়া বিলে যোগ হবে। বন্ধ করলে আলাদা হিসাব।
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={addToBill}
              aria-label="কিস্তি বিলে যোগ করা চালু বা বন্ধ"
              onClick={() => setAddToBill((value) => !value)}
              className={cn(
                'relative h-[26px] w-11 shrink-0 rounded-pill transition-colors',
                addToBill ? 'bg-primary' : 'bg-border',
              )}
            >
              <span
                className={cn(
                  'absolute left-0.5 top-0.5 h-[22px] w-[22px] rounded-full bg-surface-raised shadow-pop transition-transform',
                  addToBill && 'translate-x-[18px]',
                )}
              />
            </button>
          </div>
        </section>

        <div className="mt-3 flex items-start gap-3 rounded-card bg-surface-sunken p-4">
          <InfoIcon className="mt-0.5 shrink-0 text-info" />
          <p className="text-sm text-ink-muted">
            {addToBill
              ? 'কিস্তি প্রতি মাসের বিলে যোগ হবে — আলাদা করে ধরতে হবে না।'
              : 'লোন আলাদা লেজারে থাকবে, মাসিক বিলে যোগ হবে না।'}
          </p>
        </div>

        {formError ? (
          <p role="alert" className="mt-3 rounded-card border border-danger bg-danger-tint px-4 py-3 text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <Link
            to="/loans"
            className="inline-flex w-full items-center justify-center rounded-button border border-secondary bg-transparent px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active sm:flex-1"
          >
            বাতিল
          </Link>
          <Button type="submit" className="w-full sm:flex-1" disabled={saving} leadingIcon={<CardIcon size={18} />}>
            {saving ? 'সেভ হচ্ছে…' : 'লোন দিন'}
          </Button>
        </div>
      </form>
    </div>
  );
}
