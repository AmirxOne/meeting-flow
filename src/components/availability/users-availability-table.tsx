"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScheduleModal, type MemberOverrideValue } from "./schedule-modal";
import { useUserManagement } from "@/components/users/user-management";
import { ContextMenuOpen, type ContextMenuItem } from "@/components/ui/context-menu";
import { useToast } from "@/components/ui/toast";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn, faNum } from "@/lib";
import { CalendarDays, Check, ChevronDown, Clock, KeyRound, Menu as MoreVertical, Pencil, Power, Settings2, UserPlus, UserX } from "@/components/ui/icon";
import type { Colleague } from "@/lib/colleague-directory";

/**
 * جدول «کاربران + اعلام زمان‌های آزاد» برای ادمین:
 * ستون آخر هر ردیف آیکون تنظیم فردی (مودال)؛ انتخاب چند نفر → دکمه‌ی تنظیم گروهی؛
 * دوره‌های ثبت‌شده داخل همان جدول با ردیف بازشو.
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
interface Member {
  id: string;
  createDay: number | null; periodKind: string | null;
  deadlineDayOffset: number | null; deadlineMinutes: number | null;
  user: { id: string; fullName: string; email: string };
}

const STATUS_FA: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "در انتظار ثبت", cls: "bg-amber-50 text-amber-700" },
  SUBMITTED: { label: "ثبت شده", cls: "bg-emerald-50 text-emerald-700" },
  OVERDUE: { label: "مهلت گذشته", cls: "bg-red-50 text-red-600" },
  CLOSED: { label: "بسته", cls: "bg-paper-soft text-ink-faint" },
};

const DAYS_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];


function faDate(iso: string): string {
  return new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("fa-IR", { month: "long", day: "numeric" });
}
function faDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", { month: "long", day: "numeric" }) + "، " +
    new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}
function dayShortFa(dateIso: string): string {
  const wd = new Date(dateIso + "T12:00:00Z").getUTCDay();
  return `${DAYS_FA[(wd + 1) % 7]} ${faDate(dateIso)}`;
}

export function UsersAvailabilityTable({ users, isLoading }: { users: Colleague[]; isLoading: boolean }) {
  const qc = useQueryClient();
  const { push } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null); // userId ردیف باز
  const [modal, setModal] = useState<{ userIds: string[] } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; user: Colleague } | null>(null);
  const um = useUserManagement();

  /** آیتم‌های منوی راست‌کلیک / سه‌نقطه هر ردیف */
  function rowMenuItems(u: Colleague, isMember: boolean, hasPeriods: boolean): ContextMenuItem[] {
    const self = um.isSelf(u.id);
    const items: ContextMenuItem[] = [];
    if (um.canEdit && !self) {
      items.push(
        { label: "ویرایش اطلاعات", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => um.openEdit(u) },
        { label: "بازنشانی رمز عبور", icon: <KeyRound className="h-3.5 w-3.5" />, onClick: () => um.openReset(u), disabled: !um.canReset },
        {
          label: u.isActive !== false ? "غیرفعال‌سازی حساب" : "فعال‌سازی حساب",
          icon: <Power className="h-3.5 w-3.5" />,
          onClick: () => um.toggleActive(u),
          danger: u.isActive !== false,
        },
      );
    }
    items.push(
      {
        label: isMember ? "تنظیم زمان‌بندی اعلام زمان" : "مشمول کردن با تنظیم دلخواه",
        icon: <Settings2 className="h-3.5 w-3.5" />,
        onClick: () => setModal({ userIds: [u.id] }),
        separatorBefore: items.length > 0,
      },
      {
        label: hasPeriods ? (expanded === u.id ? "بستن دوره‌های اعلام‌شده" : "نمایش دوره‌های اعلام‌شده") : "دوره‌ای ثبت نشده",
        icon: <CalendarDays className="h-3.5 w-3.5" />,
        disabled: !hasPeriods,
        onClick: () => setExpanded(expanded === u.id ? null : u.id),
      },
    );
    return items;
  }

  const { data, isLoading: cfgLoading } = useQuery({
    queryKey: ["availability-admin"],
    queryFn: () => api<{ config: Config; requests: Req[]; members: Member[] }>(`/api/availability-mgmt?scope=org`),
    retry: false,
  });

  const memberById = useMemo(() => new Map((data?.members ?? []).map((m) => [m.user.id, m])), [data]);
  const memberIds = useMemo(() => new Set(memberById.keys()), [memberById]);
  const requests = data?.requests ?? [];
  const config = data?.config;

  // همه‌ی درخواست‌های هر کاربر (برای ردیف بازشو)
  const requestsByUser = useMemo(() => {
    const map = new Map<string, Req[]>();
    for (const r of requests) {
      map.set(r.user.id, [...(map.get(r.user.id) ?? []), r]);
    }
    return map;
  }, [requests]);

  // آخرین وضعیت هر کاربر (ستون وضعیت)
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
  const orgDefaults = {
    createDay: config?.createDay ?? 3,
    periodKind: config?.periodKind ?? "NEXT_WEEK",
    deadlineDayOffset: config?.deadlineDayOffset ?? 1,
    deadlineMinutes: config?.deadlineMinutes ?? 900,
  };

  async function removeMembers() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await api("/api/availability-mgmt", {
        method: "POST",
        json: { userIds: [...selected], remove: true },
      });
      push("از فرآیند خارج شدند", "success");
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["availability-admin"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule(userIds: string[], v: MemberOverrideValue) {
    setBusy(true);
    try {
      const res = await api<{ changed: number }>("/api/availability-mgmt", {
        method: "POST",
        json: { userIds, remove: false, override: v },
      });
      if (res?.changed === 0) {
        push("هیچ‌کس مشمول نشد — حساب کاربران غیرفعال است", "error");
      } else {
        push(`${faNum(userIds.length)} نفر با زمان‌بندی انتخابی مشمول شدند`, "success");
      }
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["availability-admin"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  function memberOverrideOf(userId: string): MemberOverrideValue | null {
    const m = memberById.get(userId);
    if (!m) return null;
    if (m.createDay === null && m.periodKind === null && m.deadlineDayOffset === null && m.deadlineMinutes === null) return null;
    return {
      createDay: m.createDay, periodKind: m.periodKind,
      deadlineDayOffset: m.deadlineDayOffset, deadlineMinutes: m.deadlineMinutes,
    };
  }

  return (
    <div className="space-y-4">
      {/* ── جدول کاربران + دوره‌های ادغام‌شده ── */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <p className="text-[13px] font-bold">افراد</p>
          <span className="text-[11px] text-ink-faint">{faNum(users.length)} نفر</span>
          <button
            type="button"
            onClick={() => setSelected(allSelected ? new Set() : new Set(users.map((u) => u.id)))}
            className="rounded-md border border-line px-2.5 py-1 text-[11.5px] text-ink-soft transition-colors hover:bg-paper-soft"
          >
            {allSelected ? "لغو انتخاب همه" : "انتخاب همه"}
          </button>

          {/* اکشن‌های انتخاب — داخل هدر جدول، فقط وقتی کسی انتخاب شده */}
          {selected.size > 0 && (
            <div className="mr-auto flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-paper-soft px-2.5 py-1 text-[11.5px] font-medium">
                {faNum(selected.size)} نفر انتخاب‌شده
              </span>
              {selected.size > 1 && (
                <Button size="sm" onClick={() => setModal({ userIds: [...selected] })} disabled={busy}>
                  <Settings2 className="h-3.5 w-3.5" />
                  تنظیم گروهی زمان‌بندی
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={removeMembers} disabled={busy}>
                <UserX className="h-3.5 w-3.5" />
                خروج از فرآیند
              </Button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-[11.5px] text-ink-faint hover:text-ink"
              >
                لغو انتخاب
              </button>
            </div>
          )}
        </div>

        <div className="hidden grid-cols-[28px_28px_minmax(140px,1.4fr)_1fr_0.8fr_1fr_196px] items-center gap-3 border-b border-line bg-paper-soft/50 px-4 py-2 text-[11px] font-medium text-ink-faint md:grid">
          <span />
          <span className="text-center">ردیف</span>
          <span>نام</span>
          <span>سمت / واحد</span>
          <span>شعبه</span>
          <span>اعلام زمان آزاد</span>
          <span />
        </div>

        {isLoading || cfgLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-12 w-full" />)}
          </div>
        ) : users.length === 0 ? (
          <EmptyState title="کاربری یافت نشد" description="فیلتر یا جستجو را عوض کنید" />
        ) : (
          <div className="divide-y divide-line">
            {users.map((u, rowIdx) => {
              const member = memberById.get(u.id);
              const isMember = memberIds.has(u.id);
              const latest = latestByUser.get(u.id);
              const st = latest ? (STATUS_FA[latest.status] ?? STATUS_FA.PENDING) : null;
              const isSel = selected.has(u.id);
              const isOpen = expanded === u.id;
              const myReqs = requestsByUser.get(u.id) ?? [];
              const hasCustom = member && (member.createDay !== null || member.periodKind !== null);
              return (
                <div key={u.id} className={cn(isOpen && "bg-paper-soft/30")}>
                  <div
                    className={cn(
                      "grid cursor-pointer grid-cols-[28px_1fr_auto_84px] items-center gap-3 px-4 py-2.5 transition-colors md:grid-cols-[28px_28px_minmax(140px,1.4fr)_1fr_0.8fr_1fr_196px]",
                      isSel ? "bg-paper-soft" : "hover:bg-paper-soft/50",
                    )}
                    onClick={() => toggle(u.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ x: e.clientX, y: e.clientY, user: u });
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(u.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="size-4 accent-black"
                      aria-label={`انتخاب ${u.fullName}`}
                    />
                    <span className="text-center text-[11px] text-ink-faint md:block">{faNum(rowIdx + 1)}</span>
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
                    <div className="flex flex-wrap items-center justify-start gap-1.5">
                      {u.isActive === false ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10.5px] font-medium text-red-500">حساب غیرفعال</span>
                      ) : isMember ? (
                        <>
                          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-medium text-emerald-700">
                            <Check className="h-3 w-3" />
                            مشمول
                          </span>
                          {hasCustom && (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-medium text-sky-700">زمان‌بندی خاص</span>
                          )}
                        </>
                      ) : (
                        <span className="rounded-full bg-paper-soft px-2 py-0.5 text-[10.5px] text-ink-faint">غیرمشمول</span>
                      )}
                      {st && <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-medium", st.cls)}>{st.label}</span>}
                    </div>
                    {/* ستون آخر: یک دکمه‌ی سه‌نقطه (منوی کامل) + chevron دوره‌ها */}
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={"گزینه‌های " + u.fullName}
                        title="گزینه‌ها (یا راست‌کلیک روی ردیف)"
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setMenu({ x: Math.max(8, r.left - 200), y: r.bottom + 4, user: u });
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {myReqs.length > 0 && (
                        <button
                          type="button"
                          aria-label={isOpen ? "بستن دوره‌ها" : "نمایش دوره‌ها"}
                          aria-expanded={isOpen}
                          onClick={() => setExpanded(isOpen ? null : u.id)}
                          className={cn("flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-faint transition-all hover:bg-paper-soft", isOpen && "rotate-180 bg-paper-soft text-ink")}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ردیف بازشو: دوره‌های اعلام‌شده‌ی همین فرد */}
                  {isOpen && (
                    <div className="border-t border-line/60 bg-paper-soft/20 px-4 py-3">
                      {myReqs.length === 0 ? (
                        <p className="text-[12px] text-ink-faint">هنوز درخواستی برای این فرد ساخته نشده</p>
                      ) : (
                        <div className="space-y-2.5">
                          {myReqs.map((r) => {
                            const rst = STATUS_FA[r.status] ?? STATUS_FA.PENDING;
                            const days = slotsByDay(r.slots ?? []);
                            return (
                              <div key={r.id} className="rounded-xl border border-line bg-white p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <CalendarDays className="h-3.5 w-3.5 text-ink-faint" />
                                  <p className="text-[12px] font-bold">{faDate(r.periodStart.slice(0, 10))} تا {faDate(r.periodEnd.slice(0, 10))}</p>
                                  <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-medium", rst.cls)}>{rst.label}</span>
                                  <span className="flex items-center gap-1 text-[10.5px] text-ink-faint">
                                    <Clock className="h-3 w-3" />
                                    مهلت: {faDateTime(r.deadline)}
                                  </span>
                                  {r.submittedAt && (
                                    <span className="text-[10.5px] text-ink-faint">
                                      ثبت: {faDateTime(r.submittedAt)} توسط {r.submittedBy?.fullName ?? r.user.fullName}
                                    </span>
                                  )}
                                </div>
                                {days.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {days.map(({ day, slots }) => (
                                      <span key={day} className="flex items-center gap-1.5 rounded-lg border border-line bg-paper-soft/40 px-2 py-1 text-[10.5px]">
                                        <span className="font-medium text-ink">{dayShortFa(day)}</span>
                                        <span dir="ltr" className="tabular-nums text-ink-soft">
                                          {slots.map((s) => `${s.startTime}-${s.endTime}`).join(" · ")}
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-1.5 text-[11px] text-ink-faint">هنوز زمانی ثبت نشده</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}


      </Card>

      {/* منوی راست‌کلیک / سه‌نقطه‌ی ردیف */}
      {menu && (
        <ContextMenuOpen
          x={menu.x}
          y={menu.y}
          items={rowMenuItems(
            menu.user,
            memberIds.has(menu.user.id),
            (requestsByUser.get(menu.user.id) ?? []).length > 0,
          )}
          onClose={() => setMenu(null)}
        />
      )}

      {/* مودال‌های مدیریت کاربر (ساخت/ویرایش/بازنشانی رمز) */}
      {um.modals}

      {/* مودال تنظیم فردی/گروهی */}
      {modal && config && (
        <ScheduleModal
          open
          onClose={() => setModal(null)}
          targetNames={modal.userIds.map((id) => users.find((u) => u.id === id)?.fullName ?? "").filter(Boolean)}
          orgDefaults={orgDefaults}
          memberCount={memberIds.size}
          current={modal.userIds.length === 1 ? memberOverrideOf(modal.userIds[0]) : null}
          busy={busy}
          onSave={async (v) => { await saveSchedule(modal.userIds, v); }}
        />
      )}
    </div>
  );
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
