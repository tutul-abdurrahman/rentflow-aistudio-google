import { Link, useParams } from 'react-router-dom';
import { useRepository } from '../app/repository';
import { FileTextIcon, ShuffleIcon } from '../components/Icons';
import PageHeader from '../components/PageHeader';
import StatusChip from '../components/StatusChip';
import { bnDate, bnDigits, bnMonth, bnTaka } from '../lib/format';
import { initials } from '../lib/view';
import { useAsync } from '../lib/useAsync';
import type { HistoryEvent, MonthKey, Property, Room, Tenant } from '../lib/types';

interface HistoryData {
  tenant: Tenant;
  room: Room | null;
  property: Property;
  activeMonth: MonthKey;
  events: HistoryEvent[];
}

const LEASE_LABELS = new Set(['রুম যোগদান', 'রুম বদল', 'মুভ-আউট']);

export default function TenantHistory() {
  const repository = useRepository();
  const { id } = useParams<{ id: string }>();

  const { data, loading, error } = useAsync<HistoryData | null>(async () => {
    if (!id) return null;
    const tenant = await repository.getTenant(id);
    if (!tenant) return null;
    const [rooms, property, activeMonth, events] = await Promise.all([
      repository.listRooms(),
      repository.getProperty(),
      repository.getActiveMonth(),
      repository.getTenantHistory(tenant.id),
    ]);
    const room = rooms.find((candidate) => candidate.id === tenant.roomId) ?? null;
    return { tenant, room, property, activeMonth, events };
  }, [repository, id]);

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
        <PageHeader title="রেন্টি লেজার" backTo="/tenants" />
        <p className="mt-4 rounded-card border border-border bg-surface-raised px-4 py-6 text-center text-sm text-ink-muted">
          রেন্টি খুঁজে পাওয়া যায়নি।
        </p>
      </div>
    );
  }

  const { tenant, room, property, activeMonth, events } = data;
  const isActive = tenant.status === 'active';
  const leaseEvents = events
    .filter((event) => LEASE_LABELS.has(event.label))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const moneyEvents = events.filter((event) => !LEASE_LABELS.has(event.label));

  const currentRoomLabel = bnDigits(room?.number ?? '—');

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="রেন্টি লেজার"
        subtitle="বিল ও পেমেন্ট — রুম অনুযায়ী"
        backTo={`/tenants/${tenant.id}`}
        action={
          <span className="ml-auto shrink-0 rounded-pill border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink-faint">
            {bnMonth(activeMonth)}
          </span>
        }
      />

      <section className="mt-4 rounded-card border border-border bg-surface-raised p-5" aria-label="রেন্টি পরিচিতি">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-tint text-lg font-bold text-ink">
            {initials(tenant.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-ink">{tenant.name}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">রুম {currentRoomLabel}</p>
          </div>
          {isActive ? (
            <StatusChip variant="paid" label="সক্রিয়" />
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-surface-soft px-3 py-1 text-xs font-medium text-ink-faint">
              <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" aria-hidden="true" />
              প্রাক্তন
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-md bg-surface-sunken px-4 py-3">
          <span className="text-sm text-ink-muted">লিজ শুরু</span>
          <span className="text-sm font-semibold text-ink">{bnDate(tenant.moveInDate)}</span>
        </div>
      </section>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        <div className="mt-4 space-y-3 lg:mt-0">
          <section className="rounded-card border border-border bg-surface-raised" aria-label="লিজ ও রুম বদল">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <ShuffleIcon className="shrink-0 text-primary" />
              <h2 className="text-base font-semibold text-ink">লিজ ও রুম বদল</h2>
            </div>
            <ol className="relative px-5 py-4 before:absolute before:bottom-5 before:left-[27px] before:top-5 before:w-px before:bg-border">
              {leaseEvents.map((event) => (
                <li key={event.id} className="relative pb-5 pl-6">
                  <span className="absolute left-0 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-surface-raised">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  <p className="text-sm font-semibold text-ink">{event.label}</p>
                  <p className="text-xs text-ink-muted">
                    {bnDate(event.date)}
                    {event.detail ? ` · ${bnDigits(event.detail)}` : ''}
                  </p>
                </li>
              ))}
              <li className="relative pl-6">
                <span className="absolute left-0 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-surface-raised" />
                </span>
                <p className="text-sm font-semibold text-ink">বর্তমান</p>
                <p className="text-xs text-ink-muted">
                  {isActive ? `রুম ${currentRoomLabel} · ${bnMonth(activeMonth)}` : `প্রাক্তন · রুম ${currentRoomLabel}`}
                </p>
              </li>
            </ol>
          </section>
        </div>

        <section className="mt-4 lg:mt-0" aria-label="বিল ও পেমেন্ট">
          <h2 className="text-base font-semibold text-ink">বিল ও পেমেন্ট</h2>
          {moneyEvents.length === 0 ? (
            <p className="mt-2 rounded-card border border-border bg-surface-raised px-5 py-6 text-center text-sm text-ink-muted">
              এখনও কোনো বিল বা পেমেন্ট নেই।
            </p>
          ) : (
            <div className="mt-2 space-y-2.5">
              {moneyEvents.map((event) => {
                const isPayment = event.label === 'পেমেন্ট';
                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-raised p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <FileTextIcon size={16} className="shrink-0 text-primary" />
                        {event.label}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {bnDate(event.date)}
                        {event.detail ? ` · ${bnDigits(event.detail)}` : ''}
                      </p>
                    </div>
                    {typeof event.amount === 'number' ? (
                      <span className={isPayment ? 'shrink-0 text-sm font-bold text-success' : 'shrink-0 text-sm font-bold text-ink'}>
                        {bnTaka(event.amount)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <p className="mt-6 text-center text-xs text-ink-faint">{property.name}</p>
      <p className="mt-1 text-center text-xs text-ink-faint">
        <Link to={`/tenants/${tenant.id}`} className="text-primary">
          প্রোফাইলে ফিরে যান
        </Link>
      </p>
    </div>
  );
}
