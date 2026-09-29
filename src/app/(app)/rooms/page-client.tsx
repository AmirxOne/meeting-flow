"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Plus, Pencil, Trash2, Power, Wrench, Search, Menu as MoreVertical } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { cn, faNum, faStr, formatJalali, EQUIPMENT_FA, EQUIPMENT_LIST } from "@/lib";
import { FaInput } from "@/components/ui/fa-input";
import { useAuth } from "@/lib/auth-store";
import { JalaliDatePicker, TimePicker } from "@/components/ui/jalali-date-picker";
import { IconTipButton } from "@/components/ui/tooltip";
import { ContextMenuOpen, type ContextMenuItem } from "@/components/ui/context-menu";
import { EquipmentPicker, equipmentLabel } from "@/components/rooms/equipment-picker";
import { RoomFormModal } from "@/components/rooms/room-form-modal";

interface RoomWithLive {
  id: string;
  name: string;
  capacity: number;
  isVip: boolean;
  isActive: boolean;
  branchId: string;
  openTime: string | null;
  closeTime: string | null;
  branch: { id: string; name: string };
  floor: { id: string; name: string; number: number } | null;
  equipment: { equipment: string }[];
  manager: { id: string; fullName: string } | null;
  description: string | null;
}

interface RoomStatus {
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "DISABLED";
  current?: { id: string; title: string; endAt: string } | null;
  next?: { id: string; title: string; startAt: string } | null;
}

interface BranchOption {
  id: string;
  name: string;
  floors: { id: string; name: string; number: number }[];
}

interface RoomExclusion {
  id: string;
  reason: string;
  startAt: string;
  endAt: string;
}

const STATUS_META: Record<string, { label: string; dot: string; cls: string }> = {
  AVAILABLE: { label: "آزاد", dot: "bg-emerald-500", cls: "badge-green" },
  OCCUPIED: { label: "در جلسه", dot: "bg-red-500", cls: "badge-red" },
  RESERVED: { label: "رزرو شده", dot: "bg-amber-500", cls: "badge-amber" },
  DISABLED: { label: "غیرفعال", dot: "bg-zinc-400", cls: "badge-gray" },
};

export function RoomsPage() {
  const { can } = useAuth();
  const isAdmin = can("room:update");
  const qc = useQueryClient();
  const { push } = useToast();

  // همه اتاق‌ها — ادمین همه را می‌بیند (all=1 شامل غیرفعال‌ها)
  const { data, isLoading } = useQuery({
    queryKey: ["rooms", "unified"],
    queryFn: () => api<{ rooms: RoomWithLive[] }>(isAdmin ? "/api/rooms?all=1" : "/api/rooms"),
  });

  // وضعیت زنده‌ی هر اتاق
  const { data: statuses } = useQuery({
    queryKey: ["room-statuses"],
    queryFn: async () => {
      const rooms = await api<{ rooms: RoomWithLive[] }>("/api/rooms");
      const entries = await Promise.all(
        rooms.rooms.map(async (r) => {
          const s = await api<{ status: string; current: unknown; next: unknown }>(`/api/rooms/${r.id}`);
          return [r.id, s] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, RoomStatus>;
    },
    refetchInterval: 60_000,
  });


  // فیلترها
  const [branchFilter, setBranchFilter] = useState("");
  const [q, setQ] = useState("");

  // مودال ساخت/ویرایش — کامپوننت مشترک
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RoomWithLive | null>(null);

  // منوی راست‌کلیک / سه‌نقطه‌ی ردیف
  const [menu, setMenu] = useState<{ x: number; y: number; room: RoomWithLive } | null>(null);

  // مودال تعمیر/غیرفعال‌سازی موقت
  const [exclusionRoom, setExclusionRoom] = useState<RoomWithLive | null>(null);
  const [exForm, setExForm] = useState({ reason: "", startDate: "", startTime: "09:00", endDate: "", endTime: "12:00" });
  const [exBusy, setExBusy] = useState(false);
  const { data: exclusionsData, refetch: refetchExclusions } = useQuery({
    queryKey: ["room-exclusions", exclusionRoom?.id],
    queryFn: () => api<{ exclusions: RoomExclusion[] }>(`/api/rooms/${exclusionRoom!.id}/exclusions`),
    enabled: !!exclusionRoom,
  });

  const allRooms = data?.rooms ?? [];

  const visible = useMemo(() => {
    let list = allRooms;
    if (branchFilter) list = list.filter((r) => r.branchId === branchFilter);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((r) =>
        [r.name, r.branch?.name ?? "", r.floor?.name ?? "", r.manager?.fullName ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    }
    return list;
  }, [allRooms, branchFilter, q]);

  const branchOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of allRooms) if (r.branch) m.set(r.branch.id, r.branch.name);
    return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "fa"));
  }, [allRooms]);

  const counts = useMemo(() => {
    const c = { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, DISABLED: 0 } as Record<string, number>;
    for (const r of visible) c[statuses?.[r.id]?.status ?? (r.isActive ? "AVAILABLE" : "DISABLED")]++;
    return c;
  }, [visible, statuses]);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(r: RoomWithLive) {
    setEditing(r);
    setShowForm(true);
  }

  async function toggleActive(r: RoomWithLive) {
    try {
      await api(`/api/rooms/${r.id}/manage`, { method: "PATCH", json: { isActive: !r.isActive } });
      push(r.isActive ? "اتاق غیرفعال شد" : "اتاق فعال شد", "success");
      qc.invalidateQueries({ queryKey: ["rooms"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    }
  }

  async function remove(r: RoomWithLive) {
    if (!confirm(`حذف «${r.name}»؟`)) return;
    try {
      await api(`/api/rooms/${r.id}/manage`, { method: "DELETE" });
      push("اتاق حذف شد", "success");
      qc.invalidateQueries({ queryKey: ["rooms"] });
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "ROOM_IN_USE") {
        if (confirm(`${err.message}\n\nغیرفعالش کنیم؟ (جلسات فعلی حفظ می‌شوند ولی رزرو جدید ممکن نیست)`)) {
          await toggleActive({ ...r, isActive: true });
        }
      } else {
        push(err.message, "error");
      }
    }
  }

  function isoToday(): string {
    const t = new Date(Date.now() + 210 * 60000);
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
  }

  function openExclusions(r: RoomWithLive) {
    setExclusionRoom(r);
    setExForm({ reason: "", startDate: isoToday(), startTime: "09:00", endDate: isoToday(), endTime: "12:00" });
  }

  async function addExclusion() {
    if (!exclusionRoom) return;
    if (!exForm.reason.trim() || !exForm.startDate || !exForm.endDate || !exForm.startTime || !exForm.endTime) {
      push("همه فیلدها را پر کنید", "error");
      return;
    }
    setExBusy(true);
    try {
      const startAt = tehranInstant(exForm.startDate, exForm.startTime);
      const endAt = tehranInstant(exForm.endDate, exForm.endTime);
      await api(`/api/rooms/${exclusionRoom.id}/exclusions`, {
        method: "POST",
        json: { reason: exForm.reason.trim(), startAt: startAt.toISOString(), endAt: endAt.toISOString() },
      });
      push("غیرفعال‌سازی ثبت شد", "success");
      setExForm({ reason: "", startDate: isoToday(), startTime: "09:00", endDate: isoToday(), endTime: "12:00" });
      refetchExclusions();
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setExBusy(false);
    }
  }

  async function removeExclusion(ex: RoomExclusion) {
    if (!exclusionRoom) return;
    if (!confirm(`حذف «${ex.reason}»؟`)) return;
    setExBusy(true);
    try {
      await api(`/api/rooms/${exclusionRoom.id}/exclusions/${ex.id}`, { method: "DELETE" });
      push("غیرفعال‌سازی حذف شد", "success");
      refetchExclusions();
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setExBusy(false);
    }
  }

  function rowMenuItems(r: RoomWithLive): ContextMenuItem[] {
    return [
      { label: "ویرایش اتاق", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(r) },
      {
        label: r.isActive ? "غیرفعال‌سازی اتاق" : "فعال‌سازی اتاق",
        icon: <Power className="h-3.5 w-3.5" />,
        onClick: () => toggleActive(r),
      },
      {
        label: "تعمیر / غیرفعال موقت",
        icon: <Wrench className="h-3.5 w-3.5" />,
        onClick: () => openExclusions(r),
      },
      { label: "مشاهده جزئیات", icon: <DoorOpen className="h-3.5 w-3.5" />, onClick: () => { window.location.href = "/rooms/" + r.id; } },
      { label: "حذف اتاق", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, separatorBefore: true, onClick: () => remove(r) },
    ];
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* هدر: عنوان/توضیح — دکمه اتاق جدید (ادمین) */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">اتاق‌های جلسه</h1>
          <p className="mt-0.5 text-[12px] leading-6 text-ink-soft">
            وضعیت زنده‌ی اتاق‌ها و رزروها{isAdmin && " — ساخت، ویرایش و مدیریت اتاق‌ها همین‌جا"}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            اتاق جدید
          </Button>
        )}
      </div>

      {/* آمار وضعیت + فیلترها */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> {faNum(counts.AVAILABLE)} آزاد
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600">
          <span className="h-2 w-2 rounded-full bg-red-500" /> {faNum(counts.OCCUPIED)} در جلسه
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> {faNum(counts.RESERVED)} رزرو
        </span>
        {counts.DISABLED > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-zinc-400" /> {faNum(counts.DISABLED)} غیرفعال
          </span>
        )}

        <div className="mr-auto flex flex-wrap items-center gap-2">
          <div className="w-44">
            <Select
              value={branchFilter}
              onChange={(v) => setBranchFilter(v)}
              placeholder="همه شعبه‌ها"
              options={[{ value: "", label: "همه شعبه‌ها" }, ...branchOptions]}
            />
          </div>
          <div className="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-white px-3 sm:w-56">
            <Search className="h-4 w-4 shrink-0 text-ink-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              name="room-search"
              placeholder="جستجوی نام اتاق، شعبه…"
              className="w-full bg-transparent text-[12px] outline-none"
            />
            {q && (
              <button onClick={() => setQ("")} className="text-ink-faint hover:text-ink" aria-label="پاک کردن">
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* جدول */}
      {isLoading ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-3 w-14" />
            <div className="skeleton mr-auto h-9 w-56 rounded-md" />
          </div>
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[28px_minmax(140px,1.3fr)_1fr_0.7fr_1fr_0.9fr_1.2fr] items-center gap-3 px-4 py-3.5">
                <div className="skeleton mx-auto h-3 w-4" />
                <div className="space-y-1.5">
                  <div className="skeleton h-3.5 w-3/5" />
                  <div className="skeleton h-2.5 w-2/5" />
                </div>
                <div className="skeleton h-3 w-4/5" />
                <div className="skeleton h-3 w-2/3" />
                <div className="flex gap-1">
                  <div className="skeleton h-5 w-12 rounded-full" />
                  <div className="skeleton h-5 w-14 rounded-full" />
                </div>
                <div className="skeleton h-5 w-16 rounded-full" />
                {isAdmin && <div className="skeleton size-7 rounded-md" />}
              </div>
            ))}
          </div>
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<DoorOpen className="h-10 w-10" />}
            title={allRooms.length === 0 ? "اتاقی ثبت نشده است" : "اتاقی یافت نشد"}
            description={
              allRooms.length === 0
                ? isAdmin
                  ? "اولین اتاق جلسه را بسازید تا رزرو و زمان‌بندی آغاز شود"
                  : "اتاق‌ها توسط مدیر سیستم ثبت می‌شوند"
                : "فیلتر یا جستجو را عوض کنید"
            }
            action={
              allRooms.length === 0 && isAdmin ? (
                <Button size="sm" onClick={openCreate}>
                  ساخت اولین اتاق
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-[12px]">
              <thead className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center font-medium">ردیف</th>
                  <th className="px-4 py-2.5 font-medium">اتاق</th>
                  <th className="px-4 py-2.5 font-medium">شعبه / طبقه</th>
                  <th className="px-4 py-2.5 font-medium">ظرفیت</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">تجهیزات</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">ساعات کاری</th>
                  <th className="px-4 py-2.5 font-medium">وضعیت زنده</th>
                  {isAdmin && <th className="px-4 py-2.5"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((r, idx) => {
                  const st = statuses?.[r.id];
                  const meta = STATUS_META[st?.status ?? (r.isActive ? "AVAILABLE" : "DISABLED")];
                  return (
                    <tr
                      key={r.id}
                      className={cn("transition-colors hover:bg-paper-soft/40", !r.isActive && "opacity-50")}
                      onContextMenu={(e) => {
                        if (!isAdmin) return;
                        e.preventDefault();
                        setMenu({ x: e.clientX, y: e.clientY, room: r });
                      }}
                    >
                      <td className="px-3 py-3 text-center text-[11px] text-ink-faint">{faNum(idx + 1)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/rooms/${r.id}`} className="font-medium hover:underline">
                          {r.name}
                        </Link>
                        {r.isVip && <span className="badge badge-black mr-1.5">VIP</span>}
                        {!r.isActive && <span className="badge badge-gray mr-1.5">غیرفعال</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {r.branch?.name}
                        {r.floor ? ` · ${r.floor.name}` : ""}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{faNum(r.capacity)} نفر</td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {r.equipment.length === 0 ? (
                            <span className="text-ink-faint">—</span>
                          ) : (
                            r.equipment.slice(0, 3).map((e) => (
                              <span key={e.equipment} className="badge badge-gray">{equipmentLabel(e.equipment)}</span>
                            ))
                          )}
                          {r.equipment.length > 3 && (
                            <span className="badge badge-gray">+{faNum(r.equipment.length - 3)}</span>
                          )}
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-ink-soft lg:table-cell" dir="rtl">
                        {r.openTime ? `${faStr(r.openTime)}–${faStr(r.closeTime ?? "")}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className={cn("badge", meta.cls)}>
                            <span className={cn("ml-1 h-1.5 w-1.5 rounded-full", meta.dot)} />
                            {meta.label}
                          </span>
                          {st?.current && (
                            <span className="max-w-40 truncate text-[10.5px] text-ink-faint" title={st.current.title}>
                              تا {faStr(st.current.endAt.slice(11, 16))}: {st.current.title}
                            </span>
                          )}
                          {!st?.current && st?.next && (
                            <span className="max-w-40 truncate text-[10.5px] text-ink-faint" title={st.next.title}>
                              از {faStr(st.next.startAt.slice(11, 16))}: {st.next.title}
                            </span>
                          )}
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            aria-label={"گزینه‌های " + r.name}
                            title="گزینه‌ها (یا راست‌کلیک روی ردیف)"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenu({ x: Math.max(8, rect.left - 200), y: rect.bottom + 4, room: r });
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* منوی راست‌کلیک / سه‌نقطه‌ی ردیف */}
      {menu && isAdmin && (
        <ContextMenuOpen x={menu.x} y={menu.y} items={rowMenuItems(menu.room)} onClose={() => setMenu(null)} />
      )}

      {/* مودال ساخت/ویرایش اتاق — فقط ادمین */}
      {isAdmin && (
        <RoomFormModal open={showForm} onClose={() => setShowForm(false)} editing={editing} />
      )}

      {/* مودال تعمیر/غیرفعال‌سازی موقت — فقط ادمین */}
      {isAdmin && (
        <Modal
          open={!!exclusionRoom}
          onClose={() => setExclusionRoom(null)}
          title={exclusionRoom ? `تعمیر / غیرفعال — ${exclusionRoom.name}` : "غیرفعال‌سازی موقت"}
          subtitle="در بازه‌های ثبت‌شده رزرو جدید ممکن نیست"
          wide
          footer={
            <Button variant="ghost" onClick={() => setExclusionRoom(null)}>
              بستن
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] text-ink-soft">دلیل *</label>
                <input
                  placeholder="مثلاً تعمیرات، رزرو VIP، …"
                  value={exForm.reason}
                  onChange={(e) => setExForm({ ...exForm, reason: e.target.value })}
                  className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-ink-soft">شروع — تاریخ</label>
                <JalaliDatePicker value={exForm.startDate} onChange={(v) => setExForm({ ...exForm, startDate: v })} min={isoToday()} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-ink-soft">شروع — ساعت</label>
                <TimePicker value={exForm.startTime} onChange={(v) => setExForm({ ...exForm, startTime: v })} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-ink-soft">پایان — تاریخ</label>
                <JalaliDatePicker
                  value={exForm.endDate}
                  onChange={(v) => setExForm({ ...exForm, endDate: v })}
                  min={exForm.startDate || isoToday()}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-ink-soft">پایان — ساعت</label>
                <TimePicker value={exForm.endTime} onChange={(v) => setExForm({ ...exForm, endTime: v })} />
              </div>
              <div className="sm:col-span-2">
                <Button
                  onClick={addExclusion}
                  loading={exBusy}
                  disabled={!exForm.reason.trim() || !exForm.startDate || !exForm.endDate}
                >
                  ثبت غیرفعال‌سازی
                </Button>
              </div>
            </div>

            {(exclusionsData?.exclusions ?? []).length === 0 ? (
              <p className="py-4 text-center text-[12px] text-ink-faint">غیرفعال‌سازی آینده‌ای ثبت نشده</p>
            ) : (
              <div className="divide-y divide-line rounded-md border border-line">
                {(exclusionsData?.exclusions ?? []).map((ex) => (
                  <div key={ex.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-[13px] font-medium">{ex.reason}</p>
                      <p className="mt-0.5 text-[11px] text-ink-soft">
                        {formatJalali(new Date(ex.startAt), { withTime: true })} — {formatJalali(new Date(ex.endAt), { withTime: true })}
                      </p>
                    </div>
                    <IconTipButton
                      tip="حذف"
                      onClick={() => removeExclusion(ex)}
                      className="rounded-md p-2 text-ink-faint hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconTipButton>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function tehranInstant(isoDate: string, time: string): Date {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - 210 * 60000);
}
