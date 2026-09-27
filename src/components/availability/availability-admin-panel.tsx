"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { TimePicker } from "@/components/ui/jalali-date-picker";
import { useToast } from "@/components/ui/toast";
import { cn, faNum } from "@/lib";
import { CalendarDays, Check, Clock, Plus, Search, Settings2, UserX, X } from "@/components/ui/icon";

/**
 * پنل ادمین «اعلام زمان‌های آزاد» — صفحه‌ی /users
 * انتخاب افراد با جستجو (کاستوم)، تنظیم زمان‌بندی با Select/TimePicker کاستوم پروژه.
 */

interface Config {
  id: string; cadence: string; createDay: number; periodKind: string;
  deadlineDayOffset: number; deadlineMinutes: number; isActive: boolean;
}
interface Slot { date: string; startTime: string; endTime: string }
interface Req {
  id: string; periodStart: string; periodEnd: string; deadline: string; status: string;
  submittedAt: string | null;
  user: { id: string; fullName: string; email: string };
  submittedBy: { id: string; fullName: string } | null;
  slots?: Slot[];
}
interface Member { id: string; user: { id: string; fullName: string; email: string } }

const STATUS_FA: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "در انتظار ثبت", cls: "bg-amber-50 text-amber-700" },
  SUBMITTED: { label: "ثبت شده", cls: "bg-emerald-50 text-emerald-700" },
  OVERDUE: { label: "مهلت گذشته", cls: "bg-red-50 text-red-600" },
  CLOSED: { label: "بسته", cls: "bg-paper-soft text-ink-faint" },
};

const DAYS_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

const PERIOD_OPTIONS: SelectOption[] = [
  { value: "NEXT_WEEK", label: "هفته‌ی آینده", hint: "شنبه تا جمعه‌ی بعدی" },
  { value: "THIS_WEEK", label: "هفته‌ی جاری", hint: "همین هفته" },
  { value: "NEXT_MONTH", label: "ماه آینده", hint: "کل ماه شمسیِ بعد" },
  { value: "THIS_MONTH", label: "ماه جاری", hint: "کل همین ماه شمسی" },
];

function faDate(iso: string): string {
  return new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("fa-IR", {
    month: "long", day: "numeric",
  });
}
function faDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", { month: "long", day: "numeric" }) + " ساعت " +
    new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

export function AvailabilityAdminPanel({ users }: { users: { id: string; fullName: string }[] }) {
  const qc = useQueryClient();
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [detail, setDetail] = useState<Req | null>(null);

  const { data } = useQuery({
    queryKey: ["availability-admin"],
    queryFn: () => api<{ config: Config; requests: Req[]; members: Member[] }>(`/api/availability-mgmt?scope=org`),
    retry: false,
  });

  const memberIds = useMemo(() => new Set((data?.members ?? []).map((m) => m.user.id)), [data]);

  // جستجو + انتخاب‌شده‌ها همیشه بالا
  const visible = useMemo(() => {
    const q = query.trim();
    const matched = q ? users.filter((u) => u.fullName.includes(q)) : users;
    // انتخاب‌شده‌ها اول، بعد بقیه
    const sel = matched.filter((u) => selected.has(u.id));
    const rest = matched.filter((u) => !selected.has(u.id));
    return [...sel, ...rest];
  }, [users, query, selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = visible.length > 0 && visible.every((u) => selected.has(u.id));

  async function applyMembers(remove = false) {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await api<{ changed: number }>("/api/availability-mgmt", {
        method: "POST",
        json: { userIds: [...selected], remove },
      });
      push(remove ? "از فرآیند خارج شدند" : `${faNum(res.changed)} نفر مشمول شدند`, "success");
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["availability-admin"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const config = data?.config;
  const requests = data?.requests ?? [];
  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === config?.periodKind)?.label ?? "هفته‌ی آینده";

  return (
    <Card>
      <CardHeader
        title="اعلام زمان‌های آزاد"
        subtitle={config?.isActive
          ? `هر ${DAYS_FA[config.createDay] ?? ""} · ${periodLabel} · ${faNum(memberIds.size)} نفر مشمول`
          : "غیرفعال — تنظیمات را کامل و ذخیره کنید"}
        action={
          <Button size="sm" variant="outline" onClick={() => setShowSettings((v) => !v)}>
            <Settings2 className="h-4 w-4" />
            تنظیمات زمان‌بندی
          </Button>
        }
      />

      {/* ── تنظیمات زمان‌بندی ── */}
      {showSettings && config && (
        <div className="border-b border-line bg-paper-soft/40 p-4">
          <ConfigForm
            config={config}
            busy={busy}
            onSave={async (cfg) => {
              setBusy(true);
              try {
                await api("/api/availability-mgmt", { method: "POST", json: cfg });
                push("تنظیمات ذخیره شد", "success");
                await qc.invalidateQueries({ queryKey: ["availability-admin"] });
              } catch (e) {
                push((e as ApiError).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
      )}

      <div className="p-5">
        {/* ── انتخاب افراد ── */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی فرد برای افزودن به فرآیند…"
              className="h-11 w-full rounded-xl border border-line bg-paper-soft/40 pr-9 pl-3 text-right text-[13px] outline-none transition-all focus:border-ink/40 focus:bg-white focus:ring-4 focus:ring-ink/10"
            />
          </div>
          {users.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((u) => u.id)))}
              className="h-11 rounded-xl border border-line px-3 text-[12.5px] text-ink-soft transition-colors hover:bg-paper-soft"
            >
              {allVisibleSelected ? "لغو انتخاب" : `انتخاب همه (${faNum(visible.length)})`}
            </button>
          )}
        </div>

        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ink/15 bg-white p-2">
            <span className="px-1 text-[11.5px] text-ink-faint">انتخاب‌شده ({faNum(selected.size)}):</span>
            {users.filter((u) => selected.has(u.id)).slice(0, 8).map((u) => (
              <span key={u.id} className="flex items-center gap-1 rounded-full bg-paper-soft px-2.5 py-1 text-[12px]">
                {u.fullName}
                <button type="button" aria-label={`حذف ${u.fullName}`} onClick={() => toggle(u.id)} className="text-ink-faint hover:text-red-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {selected.size > 8 && <span className="text-[11.5px] text-ink-faint">+{faNum(selected.size - 8)} نفر دیگر</span>}
            <div className="mr-auto flex items-center gap-2">
              <Button size="sm" onClick={() => applyMembers(false)} disabled={busy}>
                <Plus className="h-3.5 w-3.5" />
                مشمول فرآیند کن
              </Button>
              <Button size="sm" variant="ghost" onClick={() => applyMembers(true)} disabled={busy}>
                <UserX className="h-3.5 w-3.5" />
                خروج
              </Button>
            </div>
          </div>
        )}

        {/* لیست افراد — ردیف‌های فشرده با چک‌باکس */}
        <div className="mb-5 max-h-52 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {visible.length === 0 && (
            <p className="p-3 text-center text-[12.5px] text-ink-faint">موردی پیدا نشد</p>
          )}
          {visible.map((u) => (
            <label key={u.id} className={cn("flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[12.5px] transition-colors hover:bg-paper-soft/60", selected.has(u.id) && "bg-paper-soft")}>
              <input
                type="checkbox"
                checked={selected.has(u.id)}
                onChange={() => toggle(u.id)}
                className="size-4 accent-black"
              />
              <span className="min-w-0 flex-1 truncate">{u.fullName}</span>
              {memberIds.has(u.id) && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] text-emerald-700">
                  <Check className="h-3 w-3" />
                  مشمول
                </span>
              )}
            </label>
          ))}
        </div>

        {/* ── گروه‌بندی بر اساس دوره ── */}
        {requests.length === 0 ? (
          <EmptyState
            title="هنوز درخواستی ساخته نشده"
            description={`اولین درخواست در اولین ${DAYS_FA[config?.createDay ?? 3] ?? "چهارشنبه"}ِ زمان‌بندی‌شده ساخته می‌شود`}
          />
        ) : (
          <div className="space-y-3">
            {groupRequestsByPeriod(requests).map((g) => (
              <div key={`${g.start}__${g.end}`} className="overflow-hidden rounded-xl border border-line">
                <div className="flex items-center gap-2 border-b border-line bg-paper-soft/60 px-3 py-2">
                  <CalendarDays className="h-4 w-4 text-ink-faint" />
                  <p className="text-[12.5px] font-bold">
                    {faDate(g.start)} تا {faDate(g.end)}
                  </p>
                  <span className="text-[11px] text-ink-faint">({faNum(g.items.length)} نفر)</span>
                  <span className="mr-auto text-[10.5px] text-ink-faint">
                    مهلت: {faDateTime(g.items[0].deadline)}
                  </span>
                </div>
                <div className="divide-y divide-line">
                  {g.items.map((r) => {
                    const st = STATUS_FA[r.status] ?? STATUS_FA.PENDING;
                    const mySlots = r.slots ?? [];
                    return (
                      <div key={r.id}>
                        <button
                          type="button"
                          onClick={() => setDetail(r)}
                          className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-right transition-colors hover:bg-paper-soft/50"
                        >
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{r.user.fullName}</span>
                          {r.submittedBy && r.submittedBy.id !== r.user.id && (
                            <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink-soft">ثبت توسط {r.submittedBy.fullName}</span>
                          )}
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", st.cls)}>{st.label}</span>
                        </button>
                        {/* اسلات‌های ثبت‌شده‌ی این فرد در همین دوره */}
                        {mySlots.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 bg-paper-soft/30 px-3 pb-2.5 pt-0.5">
                            {slotsByDay(mySlots).map(({ day, slots }) => (
                              <span key={day} className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1 text-[11px]">
                                <span className="font-medium text-ink">{dayNameFa(day)}</span>
                                <span dir="ltr" className="tabular-nums text-ink-soft">
                                  {slots.map((s) => `${s.startTime}-${s.endTime}`).join(" · ")}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detail && (
        <AdminRequestDetail
          req={detail}
          onClose={() => setDetail(null)}
          onSaved={async () => { await qc.invalidateQueries({ queryKey: ["availability-admin"] }); }}
        />
      )}
    </Card>
  );
}

/* ───────── تنظیمات زمان‌بندی ───────── */
function ConfigForm({ config, busy, onSave }: { config: Config; busy: boolean; onSave: (cfg: Partial<Config>) => Promise<void> }) {
  const [createDay, setCreateDay] = useState(String(config.createDay));
  const [periodKind, setPeriodKind] = useState(config.periodKind);
  const [deadlineDay, setDeadlineDay] = useState(String(config.deadlineDayOffset));
  const [deadlineTime, setDeadlineTime] = useState(`${String(Math.floor(config.deadlineMinutes / 60)).padStart(2, "0")}:${String(config.deadlineMinutes % 60).padStart(2, "0")}`);

  const deadlineDayOptions: SelectOption[] = [
    { value: "0", label: "همان روز", hint: "روزِ ایجاد درخواست" },
    { value: "1", label: "۱ روز بعد" },
    { value: "2", label: "۲ روز بعد" },
    { value: "3", label: "۳ روز بعد" },
    { value: "7", label: "۱ هفته بعد" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1.5 text-[11.5px] text-ink-faint">
        روز ایجاد درخواست
        <Select value={createDay} onChange={setCreateDay} options={DAYS_FA.map((d, i) => ({ value: String(i), label: `هر ${d}` }))} />
      </label>
      <label className="flex flex-col gap-1.5 text-[11.5px] text-ink-faint">
        افراد زمان‌های آزادِ چه بازه‌ای را اعلام کنند؟
        <Select value={periodKind} onChange={setPeriodKind} options={PERIOD_OPTIONS} />
      </label>
      <label className="flex flex-col gap-1.5 text-[11.5px] text-ink-faint">
        مهلت ثبت — نسبت به روز ایجاد
        <Select value={deadlineDay} onChange={setDeadlineDay} options={deadlineDayOptions} />
      </label>
      <label className="flex flex-col gap-1.5 text-[11.5px] text-ink-faint sm:col-span-1">
        ساعت مهلت
        <div className="h-11">
          <TimePicker value={deadlineTime} onChange={setDeadlineTime} className="grid-cols-2 [&>div>button]:h-11" />
        </div>
      </label>
      <div className="flex items-end">
        <Button
          disabled={busy}
          onClick={() => {
            const [h, m] = deadlineTime.split(":").map(Number);
            void onSave({
              cadence: "WEEKLY",
              createDay: Number(createDay),
              periodKind,
              deadlineDayOffset: Number(deadlineDay),
              deadlineMinutes: h * 60 + m,
              isActive: true,
            });
          }}
        >
          {busy ? "در حال ذخیره…" : "ذخیره تنظیمات"}
        </Button>
      </div>
    </div>
  );
}

/* ───────── جزئیات درخواست (ادمین) ───────── */
function AdminRequestDetail({ req, onClose, onSaved }: { req: Req; onClose: () => void; onSaved: () => Promise<void> }) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [slots, setSlots] = useState<{ date: string; startTime: string; endTime: string }[]>([]);

  const days: string[] = [];
  {
    const d = new Date(req.periodStart.slice(0, 10) + "T12:00:00Z");
    const end = new Date(req.periodEnd.slice(0, 10) + "T12:00:00Z");
    while (d <= end) { days.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  }

  const { data } = useQuery({
    queryKey: ["availability-detail", req.id],
    queryFn: () => api<{ request: { slots: { date: string; startTime: string; endTime: string }[] } }>(`/api/availability-mgmt`, { method: "PATCH", json: { id: req.id } }),
    retry: false,
  });

  async function submitAdmin() {
    if (slots.length === 0) { push("حداقل یک بازه وارد کنید", "error"); return; }
    setBusy(true);
    try {
      await api("/api/availability-mgmt", { method: "PUT", json: { requestId: req.id, slots } });
      push(`از طرف ${req.user.fullName} ثبت شد`, "success");
      await onSaved();
      onClose();
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const existing = data?.request?.slots ?? [];
  const st = STATUS_FA[req.status] ?? STATUS_FA.PENDING;
  const existingByDay = new Map<string, { startTime: string; endTime: string }[]>();
  for (const s of existing) {
    const k = s.date.slice(0, 10);
    existingByDay.set(k, [...(existingByDay.get(k) ?? []), s]);
  }

  return (
    <div className="border-t border-line bg-paper-soft/30 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-[14px] font-bold">{req.user.fullName}</p>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", st.cls)}>{st.label}</span>
        <span className="flex items-center gap-1 text-[11px] text-ink-faint">
          <Clock className="h-3.5 w-3.5" />
          مهلت: {faDateTime(req.deadline)}
        </span>
        {req.submittedAt && (
          <span className="text-[11px] text-ink-faint">
            ثبت: {faDateTime(req.submittedAt)} توسط {req.submittedBy?.fullName ?? req.user.fullName}
          </span>
        )}
        <button type="button" onClick={onClose} aria-label="بستن" className="mr-auto text-ink-faint hover:text-ink"><X className="h-4 w-4" /></button>
      </div>

      {/* ثبت‌شده‌ی فعلی */}
      {existing.length > 0 && (
        <div className="mb-4 space-y-1.5 rounded-xl border border-line bg-white p-3">
          {days.filter((d) => existingByDay.has(d)).map((day) => {
            const wd = new Date(day + "T12:00:00Z").getUTCDay();
            return (
              <p key={day} className="text-[12.5px]">
                <span className="font-medium">{DAYS_FA[(wd + 1) % 7]} {faDate(day)}:</span>{" "}
                <span dir="ltr" className="tabular-nums">{existingByDay.get(day)!.map((s) => `${s.startTime}-${s.endTime}`).join(" · ")}</span>
              </p>
            );
          })}
        </div>
      )}

      {/* ثبت/ویرایش از طرف کاربر */}
      <div className="rounded-xl border border-dashed border-line bg-white p-3">
        <p className="mb-2 text-[12px] font-medium text-ink-soft">ثبت از طرف کاربر (ادمین):</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {days.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSlots((prev) => [...prev, { date: day, startTime: "09:00", endTime: "12:00" }])}
              className="rounded-lg border border-line px-2 py-1 text-[11.5px] text-ink-soft transition-colors hover:bg-paper-soft"
            >
              + {DAYS_FA[(new Date(day + "T12:00:00Z").getUTCDay() + 1) % 7]} {faDate(day)}
            </button>
          ))}
        </div>
        {slots.map((s, i) => (
          <div key={i} className="mb-1.5 flex items-center gap-2">
            <span className="min-w-[110px] text-[11.5px] text-ink-faint">{DAYS_FA[(new Date(s.date + "T12:00:00Z").getUTCDay() + 1) % 7]} {faDate(s.date)}</span>
            <input type="time" dir="ltr" value={s.startTime} onChange={(e) => setSlots((p) => p.map((x, j) => j === i ? { ...x, startTime: e.target.value } : x))} className="h-9 w-[100px] rounded-md border border-line px-2 text-center text-[12.5px] tabular-nums outline-none focus:border-ink" />
            <span className="text-ink-faint">—</span>
            <input type="time" dir="ltr" value={s.endTime} onChange={(e) => setSlots((p) => p.map((x, j) => j === i ? { ...x, endTime: e.target.value } : x))} className="h-9 w-[100px] rounded-md border border-line px-2 text-center text-[12.5px] tabular-nums outline-none focus:border-ink" />
            <button type="button" aria-label="حذف" onClick={() => setSlots((p) => p.filter((_, j) => j !== i))} className="text-ink-faint hover:text-red-600"><X className="h-4 w-4" /></button>
          </div>
        ))}
        {slots.length > 0 && (
          <Button size="sm" onClick={submitAdmin} disabled={busy} className="mt-1">
            <Check className="h-3.5 w-3.5" />
            {busy ? "در حال ثبت…" : `ثبت از طرف ${req.user.fullName}`}
          </Button>
        )}
      </div>
    </div>
  );
}

function dayNameFa(dateIso: string): string {
  const wd = new Date(dateIso + "T12:00:00Z").getUTCDay();
  return `${DAYS_FA[(wd + 1) % 7]} ${faDate(dateIso)}`;
}

function groupRequestsByPeriod(requests: Req[]): { start: string; end: string; items: Req[] }[] {
  const map = new Map<string, { start: string; end: string; items: Req[] }>();
  for (const r of requests) {
    const start = r.periodStart.slice(0, 10);
    const end = r.periodEnd.slice(0, 10);
    const key = `${start}__${end}`;
    const g = map.get(key) ?? { start, end, items: [] };
    g.items.push(r);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.start.localeCompare(a.start));
}

function slotsByDay(slots: Slot[]): { day: string; slots: Slot[] }[] {
  const map = new Map<string, Slot[]>();
  for (const s of slots) {
    const k = s.date.slice(0, 10);
    map.set(k, [...(map.get(k) ?? []), s]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, ss]) => ({ day, slots: ss.sort((a, b) => a.startTime.localeCompare(b.startTime)) }));
}
