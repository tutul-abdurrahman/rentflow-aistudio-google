import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useRepository } from '../app/repository';
import EmptyState from '../components/EmptyState';
import { ChevronRightIcon, PlusIcon, SearchIcon, UsersIcon } from '../components/Icons';
import PageHeader from '../components/PageHeader';
import { cn } from '../lib/cn';
import { asciiDigits, bnDigits, bnTaka } from '../lib/format';
import { initials, openAmount } from '../lib/view';
import { useAsync } from '../lib/useAsync';
import type { Bill, Room, Tenant } from '../lib/types';

type Filter = 'all' | 'active' | 'vacant';

interface TenantListData {
  tenants: Tenant[];
  rooms: Room[];
  bills: Bill[];
  archivedCount: number;
}

/** Bangla-aware search over name + room number (ASCII and Bengali digits). */
function matches(query: string, name: string, roomNumber: string): boolean {
  if (!query) return true;
  const bangla = query.toLowerCase();
  return (
    name.toLowerCase().includes(bangla) ||
    roomNumber.includes(asciiDigits(query)) ||
    bnDigits(roomNumber).includes(bangla)
  );
}

function MiniChip({ tone, children }: { tone: 'active' | 'due' | 'overdue'; children: ReactNode }) {
  const styles =
    tone === 'active'
      ? 'bg-success-tint text-success'
      : tone === 'due'
        ? 'bg-warning-tint text-ink'
        : 'bg-danger-tint text-danger';
  const dot = tone === 'active' ? 'bg-success' : tone === 'due' ? 'bg-warning' : 'bg-danger';
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-pill px-2 py-0.5 text-xs font-medium', styles)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden="true" />
      {children}
    </span>
  );
}

function TenantCard({ tenant, room, bill }: { tenant: Tenant; room?: Room; bill?: Bill }) {
  const outstanding = bill ? openAmount(bill.total, bill.paidAmount) : 0;

  return (
    <Link
      to={`/tenants/${tenant.id}`}
      className="flex items-center gap-3 rounded-card border border-border bg-surface-raised p-4 transition-colors hover:bg-surface-soft"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-sm font-bold text-ink">
        {initials(tenant.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-ink">{tenant.name}</p>
          <MiniChip tone="active">সক্রিয়</MiniChip>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-ink-muted">
            রুম {bnDigits(room?.number ?? '—')} · ভাড়া {bnTaka(room?.rent ?? 0)}
          </p>
          {outstanding > 0 ? (
            <MiniChip tone={bill?.status === 'due' ? 'overdue' : 'due'}>{bnTaka(outstanding)} বাকি</MiniChip>
          ) : null}
        </div>
      </div>
      <ChevronRightIcon size={18} className="shrink-0 text-ink-faint" />
    </Link>
  );
}

function VacantCard({ room }: { room: Room }) {
  return (
    <Link
      to="/tenants/add"
      className="flex items-center gap-3 rounded-card border border-dashed border-border-strong bg-surface-raised p-4 transition-colors hover:bg-surface-soft"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-soft text-sm font-bold text-ink-faint">
        {bnDigits(room.number)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-muted">খালি রুম {bnDigits(room.number)}</p>
        <p className="mt-0.5 text-xs text-ink-faint">রেন্টি যোগ করুন</p>
      </div>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
        <PlusIcon size={16} />
      </span>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface-raised p-4">
      <span className="h-11 w-11 shrink-0 rounded-full bg-surface-soft" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded-pill bg-surface-soft" />
        <div className="h-3 w-1/2 rounded-pill bg-surface-soft" />
      </div>
    </div>
  );
}

const CHIP_BASE =
  'inline-flex items-center gap-1 rounded-pill border px-3.5 py-1.5 text-sm transition-colors';
const CHIP_IDLE = 'border-border bg-surface-raised font-medium text-ink-muted hover:bg-surface-soft';
const CHIP_ACTIVE = 'border-primary bg-primary-tint font-semibold text-ink';

export default function TenantList() {
  const repository = useRepository();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const { data, loading, error } = useAsync<TenantListData>(async () => {
    const [tenants, rooms, archived, activeMonth] = await Promise.all([
      repository.listTenants('active'),
      repository.listRooms(),
      repository.listTenants('archived'),
      repository.getActiveMonth(),
    ]);
    const bills = await repository.listBills(activeMonth);
    return { tenants, rooms, bills, archivedCount: archived.length };
  }, [repository]);

  const rooms = data?.rooms ?? [];
  const tenants = data?.tenants ?? [];
  const vacantRooms = useMemo(() => rooms.filter((room) => room.status === 'vacant'), [rooms]);

  const roomMap = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const billByTenant = useMemo(
    () => new Map((data?.bills ?? []).map((bill) => [bill.tenantId, bill])),
    [data?.bills],
  );

  const trimmed = query.trim();
  const visibleTenants = tenants.filter((tenant) =>
    matches(trimmed, tenant.name, roomMap.get(tenant.roomId ?? '')?.number ?? ''),
  );
  const visibleVacant = vacantRooms.filter((room) => matches(trimmed, '', room.number));

  const showTenants = filter !== 'vacant';
  const showVacant = filter !== 'active';

  const subtitle = `${bnDigits(tenants.length)} জন সক্রিয় · ${bnDigits(vacantRooms.length)}টি খালি রুম`;

  return (
    <>
      <PageHeader
        title="রেন্টি"
        subtitle={loading && !data ? undefined : subtitle}
        action={
          <Link
            to="/tenants/add"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
          >
            <PlusIcon size={16} />
            নতুন
          </Link>
        }
      />

      <div className="mt-4">
        <div className="relative">
          <SearchIcon size={18} className="pointer-events-none absolute inset-y-0 left-4 my-auto text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="নাম বা রুম খুঁজুন…"
            aria-label="রেন্টি খুঁজুন"
            className="w-full rounded-input border border-border bg-surface-raised py-3 pl-11 pr-4 text-md text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
            className={cn(CHIP_BASE, filter === 'all' ? CHIP_ACTIVE : CHIP_IDLE)}
          >
            সব {bnDigits(tenants.length + vacantRooms.length)}
          </button>
          <button
            type="button"
            aria-pressed={filter === 'active'}
            onClick={() => setFilter('active')}
            className={cn(CHIP_BASE, filter === 'active' ? CHIP_ACTIVE : CHIP_IDLE)}
          >
            সক্রিয় {bnDigits(tenants.length)}
          </button>
          <button
            type="button"
            aria-pressed={filter === 'vacant'}
            onClick={() => setFilter('vacant')}
            className={cn(CHIP_BASE, filter === 'vacant' ? CHIP_ACTIVE : CHIP_IDLE)}
          >
            খালি {bnDigits(vacantRooms.length)}
          </button>
          <Link to="/tenants/archive" className={cn(CHIP_BASE, CHIP_IDLE)}>
            প্রাক্তন {bnDigits(data?.archivedCount ?? 0)}
          </Link>
        </div>

        <div className="mt-3">
          <Link
            to="/tenants/archive"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
          >
            আর্কাইভ দেখুন
            <ChevronRightIcon size={14} />
          </Link>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-card border border-danger bg-danger-tint px-4 py-3 text-sm text-danger">
          রেন্টি তালিকা লোড করা যায়নি।
        </p>
      ) : loading && !data ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2 lg:gap-4" aria-hidden="true">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : tenants.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<UsersIcon size={28} />}
          title="এখনও কোনো রেন্টি নেই"
          caption="প্রথম রেন্টি যোগ করে রুমের বিল ও কালেকশন শুরু করুন।"
          action={
            <Link
              to="/tenants/add"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-button bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
            >
              <PlusIcon size={18} />
              প্রথম রেন্টি যোগ করুন
            </Link>
          }
        />
      ) : (
        <section className="mt-4 grid gap-3 lg:grid-cols-2 lg:gap-4" aria-label="রেন্টি তালিকা">
          {showTenants
            ? visibleTenants.map((tenant) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  room={roomMap.get(tenant.roomId ?? '')}
                  bill={billByTenant.get(tenant.id)}
                />
              ))
            : null}
          {showVacant ? visibleVacant.map((room) => <VacantCard key={room.id} room={room} />) : null}
          {visibleTenants.length === 0 && visibleVacant.length === 0 ? (
            <p className="text-sm text-ink-muted lg:col-span-2">কিছু পাওয়া যায়নি।</p>
          ) : null}
        </section>
      )}
    </>
  );
}
