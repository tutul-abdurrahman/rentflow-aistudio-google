import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRepository } from '../app/repository';
import {
  ClockIcon,
  FileTextIcon,
  LogOutIcon,
  PencilIcon,
  ShuffleIcon,
  UserIcon,
  WalletIcon,
} from '../components/Icons';
import PageHeader from '../components/PageHeader';
import StatusChip from '../components/StatusChip';
import { bnDate, bnDigits, bnMonth, bnNumber, bnTaka } from '../lib/format';
import { formatPhone, initials, openAmount } from '../lib/view';
import { useAsync } from '../lib/useAsync';
import type { Bill, BillStatus, MonthKey, Property, Room, Tenant } from '../lib/types';

interface BillRow {
  month: MonthKey;
  total: number;
  status: BillStatus;
}

interface ProfileData {
  tenant: Tenant;
  room: Room | null;
  property: Property;
  activeMonth: MonthKey;
  bill: Bill | null;
  meterCurrent: number | null;
  billRows: BillRow[];
}

interface ActionTileProps {
  to: string;
  label: string;
  icon: ReactNode;
}

function ActionTile({ to, label, icon }: ActionTileProps) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1.5 rounded-card border border-border bg-surface-raised px-1 py-3 transition-colors hover:bg-surface-soft"
    >
      <span className="shrink-0 text-ink-muted">{icon}</span>
      <span className="text-center text-xs font-medium leading-tight text-ink-muted">{label}</span>
    </Link>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <dt className="shrink-0 text-sm text-ink-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function statusChip(status: BillStatus) {
  return <StatusChip variant={status} />;
}

export default function TenantProfile() {
  const repository = useRepository();
  const { id } = useParams<{ id: string }>();

  const { data, loading, error } = useAsync<ProfileData | null>(async () => {
    if (!id) return null;
    const tenant = await repository.getTenant(id);
    if (!tenant) return null;

    const [rooms, property, activeMonth] = await Promise.all([
      repository.listRooms(),
      repository.getProperty(),
      repository.getActiveMonth(),
    ]);
    const [bills, meter, history] = await Promise.all([
      repository.listBills(activeMonth),
      repository.getMeterEntry(activeMonth),
      repository.getTenantHistory(tenant.id),
    ]);

    const room = rooms.find((candidate) => candidate.id === tenant.roomId) ?? null;
    const bill = bills.find((candidate) => candidate.tenantId === tenant.id) ?? null;
    const meterCurrent = tenant.roomId
      ? (meter?.rooms.find((row) => row.roomId === tenant.roomId)?.current ?? null)
      : null;

    const months = [
      ...new Set(
        history
          .filter((event) => event.label === 'মাসিক বিল')
          .map((event) => event.date.slice(0, 7)),
      ),
    ].sort((a, b) => b.localeCompare(a));
    const monthBills = await Promise.all(months.map((month) => repository.listBills(month)));
    const billRows: BillRow[] = monthBills
      .map((list, index) => {
        const found = list.find((candidate) => candidate.tenantId === tenant.id);
        return found ? { month: months[index], total: found.total, status: found.status } : null;
      })
      .filter((row): row is BillRow => row !== null);

    return { tenant, room, property, activeMonth, bill, meterCurrent, billRows };
  }, [repository, id]);

  if (loading && !data) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="mt-6 h-28 animate-pulse rounded-card bg-surface-soft" aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <p role="alert" className="mt-4 rounded-card border border-danger bg-danger-tint px-4 py-3 text-sm text-danger">
          প্রোফাইল লোড করা যায়নি।
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="রেন্টি প্রোফাইল" backTo="/tenants" />
        <p className="mt-4 rounded-card border border-border bg-surface-raised px-4 py-6 text-center text-sm text-ink-muted">
          রেন্টি খুঁজে পাওয়া যায়নি।
        </p>
      </div>
    );
  }

  const { tenant, room, property, activeMonth, bill, meterCurrent, billRows } = data;
  const outstanding = bill ? openAmount(bill.total, bill.paidAmount) : 0;
  const isActive = tenant.status === 'active';

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="রেন্টি প্রোফাইল"
        subtitle={property.name}
        backTo="/tenants"
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
            <p className="mt-0.5 text-sm text-ink-muted">
              রুম {bnDigits(room?.number ?? '—')} · {bnMonth(activeMonth)}
            </p>
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
          <span className="text-sm text-ink-muted">মাসিক ভাড়া</span>
          <span className="text-sm font-semibold text-ink">{bnTaka(room?.rent ?? 0)}</span>
        </div>
      </section>

      <section className="mt-3 grid grid-cols-4 gap-2.5" aria-label="দ্রুত অ্যাকশন">
        {isActive ? (
          <>
            <ActionTile to={`/tenants/${tenant.id}/shift`} label="শিফট রুম" icon={<ShuffleIcon size={20} />} />
            <ActionTile to={`/tenants/${tenant.id}/edit`} label="সম্পাদনা" icon={<PencilIcon size={20} />} />
            <ActionTile to={`/tenants/${tenant.id}/move-out`} label="মুভ আউট" icon={<LogOutIcon size={20} />} />
          </>
        ) : null}
        <ActionTile to={`/tenants/${tenant.id}/history`} label="হিস্টরি" icon={<ClockIcon size={20} />} />
      </section>

      <section className="mt-3 rounded-card border border-border bg-surface-raised" aria-label="তথ্য">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <UserIcon className="shrink-0 text-primary" />
          <h2 className="text-base font-semibold text-ink">তথ্য</h2>
        </div>
        <dl className="divide-y divide-border">
          <InfoRow label="মোবাইল">{formatPhone(tenant.phone)}</InfoRow>
          <InfoRow label="যোগদানের তারিখ">{bnDate(tenant.moveInDate)}</InfoRow>
          {meterCurrent !== null ? (
            <InfoRow label="সাব-মিটার শেষ রিডিং">{bnNumber(meterCurrent)} ইউনিট</InfoRow>
          ) : null}
        </dl>
      </section>

      <section className="mt-3 rounded-card border border-border bg-surface-raised" aria-label="আর্থিক">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <WalletIcon className="shrink-0 text-primary" />
          <h2 className="text-base font-semibold text-ink">আর্থিক</h2>
        </div>
        <dl className="divide-y divide-border">
          <InfoRow label="মাসিক ভাড়া">{bnTaka(room?.rent ?? 0)}</InfoRow>
          <InfoRow label="বর্তমান বকেয়া">
            {outstanding > 0 ? (
              <span className="inline-flex items-center gap-2">
                <span className="font-semibold text-warning">{bnTaka(outstanding)}</span>
                <StatusChip variant={bill?.status === 'due' ? 'overdue' : 'due'} />
              </span>
            ) : (
              <span className="text-success">বাকি নেই</span>
            )}
          </InfoRow>
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <dt className="shrink-0 text-sm text-ink-muted">অবস্থা</dt>
            <dd>
              {isActive ? (
                <StatusChip variant="paid" label="সক্রিয়" />
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-soft px-3 py-1 text-xs font-medium text-ink-faint">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" aria-hidden="true" />
                  প্রাক্তন
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {billRows.length > 0 ? (
        <section className="mt-3 rounded-card border border-border bg-surface-raised" aria-label="বিলের ইতিহাস">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <FileTextIcon className="shrink-0 text-primary" />
              বিলের ইতিহাস
            </h2>
            <Link to={`/tenants/${tenant.id}/history`} className="text-sm font-medium text-primary">
              পুরো হিস্টরি
            </Link>
          </div>
          <div className="divide-y divide-border">
            {billRows.map((row) => (
              <div key={row.month} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{bnMonth(row.month)}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">মোট {bnTaka(row.total)}</p>
                </div>
                {statusChip(row.status)}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
