import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepository } from '../app/repository';
import EmptyState from '../components/EmptyState';
import Input from '../components/Input';
import Sheet from '../components/Sheet';
import { asciiDigits, bnDigits, bnNumber } from '../lib/format';
import type { Room, Tenant } from '../lib/types';

/**
 * Screen 30 — রুম ব্যবস্থাপনা (design-output/screens/30-rooms-management.html).
 *
 * listRooms / addRoom / updateRoom only. Room vacancy is NOT a bare toggle:
 * status follows the tenant flow (add tenant → occupied, move-out → vacant).
 * The canvas's vacant-room delete control is absent — the repository contract
 * exposes no deleteRoom, so it would be a dead control.
 */

const GRID = 'mt-4 grid grid-cols-2 gap-3 md:mt-6 md:grid-cols-3 md:gap-4 xl:grid-cols-4';

const CHIP_OCCUPIED =
  'inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-success-tint px-2.5 py-1 text-xs font-medium text-success';
const CHIP_VACANT =
  'inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-surface-soft px-2.5 py-1 text-xs font-medium text-ink-muted';

const EDIT_BUTTON =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-soft hover:text-ink';

type SheetMode = { mode: 'add' } | { mode: 'edit'; room: Room };

function PencilIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function RoomIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 21h16" />
      <path d="M6 21V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16" />
      <circle cx="14" cy="13" r="1.3" />
    </svg>
  );
}

export default function RoomsManagement() {
  const repo = useRepository();

  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [sheet, setSheet] = useState<SheetMode | null>(null);
  const [roomNumber, setRoomNumber] = useState('');
  const [rent, setRent] = useState('');
  const [numberError, setNumberError] = useState<string | undefined>();
  const [rentError, setRentError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [roomRows, activeTenants] = await Promise.all([
      repo.listRooms(),
      repo.listTenants('active'),
    ]);
    setRooms(roomRows);
    setTenants(activeTenants);
    setLoading(false);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const [roomRows, activeTenants] = await Promise.all([
        repo.listRooms(),
        repo.listTenants('active'),
      ]);
      if (!alive) return;
      setRooms(roomRows);
      setTenants(activeTenants);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [repo]);

  const openAdd = () => {
    setRoomNumber('');
    setRent('');
    setNumberError(undefined);
    setRentError(undefined);
    setSheet({ mode: 'add' });
  };

  const openEdit = (room: Room) => {
    setRoomNumber(room.number);
    setRent(String(room.rent));
    setNumberError(undefined);
    setRentError(undefined);
    setSheet({ mode: 'edit', room });
  };

  const save = async () => {
    const number = asciiDigits(roomNumber.trim());
    const parsedRent = Number(rent);
    let invalid = false;

    if (!number) {
      setNumberError('রুম নম্বর লিখুন।');
      invalid = true;
    } else {
      setNumberError(undefined);
    }
    if (!Number.isFinite(parsedRent) || parsedRent <= 0) {
      setRentError('মাসিক ভাড়া লিখুন।');
      invalid = true;
    } else {
      setRentError(undefined);
    }
    if (invalid || !sheet) return;

    setSaving(true);
    try {
      if (sheet.mode === 'add') {
        await repo.addRoom({ number, rent: parsedRent });
      } else {
        await repo.updateRoom(sheet.room.id, { number, rent: parsedRent });
      }
      setSheet(null);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'ROOM_EXISTS') setNumberError('এই রুম নম্বর আগে থেকেই আছে।');
      else setNumberError('সেভ করা যায়নি। আবার চেষ্টা করুন।');
    } finally {
      setSaving(false);
    }
  };

  const tenantNameFor = (roomId: string): string | undefined =>
    tenants.find((tenant) => tenant.roomId === roomId)?.name;

  const firstNumber = rooms[0]?.number;
  const lastNumber = rooms[rooms.length - 1]?.number;
  const subtitle =
    rooms.length > 0
      ? `${bnDigits(rooms.length)}টি রুম · ${bnDigits(firstNumber ?? '')}–${bnDigits(lastNumber ?? '')}`
      : 'কোনো রুম যোগ করা হয়নি';

  return (
    <>
      <header className="pt-5 lg:flex lg:items-center lg:justify-between lg:pt-8">
        <div className="flex items-center gap-2.5">
          <Link
            to="/more"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-soft"
            aria-label="পেছনে"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold leading-tight text-ink">রুম</h1>
            <p className="text-sm text-ink-muted">{subtitle}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 lg:mt-0">
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center justify-center gap-2 rounded-button border border-secondary bg-transparent px-4 py-2.5 text-sm font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            নতুন রুম
          </button>
        </div>
      </header>

      {loading ? (
        <div className={GRID} aria-hidden="true">
          <div className="skeleton h-32 rounded-card" />
          <div className="skeleton h-32 rounded-card" />
          <div className="skeleton h-32 rounded-card" />
          <div className="skeleton h-32 rounded-card" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<RoomIcon />}
            title="এখনও কোনো রুম যোগ করা হয়নি"
            caption="প্রথমে রুম যোগ করুন, তারপর রেন্টি বসালেই বিল তৈরি শুরু হবে।"
            actionLabel="রুম যোগ করুন"
            onAction={openAdd}
          />
        </div>
      ) : (
        <section className={GRID} aria-label="রুমের তালিকা">
          {rooms.map((room) => {
            const occupied = room.status === 'occupied';
            const tenantName = tenantNameFor(room.id);
            return (
              <div
                key={room.id}
                className="rounded-card border border-border bg-surface-raised p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl font-bold leading-none tracking-tight text-ink">
                    {bnDigits(room.number)}
                  </span>
                  <span className={occupied ? CHIP_OCCUPIED : CHIP_VACANT}>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        occupied ? 'bg-success' : 'bg-ink-faint'
                      }`}
                      aria-hidden="true"
                    />
                    {occupied ? 'ভাড়া হয়েছে' : 'খালি'}
                  </span>
                </div>

                {occupied ? (
                  <p className="mt-3 truncate text-sm font-semibold text-ink">
                    {tenantName ?? '—'}
                  </p>
                ) : (
                  <Link
                    to="/tenants/add"
                    className="mt-3 block truncate text-sm font-semibold text-primary"
                  >
                    খালি — রেন্টি যোগ করুন
                  </Link>
                )}

                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink">
                    ৳{bnNumber(room.rent)}
                    <span className="ml-0.5 text-xs font-medium text-ink-faint">/মাস</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => openEdit(room)}
                    className={EDIT_BUTTON}
                    aria-label={`রুম ${bnDigits(room.number)} সম্পাদনা করুন`}
                  >
                    <PencilIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <Sheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        ariaLabel={sheet?.mode === 'edit' ? 'রুম সম্পাদনা' : 'নতুন রুম'}
      >
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
            <PencilIcon size={22} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {sheet?.mode === 'edit' ? 'রুম সম্পাদনা' : 'নতুন রুম'}
            </h2>
            <p className="text-sm text-ink-muted">
              {sheet?.mode === 'edit'
                ? `রুম ${bnDigits(sheet.room.number)}`
                : 'রুম নম্বর ও মাসিক ভাড়া দিন'}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <Input
            label="রুম নম্বর"
            type="text"
            inputMode="numeric"
            value={roomNumber}
            error={numberError}
            onChange={(event) => {
              setNumberError(undefined);
              setRoomNumber(event.target.value);
            }}
          />
          <Input
            label="মাসিক ভাড়া"
            prefix="৳"
            type="text"
            inputMode="numeric"
            value={rent}
            error={rentError}
            onChange={(event) => {
              setRentError(undefined);
              setRent(event.target.value);
            }}
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => setSheet(null)}
            className="inline-flex flex-1 items-center justify-center rounded-button border border-secondary bg-transparent px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-button bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled disabled:text-ink-faint"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m4 12 5 5L20 7" />
            </svg>
            সেভ করুন
          </button>
        </div>
      </Sheet>
    </>
  );
}
