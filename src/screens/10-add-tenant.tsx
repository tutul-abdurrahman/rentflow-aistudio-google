import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRepository } from '../app/repository';
import Button from '../components/Button';
import { CalendarIcon, ChevronDownIcon, HomeIcon, InfoIcon, PlusIcon, UserIcon } from '../components/Icons';
import Input from '../components/Input';
import PageHeader from '../components/PageHeader';
import { asciiDigits, bnDigits, bnMonth } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import type { MonthKey, Property, Room } from '../lib/types';

interface AddTenantData {
  property: Property;
  vacantRooms: Room[];
  activeMonth: MonthKey;
}

function ruleNote(rule: Property['midMonthRule']): string {
  return rule === 'day_wise'
    ? 'মাসের মাঝপথে যোগ দিলে ভাড়া দিন-ভিত্তিক হিসাব হবে — প্রপার্টি সেটিং অনুযায়ী।'
    : 'মাসের মাঝপথে যোগ দিলেও পুরো মাসের ভাড়া হবে — প্রপার্টি সেটিং অনুযায়ী।';
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function AddTenant() {
  const repository = useRepository();
  const navigate = useNavigate();

  const { data, loading } = useAsync<AddTenantData>(async () => {
    const [property, rooms, activeMonth] = await Promise.all([
      repository.getProperty(),
      repository.listRooms(),
      repository.getActiveMonth(),
    ]);
    return { property, vacantRooms: rooms.filter((room) => room.status === 'vacant'), activeMonth };
  }, [repository]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [roomId, setRoomId] = useState('');
  const [moveInDate, setMoveInDate] = useState(todayIso());
  const [errors, setErrors] = useState<{ name?: string; phone?: string; room?: string; date?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const vacantRooms = data?.vacantRooms ?? [];
  const noVacancy = !loading && data !== null && vacantRooms.length === 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const nextErrors: typeof errors = {};
    const digits = asciiDigits(phone).replace(/\D/g, '');
    if (!name.trim()) nextErrors.name = 'নাম আবশ্যক';
    if (digits.length !== 11) nextErrors.phone = 'সঠিক ১১ সংখ্যার নম্বর দিন';
    if (!roomId) nextErrors.room = 'রুম বেছে নিন';
    if (!moveInDate) nextErrors.date = 'তারিখ দিন';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const tenant = await repository.addTenant({
        name: name.trim(),
        phone: digits,
        roomId,
        moveInDate,
      });
      navigate(`/tenants/${tenant.id}`);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '';
      setFormError(code === 'ROOM_OCCUPIED' ? 'এই রুমে ইতিমধ্যে একজন রেন্টি আছেন।' : 'রেন্টি যোগ করা যায়নি। আবার চেষ্টা করুন।');
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="নতুন রেন্টি"
        subtitle={data?.property.name}
        backTo="/tenants"
        action={
          data ? (
            <span className="ml-auto shrink-0 rounded-pill border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink-faint">
              {bnMonth(data.activeMonth)}
            </span>
          ) : undefined
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
              helper="১১ সংখ্যার মোবাইল নম্বর"
            />
          </div>
        </section>

        <section className="mt-3 rounded-card border border-border bg-surface-raised" aria-label="রুম ও তারিখ">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <HomeIcon className="shrink-0 text-primary" />
            <h2 className="text-base font-semibold text-ink">রুম ও তারিখ</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <div>
              <label htmlFor="tn-room" className="mb-1.5 block text-sm font-medium text-ink">
                রুম <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <select
                  id="tn-room"
                  value={roomId}
                  disabled={noVacancy}
                  onChange={(event) => setRoomId(event.target.value)}
                  className="w-full appearance-none rounded-input border border-border bg-surface-raised px-4 py-3 pr-10 text-md text-ink transition-colors focus:border-border-focus disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-faint"
                >
                  <option value="">রুম বেছে নিন</option>
                  {vacantRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      রুম {bnDigits(room.number)} — খালি (উপলব্ধ)
                    </option>
                  ))}
                </select>
                <ChevronDownIcon size={18} className="pointer-events-none absolute inset-y-0 right-4 my-auto text-ink-faint" />
              </div>
              {errors.room ? (
                <p className="mt-1.5 text-xs text-danger">{errors.room}</p>
              ) : (
                <p className="mt-1.5 text-xs text-ink-faint">
                  {noVacancy ? 'এই মুহূর্তে কোনো খালি রুম নেই।' : 'শুধু খালি রুম বেছে নেওয়া যায়'}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="tn-move-in" className="mb-1.5 block text-sm font-medium text-ink">
                যোগদানের তারিখ <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <input
                  id="tn-move-in"
                  type="date"
                  value={moveInDate}
                  onChange={(event) => setMoveInDate(event.target.value)}
                  className="w-full rounded-input border border-border bg-surface-raised px-4 py-3 text-md text-ink transition-colors focus:border-border-focus"
                />
                <CalendarIcon size={18} className="pointer-events-none absolute inset-y-0 right-4 my-auto text-ink-faint" />
              </div>
              {errors.date ? <p className="mt-1.5 text-xs text-danger">{errors.date}</p> : null}
            </div>
          </div>
        </section>

        {data ? (
          <div className="mt-3 flex items-start gap-3 rounded-card bg-surface-sunken p-4">
            <InfoIcon className="mt-0.5 shrink-0 text-info" />
            <p className="text-sm leading-relaxed text-ink-muted">{ruleNote(data.property.midMonthRule)}</p>
          </div>
        ) : null}

        {formError ? (
          <p role="alert" className="mt-3 rounded-card border border-danger bg-danger-tint px-4 py-3 text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <Link
            to="/tenants"
            className="inline-flex w-full items-center justify-center rounded-button border border-secondary bg-transparent px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active sm:flex-1"
          >
            বাতিল
          </Link>
          <Button
            type="submit"
            className="w-full sm:flex-1"
            disabled={saving || noVacancy}
            leadingIcon={<PlusIcon size={18} />}
          >
            {saving ? 'সংরক্ষণ হচ্ছে…' : 'রেন্টি যোগ করুন'}
          </Button>
        </div>
      </form>
    </div>
  );
}
