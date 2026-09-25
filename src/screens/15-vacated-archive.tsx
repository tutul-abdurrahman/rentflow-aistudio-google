import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepository } from '../app/repository';
import Button from '../components/Button';
import { SearchIcon, TrashIcon, WalletIcon } from '../components/Icons';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import { cn } from '../lib/cn';
import { asciiDigits, bnDate, bnDigits } from '../lib/format';
import { RESOLUTION_LABELS, formatPhone, initials } from '../lib/view';
import { useAsync } from '../lib/useAsync';
import type { Tenant } from '../lib/types';

function matches(query: string, tenant: Tenant): boolean {
  if (!query) return true;
  const bangla = query.toLowerCase();
  return (
    tenant.name.toLowerCase().includes(bangla) ||
    tenant.phone.includes(asciiDigits(query)) ||
    bnDigits(tenant.phone).includes(bangla)
  );
}

const CHIP_BASE = 'inline-flex items-center gap-1 rounded-pill border px-3.5 py-1.5 text-sm transition-colors';
const CHIP_IDLE = 'border-border bg-surface-raised font-medium text-ink-muted hover:bg-surface-soft';
const CHIP_ACTIVE = 'border-primary bg-primary-tint font-semibold text-ink';

export default function VacatedArchive() {
  const repository = useRepository();
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('all');
  const [pendingDelete, setPendingDelete] = useState<Tenant | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync<Tenant[]>(
    () => repository.listTenants('archived'),
    [repository],
  );

  const archived = data ?? [];

  const years = useMemo(() => {
    const map = new Map<string, number>();
    for (const tenant of archived) {
      if (!tenant.moveOutDate) continue;
      const key = tenant.moveOutDate.slice(0, 4);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [archived]);

  const trimmed = query.trim();
  const visible = archived.filter((tenant) => matches(trimmed, tenant));
  const filtered = year === 'all' ? visible : visible.filter((tenant) => tenant.moveOutDate?.slice(0, 4) === year);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setFormError(null);
    try {
      await repository.deleteArchivedTenant(pendingDelete.id);
      setPendingDelete(null);
      reload();
    } catch (caught) {
      setFormError(
        caught instanceof Error && caught.message === 'TENANT_HAS_HISTORY'
          ? 'এই রেন্টির বিল বা লেজার আছে — হিস্ট্রি রেখে দিন।'
          : 'রেকর্ড মোছা যায়নি। আবার চেষ্টা করুন।',
      );
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="প্রাক্তন রেন্টি" subtitle="২ বছরের হিস্টরি সংরক্ষিত" backTo="/tenants" />

      <div className="mt-4">
        <div className="relative">
          <SearchIcon size={18} className="pointer-events-none absolute inset-y-0 left-4 my-auto text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="নাম বা মোবাইল খুঁজুন…"
            aria-label="প্রাক্তন রেন্টি খুঁজুন"
            className="w-full rounded-input border border-border bg-surface-raised py-3 pl-11 pr-4 text-md text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="বছর ফিল্টার">
          <button
            type="button"
            aria-pressed={year === 'all'}
            onClick={() => setYear('all')}
            className={cn(CHIP_BASE, year === 'all' ? CHIP_ACTIVE : CHIP_IDLE)}
          >
            সব {bnDigits(archived.length)}
          </button>
          {years.map(([key, count]) => (
            <button
              key={key}
              type="button"
              aria-pressed={year === key}
              onClick={() => setYear(key)}
              className={cn(CHIP_BASE, year === key ? CHIP_ACTIVE : CHIP_IDLE)}
            >
              {bnDigits(key)} {bnDigits(count)}
            </button>
          ))}
        </div>
      </div>

      {formError ? (
        <p role="alert" className="mt-4 rounded-card border border-danger bg-danger-tint px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-card border border-danger bg-danger-tint px-4 py-3 text-sm text-danger">
          আর্কাইভ লোড করা যায়নি।
        </p>
      ) : loading && !data ? (
        <div className="mt-4 space-y-3" aria-hidden="true">
          <div className="skeleton h-20 rounded-card" />
          <div className="skeleton h-20 rounded-card" />
        </div>
      ) : archived.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-card border border-border bg-surface-raised px-6 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint text-primary">
            <WalletIcon size={28} />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-ink">কোনো প্রাক্তন রেন্টি নেই</h2>
          <p className="mt-1.5 max-w-60 text-sm text-ink-muted">
            মুভ আউট করলে রেন্টির ২ বছরের হিস্টরি এখানে সংরক্ষিত হবে।
          </p>
          <Link
            to="/tenants"
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-button bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
          >
            রেন্টি তালিকা দেখুন
          </Link>
        </div>
      ) : (
        <section className="mt-4 grid gap-3 lg:grid-cols-2 lg:gap-4" aria-label="প্রাক্তন রেন্টি তালিকা">
          {filtered.map((tenant) => (
            <div
              key={tenant.id}
              className="relative rounded-card border border-border bg-surface-raised transition-colors hover:bg-surface-soft"
            >
              <Link
                to={`/tenants/${tenant.id}/history`}
                className="flex items-center gap-3 rounded-card p-4 pr-14"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-soft text-sm font-bold text-ink-muted">
                  {initials(tenant.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{tenant.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {tenant.moveOutDate ? `মুভ আউট ${bnDate(tenant.moveOutDate)}` : 'মুভ আউটের তারিখ নেই'}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">{formatPhone(tenant.phone)}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-surface-soft px-2 py-0.5 text-xs font-medium text-ink-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" aria-hidden="true" />
                  {tenant.moveOutResolution ? RESOLUTION_LABELS[tenant.moveOutResolution] : 'প্রাক্তন'}
                </span>
              </Link>
              <button
                type="button"
                aria-label={`${tenant.name} এর রেকর্ড মুছুন`}
                onClick={() => setPendingDelete(tenant)}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-danger transition-colors hover:bg-danger-tint"
              >
                <TrashIcon size={18} />
              </button>
            </div>
          ))}
          {filtered.length === 0 ? <p className="text-sm text-ink-muted lg:col-span-2">কিছু পাওয়া যায়নি।</p> : null}
        </section>
      )}

      <Sheet open={pendingDelete !== null} onClose={() => setPendingDelete(null)} ariaLabel="রেকর্ড মুছুন নিশ্চিত করুন">
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
            <TrashIcon size={22} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">{pendingDelete?.name}র রেকর্ড মুছবেন?</h2>
            <p className="text-sm text-ink-muted">২ বছরের আর্কাইভ থেকে মুছে যাবে। ফেরত আনা যাবে না।</p>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setPendingDelete(null)}>
            বাতিল
          </Button>
          <button
            type="button"
            disabled={deleting}
            onClick={confirmDelete}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-button bg-danger px-5 py-3 text-base font-semibold text-surface-raised transition-opacity hover:opacity-90 active:opacity-100 disabled:opacity-60"
          >
            <TrashIcon size={18} />
            {deleting ? 'মুছা হচ্ছে…' : 'মুছে ফেলুন'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
