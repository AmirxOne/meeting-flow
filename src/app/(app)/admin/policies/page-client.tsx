"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";
import { cn, faNum, formatJalali } from "@/lib";
import { FaInput } from "@/components/ui/fa-input";
import { validateReminderOffsets } from "@/lib/reminder-offsets";
import { Select } from "@/components/ui/select";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { Modal } from "@/components/ui/modal";
import { DEFAULT_HOLIDAY_BOOKING, type HolidayBookingMode } from "@/lib/holiday";

interface Policy {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: string;
}

const POLICY_FA: Record<string, { label: string; type: "bool" | "number" | "list"; unit?: string }> = {
  requireApprovalExternalGuest: { label: "جلسه با مهمان خارجی نیاز به تأیید دارد", type: "bool" },
  requireApprovalVipRoom: { label: "اتاق VIP نیاز به تأیید دارد", type: "bool" },
  requireApprovalLongerThanMin: { label: "جلسه طولانی‌تر از این مدت نیاز به تأیید دارد", type: "number", unit: "دقیقه" },
  autoApproveInternal: { label: "جلسه داخلی خودکار تأیید شود", type: "bool" },
  minDurationMin: { label: "حداقل مدت جلسه", type: "number", unit: "دقیقه" },
  maxDurationMin: { label: "حداکثر مدت جلسه", type: "number", unit: "دقیقه" },
  defaultReminderOffsets: { label: "یادآورها (دقیقه قبل از جلسه)", type: "list" },
};

const HOLIDAY_MODE_OPTIONS = [
  { value: "BLOCK", label: "رزرو ممنوع", hint: "در روز تعطیل اتاق رزرو نمی‌شود" },
  { value: "REQUIRE_APPROVAL", label: "نیاز به تأیید", hint: "رزرو ثبت می‌شود ولی باید تأیید شود" },
];

function ReminderOffsetsEditor({
  value,
  onSave,
  busy,
}: {
  value: number[];
  onSave: (offsets: number[]) => Promise<void>;
  busy?: boolean;
}) {
  const [draft, setDraft] = useState<number[]>(value);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(value);
    setError("");
  }, [value]);

  async function commit(next: number[]) {
    const checked = validateReminderOffsets(next);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setError("");
    setDraft(checked.offsets);
    await onSave(checked.offsets);
  }

  function updateAt(index: number, raw: string) {
    const n = Number(raw);
    if (!raw.trim() || Number.isNaN(n)) {
      const copy = [...draft];
      copy[index] = 0;
      setDraft(copy);
      return;
    }
    const copy = [...draft];
    copy[index] = Math.round(n);
    setDraft(copy);
  }

  return (
    <div className="w-full min-w-[220px] shrink-0 sm:max-w-xs" data-testid="reminder-offsets-editor">
      <div className="space-y-2">
        {draft.map((offset, index) => (
          <div key={index} className="flex items-center gap-2" data-testid="reminder-offset-row">
            <FaInput
              value={offset || ""}
              disabled={busy}
              onChange={(raw) => updateAt(index, raw)}
              onBlur={() => commit(draft)}
              className="h-9 flex-1 text-center"
              aria-label={`یادآور ${faNum(index + 1)}`}
            />
            <span className="text-[11px] text-ink-faint">دقیقه</span>
            <button
              type="button"
              disabled={busy}
              aria-label="حذف یادآور"
              onClick={() => commit(draft.filter((_, i) => i !== index))}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-ink-soft hover:bg-paper-soft disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy || draft.length >= 12}
        className="mt-2 h-8 px-2 text-[11px]"
        data-testid="reminder-offset-add"
        onClick={() => commit([...draft, 15])}
      >
        <Plus className="h-3.5 w-3.5" />
        افزودن یادآور
      </Button>
      {error ? <p className="mt-1.5 text-[11px] text-red-600">{error}</p> : null}
      {draft.length === 0 ? (
        <p className="mt-1 text-[10px] text-ink-faint">بدون یادآور — جلسات جدید یادآوری دریافت نمی‌کنند</p>
      ) : null}
    </div>
  );
}

function PolicyNumberInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <FaInput
      value={draft}
      onChange={setDraft}
      onBlur={(ascii) => {
        const v = Number(ascii);
        if (!Number.isNaN(v) && v !== value) onCommit(v);
      }}
      className="h-9 w-24 shrink-0 text-center"
    />
  );
}

export function AdminPoliciesPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { push } = useToast();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: () => api<{ policies: Policy[] }>("/api/admin/policies"),
    enabled: can("policy:manage"),
  });

  async function update(key: string, value: unknown) {
    setSavingKey(key);
    try {
      await api("/api/admin/policies", { method: "PATCH", json: { key, value } });
      push("سیاست ذخیره شد", "success");
      qc.invalidateQueries({ queryKey: ["policies"] });
      if (key === "holidayBooking") {
        qc.invalidateQueries({ queryKey: ["org-holidays"] });
      }
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setSavingKey(null);
    }
  }

  if (!can("policy:manage")) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-[13px] text-ink-soft">
          مدیریت سیاست‌ها نیازمند دسترسی policy:manage است.
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
        <div className="skeleton h-7 w-40" />
        <Card>
          <div className="border-b border-line px-5 py-4">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="mt-1 h-3 w-48" />
          </div>
          <div className="space-y-4 p-5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between border-b border-line pb-4 last:border-0 last:pb-0">
                <div className="space-y-1.5">
                  <SkeletonBlock className="h-4 w-52" />
                  <SkeletonBlock className="h-3 w-64" />
                </div>
                <SkeletonBlock className="h-6 w-11 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const policies = data?.policies ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
      <h1 className="text-lg font-bold">سیاست‌های جلسه</h1>

      <Card>
        <CardHeader title="قواعد تأیید و محدودیت‌ها" subtitle="تغییرات بلافاصله اعمال می‌شود" />
        <CardBody className="space-y-4">
          {policies.length === 0 && (
            <EmptyState title="سیاستی ثبت نشده است" description="قواعد پیش‌فرض سیستم فعال است. با افزودن سیاست، رفتار تأیید جلسات قابل تنظیم می‌شود." />
          )}
          {policies.filter((p) => p.key !== "holidayBooking").map((p) => {
            const meta = POLICY_FA[p.key] ?? { label: p.key, type: "bool" as const };
            const isList = meta.type === "list";
            return (
              <div
                key={p.id}
                className={cn(
                  "flex gap-4 border-b border-line pb-4 last:border-0 last:pb-0",
                  isList ? "flex-col sm:flex-row sm:items-start sm:justify-between" : "items-center justify-between",
                )}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{meta.label}</p>
                  {p.description && <p className="mt-0.5 text-[11px] text-ink-faint">{p.description}</p>}
                </div>
                {meta.type === "bool" && (
                  <button
                    onClick={() => update(p.key, !p.value)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${p.value ? "bg-ink" : "bg-paper-deep"}`}
                    aria-label="تغییر"
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p.value ? "right-0.5" : "right-[22px]"}`}
                    />
                  </button>
                )}
                {meta.type === "number" && (
                  <PolicyNumberInput
                    value={Number(p.value)}
                    onCommit={(v) => update(p.key, v)}
                  />
                )}
                {meta.type === "list" && (
                  <ReminderOffsetsEditor
                    value={Array.isArray(p.value) ? (p.value as number[]) : []}
                    busy={savingKey === p.key}
                    onSave={(offsets) => update(p.key, offsets)}
                  />
                )}
              </div>
            );
          })}
        </CardBody>
      </Card>

      <HolidaysCard
        bookingMode={
          (policies.find((p) => p.key === "holidayBooking")?.value as HolidayBookingMode | undefined) ??
          DEFAULT_HOLIDAY_BOOKING
        }
        onMode={(mode) => update("holidayBooking", mode)}
        modeBusy={savingKey === "holidayBooking"}
      />
    </div>
  );
}

function HolidaysCard({
  bookingMode,
  onMode,
  modeBusy,
}: {
  bookingMode: HolidayBookingMode;
  onMode: (mode: HolidayBookingMode) => void;
  modeBusy: boolean;
}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [dateIso, setDateIso] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["org-holidays"],
    queryFn: () =>
      api<{ holidays: { id: string; dateIso: string; name: string }[]; bookingMode: HolidayBookingMode }>(
        "/api/holidays",
      ),
  });

  const holidays = data?.holidays ?? [];

  async function addHoliday() {
    if (!dateIso || name.trim().length < 2) {
      push("تاریخ و نام تعطیلی را وارد کنید", "error");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/holidays", { method: "POST", json: { dateIso, name: name.trim() } });
      push("تعطیلی ثبت شد", "success");
      setOpen(false);
      setDateIso("");
      setName("");
      qc.invalidateQueries({ queryKey: ["org-holidays"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeHoliday(id: string) {
    setBusy(true);
    try {
      await api(`/api/admin/holidays/${id}`, { method: "DELETE" });
      push("تعطیلی حذف شد", "success");
      qc.invalidateQueries({ queryKey: ["org-holidays"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card data-tour="org-holidays">
      <CardHeader
        title="تعطیلات و روزهای مسدود"
        subtitle="تاریخ‌ها شمسی انتخاب می‌شوند؛ رزرو اتاق در این روزها طبق سیاست زیر است"
      />
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] font-medium">سیاست رزرو در تعطیل</p>
          <Select
            value={bookingMode}
            disabled={modeBusy}
            onChange={(v) => onMode(v as HolidayBookingMode)}
            options={HOLIDAY_MODE_OPTIONS}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-ink-soft">{faNum(holidays.length)} روز ثبت‌شده</p>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            افزودن تعطیلی
          </Button>
        </div>
        {isLoading ? (
          <SkeletonBlock className="h-16 w-full" />
        ) : holidays.length === 0 ? (
          <EmptyState
            title="تعطیلی ثبت نشده"
            description="نوروز، تعطیلات رسمی یا روز مسدود سازمان را با انتخابگر شمسی اضافه کنید."
          />
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div>
                  <p className="text-[13px] font-medium">{h.name}</p>
                  <p className="text-[11px] text-ink-faint">
                    {formatJalali(new Date(`${h.dateIso}T12:00:00`), { monthName: true })}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  aria-label="حذف تعطیلی"
                  onClick={() => removeHoliday(h.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-soft hover:bg-paper-soft disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="تعطیلی جدید"
        subtitle="تاریخ را با تقویم شمسی انتخاب کنید"
        footer={
          <div className="flex gap-2">
            <Button onClick={addHoliday} loading={busy}>
              ثبت
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">تاریخ (شمسی)</label>
            <JalaliDatePicker value={dateIso} onChange={setDateIso} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">نام</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً نوروز"
              className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink"
            />
          </div>
        </div>
      </Modal>
    </Card>
  );
}
