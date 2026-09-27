"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { TimePicker } from "@/components/ui/jalali-date-picker";
import { useToast } from "@/components/ui/toast";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn, faNum } from "@/lib";
import { CalendarDays, CalendarClock, Check, Clock, Plus, UserX, X } from "@/components/ui/icon";
import type { Colleague } from "@/lib/colleague-directory";

/**
 * جدول حرفه‌ای «کاربران + اعلام زمان‌های آزاد» برای ادمین:
 * نوار تنظیم زمان‌بندی + جدول انتخاب‌پذیر (تک/چند/همه) + دوره‌های ثبت‌شده.
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
  return new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("fa-IR", { month: "long", day: "numeric" });
}
function faDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", { month: "long", day: "numeric" }) + " ساعت " +
    new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}
function dayNameFa(dateIso: string): string {
  const wd = new Date(dateIso + "T12:00:00Z").getUTCDay();
  return `${DAYS_FA[(wd + 1) % 7]} ${faDate(dateIso)}`;
}

export function UsersAvailabilityTable({ users, isLoading }: { users: Colleague[]; isLoading: boolean }) {
  const qc = useQueryClient();
  const { push } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const { data, isLoading: cfgLoading } = useQuery({
    queryKey: ["availability-admin"],
    queryFn: () => api<{ config: Config; requests: Req[]; members: Member[] }>(`/api/availability-mgmt?scope=org`),
    retry: false,
  });

  const memberIds = useMemo(() => new Set((data?.members ?? []).map((m) => m.user.id)), [data]);
  const requests = data?.requests ?? [];
  const config = data?.config;

  // آخرین وضعیت هر کاربر (برای ستون وضعیت جدول)
  const latestByUser = useMemo(() => {
    const map = new Map<string, Req>();
    for (const r of requests) {
      const prev = map.get(r.user.id);
      if (!prev || r.periodStart > prev.periodStart) map.set(r.user.id, r);
    }
    return map;
  }, [requests]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const allSelected = users.length > 0 && selected.size === users.length;

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

  async function saveConfig(cfg: Partial<Config>) {
    setBusy(true);
    try {
      await api("/api/availability-mgmt", { method: "POST", json: cfg });
      push("تنظیمات زمان‌بندی ذخیره شد", "success");
      await qc.invalidateQueries({ queryKey: ["availability-admin"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── نوار تنظیم زمان‌بندی ── */}
      {cfgLoading ? (
        <Card className="p-4"><SkeletonBlock className="h-11 w-full" /></Card>
      ) : config ? (
        <ScheduleBar config={config} busy={busy} onSave={saveConfig} memberCount={memberIds.size} />
      ) : null}

      {/* ── جدول کاربران ── */}
      <Card className="overflow-hidden p-0">
        {/* هدر جدول */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <p className="text-[13px] font-bold">افراد</p>
          <span className="text-[11px] text-ink-faint">{faNum(users.length)} نفر</span>
          <button
            type="button"
            onClick={() => setSelected(allSelected ? new Set() : new Set(users.map((u) => u.id)))}
            className="mr-auto rounded-md border border-line px-2.5 py-1 text-[11.5px] text-ink-soft transition-colors hover:bg-paper-soft"
          >
            {allSelected ? "لغو انتخاب همه" : "انتخاب همه"}
          </button>
        </div>

        {/* ستون‌ها */}
        <div className="hidden grid-cols-[28px_minmax(140px,1.4fr)_1fr_0.8fr_1fr] items-center gap-3 border-b border-line bg-paper-soft/50 px-4 py-2 text-[11px] font-medium text-ink-faint md:grid">
          <span />
          <span>نام</span>
          <span>سمت / واحد</span>
          <span>شعبه</span>
          <span>اعلام زمان آزاد</span>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-12 w-full" />)}
          </div>
        ) : users.length === 0 ? (
          <EmptyState title="کاربری یافت نشد" description="فیلتر یا جستجو را عوض کنید" />
        ) : (
          <div className="divide-y divide-line">
            {users.map((u) => {
              const isMember = memberIds.has(u.id);
              const latest = latestByUser.get(u.id);
              const st = latest ? (STATUS_FA[latest.status] ?? STATUS_FA.PENDING) : null;
              const isSel = selected.has(u.id);
              return (
                <div
                  key={u.id}
                  className={cn(
                    "grid cursor-pointer grid-cols-[28px_1fr_auto] items-center gap-3 px-4 py-2.5 transition-colors md:grid-cols-[28px_minmax(140px,1.4fr)_1fr_0.8fr_1fr]",
                    isSel ? "bg-paper-soft" : "hover:bg-paper-soft/50",
                  )}
                  onClick={() => toggle(u.id)}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(u.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="size-4 accent-black"
                    aria-label={`انتخاب ${u.fullName}`}
                  />
                  <div className="flex min-w-0 items-center gap-2.5">
                    <UserAvatar name={u.fullName} src={u.avatarUrl} size="sm" variant="soft" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{u.fullName}</p>
                      <p className="truncate text-[10.5px] text-ink-faint md:hidden">
                        {[u.jobTitle, u.branch?.name].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                  <p className="hidden truncate text-[12px] text-ink-soft md:block">
                    {[u.jobTitle, u.department].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="hidden truncate text-[12px] text-ink-soft md:block">{u.branch?.name ?? "—"}</p>
                  <div className="flex items-center justify-end gap-1.5">
                    {isMember ? (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-medium text-emerald-700">
                        <Check className="h-3 w-3" />
                        مشمول
                      </span>
                    ) : (
                      <span className="rounded-full bg-paper-soft px-2 py-0.5 text-[10.5px] text-ink-faint">غیرمشمول</span>
                    )}
                    {st && <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-medium", st.cls)}>{st.label}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* نوار اکشن انتخاب */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-white px-4 py-2.5">
            <span className="rounded-full bg-paper-soft px-2.5 py-1 text-[11.5px] font-medium">
              {faNum(selected.size)} نفر انتخاب‌شده
            </span>
            <Button size="sm" onClick={() => applyMembers(false)} disabled={busy}>
              <Plus className="h-3.5 w-3.5" />
              مشمول اعلام زمان کن
            </Button>
            <Button size="sm" variant="ghost" onClick={() => applyMembers(true)} disabled={busy}>
              <UserX className="h-3.5 w-3.5" />
              خروج از فرآیند
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="mr-auto flex items-center gap-1 text-[11.5px] text-ink-faint hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
              لغو انتخاب
            </button>
          </div>
        )}
      </Card>

      {/* ── دوره‌های ثبت‌شده ── */}
      {requests.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <p className="text-[13px] font-bold">دوره‌های اعلام‌شده</p>
            <span className="text-[11px] text-ink-faint">{faNum(requests.length)} درخواست</span>
          </div>
          <div className="divide-y divide-line">
            {groupRequestsByPeriod(requests).map((g) => (
              <div key={`${g.start}__${g.end}`}>
                <div className="flex flex-wrap items-center gap-2 bg-paper-soft/60 px-4 py-2">
                  <CalendarDays className="h-3.5 w-3.5 text-ink-faint" />
                  <p className="text-[12px] font-bold">
                    {faDate(g.start)} تا {faDate(g.end)}
                  </p>
                  <span className="text-[10.5px] text-ink-faint">({faNum(g.items.length)} نفر)</span>
                  <span className="mr-auto flex items-center gap-1 text-[10.5px] text-ink-faint">
                    <Clock className="h-3 w-3" />
                    مهلت: {faDateTime(g.items[0].deadline)}
                  </span>
                </div>
                {g.items.map((r) => {
                  const st = STATUS_FA[r.status] ?? STATUS_FA.PENDING;
                  const mySlots = slotsByDay(r.slots ?? []);
                  return (
                    <div key={r.id} className="border-t border-line/60 px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[12.5px] font-medium">{r.user.fullName}</p>
                        {r.submittedBy && r.submittedBy.id !== r.user.id && (
                          <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink-soft">ثبت توسط {r.submittedBy.fullName}</span>
                        )}
                        <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-medium", st.cls)}>{st.label}</span>
                      </div>
                      {mySlots.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {mySlots.map(({ day, slots }) => (
                            <span key={day} className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1 text-[10.5px]">
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
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ───────── نوار تنظیم زمان‌بندی (فشرده) ───────── */
function ScheduleBar({ config, busy, onSave, memberCount }: {
  config: Config; busy: boolean; onSave: (cfg: Partial<Config>) => Promise<void>; memberCount: number;
}) {
  const [createDay, setCreateDay] = useState(String(config.createDay));
  const [periodKind, setPeriodKind] = useState(config.periodKind);
  const [deadlineDay, setDeadlineDay] = useState(String(config.deadlineDayOffset));
  const [deadlineTime, setDeadlineTime] = useState(`${String(Math.floor(config.deadlineMinutes / 60)).padStart(2, "0")}:${String(config.deadlineMinutes % 60).padStart(2, "0")}`);
  const [saving, setSaving] = useState(false);

  const deadlineDayOptions: SelectOption[] = [
    { value: "0", label: "همان روز", hint: "روزِ ایجاد درخواست" },
    { value: "1", label: "۱ روز بعد" },
    { value: "2", label: "۲ روز بعد" },
    { value: "3", label: "۳ روز بعد" },
    { value: "7", label: "۱ هفته بعد" },
  ];

  async function save() {
    const [h, m] = deadlineTime.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    setSaving(true);
    try {
      await onSave({
        cadence: "WEEKLY", createDay: Number(createDay), periodKind,
        deadlineDayOffset: Number(deadlineDay), deadlineMinutes: h * 60 + m, isActive: true,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CalendarClock className="h-4 w-4 text-ink-faint" />
        <p className="text-[13px] font-bold">زمان‌بندی اعلام زمان‌های آزاد</p>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-medium text-emerald-700">
          {faNum(memberCount)} نفر مشمول
        </span>
        <span className="text-[11px] leading-5 text-ink-faint">
          هر هفته در روزِ انتخاب‌شده، به‌صورت خودکار برای افراد مشمول درخواست ساخته می‌شود
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-[11px] text-ink-faint">
          روز ایجاد درخواست
          <div className="w-36"><Select value={createDay} onChange={setCreateDay} options={DAYS_FA.map((d, i) => ({ value: String(i), label: `هر ${d}` }))} /></div>
        </label>
        <label className="flex flex-col gap-1.5 text-[11px] text-ink-faint">
          افراد زمان‌های آزادِ چه بازه‌ای را اعلام کنند؟
          <div className="w-48"><Select value={periodKind} onChange={setPeriodKind} options={PERIOD_OPTIONS} /></div>
        </label>
        <label className="flex flex-col gap-1.5 text-[11px] text-ink-faint">
          مهلت ثبت
          <div className="w-40"><Select value={deadlineDay} onChange={setDeadlineDay} options={deadlineDayOptions} /></div>
        </label>
        <label className="flex flex-col gap-1.5 text-[11px] text-ink-faint">
          ساعت مهلت
          <div className="h-11"><TimePicker value={deadlineTime} onChange={setDeadlineTime} className="grid-cols-2 [&>div>button]:h-11" /></div>
        </label>
        <Button size="sm" onClick={save} disabled={busy || saving}>
          {saving ? "در حال ذخیره…" : "ذخیره"}
        </Button>
      </div>
    </Card>
  );
}

function groupRequestsByPeriod(requests: Req[]): { start: string; end: string; items: Req[] }[] {
  const map = new Map<string, { start: string; end: string; items: Req[] }>();
  for (const r of requests) {
    const start = r.periodStart.slice(0, 10);
    const end = r.periodEnd.slice(0, 10);
    const g = map.get(`${start}__${end}`) ?? { start, end, items: [] };
    g.items.push(r);
    map.set(`${start}__${end}`, g);
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
