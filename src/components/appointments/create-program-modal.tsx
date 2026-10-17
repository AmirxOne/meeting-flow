"use client";

/** فرم ایجاد برنامه‌ی نوبت‌دهی — مودال */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib";
import { X } from "@/components/ui/icon";
import { PeoplePicker, type PickedPerson } from "@/components/ui/people-picker";
import { TimePicker } from "@/components/ui/jalali-date-picker";
import { createPortal } from "react-dom";
import { faNum } from "@/lib";

interface WindowRow { daysOfWeek: number[]; from: string; to: string }

export interface ProgramLite {
  id: string;
  title: string;
  description: string | null;
  topics: { title: string }[] | null;
  durationMin: number;
  bufferMin?: number;
  isConfidential: boolean;
  audienceType?: string;
  audienceIds?: string[];
  roomIds?: string[];
  roomCount?: number;
  windows?: WindowRow[];
  validTo?: string;
}

const WEEKDAYS_FA = [
  { v: 6, l: "شنبه" }, { v: 0, l: "یکشنبه" }, { v: 1, l: "دوشنبه" },
  { v: 2, l: "سه‌شنبه" }, { v: 3, l: "چهارشنبه" }, { v: 4, l: "پنجشنبه" }, { v: 5, l: "جمعه" },
];

export function CreateProgramModal({ editProgram, onClose, onCreated }: { editProgram?: ProgramLite; onClose: () => void; onCreated: () => void }) {
  const { push } = useToast();
  const isEdit = !!editProgram;
  const [title, setTitle] = useState(editProgram?.title ?? "");
  const [description, setDescription] = useState(editProgram?.description ?? "");
  const [topicsText, setTopicsText] = useState((editProgram?.topics ?? []).map((t) => t.title).join(String.fromCharCode(10)));
  const [durationMin, setDurationMin] = useState(editProgram?.durationMin ?? 30);
  const [bufferMin, setBufferMin] = useState(editProgram?.bufferMin ?? 0);
  const [isConfidential, setIsConfidential] = useState(editProgram?.isConfidential ?? false);
  const [audienceType, setAudienceType] = useState<"ALL" | "BRANCH" | "USERS">((editProgram?.audienceType as "ALL") ?? "ALL");
  const [pickedPeople, setPickedPeople] = useState<PickedPerson[]>([]);
  const [windows, setWindows] = useState<WindowRow[]>(editProgram?.windows?.length ? editProgram.windows : [{ daysOfWeek: [6], from: "09:00", to: "12:00" }]);
  const [roomIds, setRoomIds] = useState<string[]>(editProgram?.roomIds ?? []);
  const [busy, setBusy] = useState(false);

  const { data: roomsData } = useQuery({
    queryKey: ["rooms-for-appointment"],
    queryFn: () => api<{ rooms: { id: string; name: string; isActive: boolean }[] }>("/api/rooms"),
  });
  const activeRooms = (roomsData?.rooms ?? []).filter((r) => r.isActive);

  // ── پیش‌نمایش زنده: ساعات خالی من + اتاق‌های خالی (وقتی اتاق انتخاب شده) ──
  const { data: previewData, isFetching: previewLoading } = useQuery({
    queryKey: ["appointment-preview", roomIds.join(",")],
    queryFn: () => api<{ days: { date: string; weekday: number; hostFree: { from: string; to: string }[]; roomFree: Record<string, { from: string; to: string; freeRooms: number }[]> }[] }>(
      "/api/appointments/preview",
      { method: "POST", json: { roomIds, daysAhead: 14 } },
    ),
    enabled: roomIds.length > 0,
    staleTime: 60_000,
  });
  const previewDays = previewData?.days ?? [];

  async function submit() {
    if (!title.trim()) { push("عنوان لازم است", "error"); return; }
    if (roomIds.length === 0) { push("حداقل یک اتاق انتخاب کنید", "error"); return; }
    setBusy(true);
    try {
      const topics = topicsText.split("\n").map((t) => t.trim()).filter(Boolean).map((t) => ({ title: t }));
      const validTo = editProgram?.validTo
        ? new Date(editProgram.validTo).toISOString()
        : new Date(Date.now() + 30 * 86400000).toISOString();
      if (isEdit) {
        await api(`/api/appointments/programs/${editProgram.id}`, {
          method: "PATCH",
          json: {
            title,
            description: description || null,
            topics: topics.length ? topics : undefined,
            audienceType,
            audienceIds: audienceType === "USERS" ? pickedPeople.filter((x) => x.kind === "INTERNAL" && x.userId).map((x) => x.userId as string) : editProgram?.audienceIds ?? [],
            roomIds,
            durationMin,
            bufferMin,
            windows: windows.filter((w) => w.daysOfWeek.length > 0),
            validTo,
            isConfidential,
          },
        });
        push("برنامه به‌روزرسانی شد", "success");
        onCreated();
        return;
      }
      await api("/api/appointments/programs", {
        method: "POST",
        json: {
          title,
          description: description || undefined,
          topics: topics.length ? topics : undefined,
          audienceType,
          audienceIds: audienceType === "USERS"
            ? pickedPeople.filter((p) => p.kind === "INTERNAL" && p.userId).map((p) => p.userId as string)
            : [],
          roomIds,
          durationMin,
          bufferMin,
          windows: windows.filter((w) => w.daysOfWeek.length > 0),
          validFrom: new Date().toISOString(),
          validTo,
          isConfidential,
          status: "ACTIVE",
        },
      });
      push("برنامه‌ی نوبت‌دهی منتشر شد", "success");
      onCreated();
    } catch (e) {
      push((e as ApiError).message || "ایجاد برنامه ناموفق بود", "error");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "h-10 w-full rounded-md border border-line px-3 text-[12.5px] outline-none focus:border-ink";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-2" onClick={onClose}>
      <div className="flex max-h-[94dvh] w-full flex-col rounded-t-xl bg-white shadow-2xl sm:max-h-[92vh] sm:max-w-xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[14px] font-bold">{isEdit ? "ویرایش برنامه‌ی نوبت‌دهی" : "ایجاد برنامه‌ی نوبت‌دهی"}</h2>
            <p className="mt-0.5 text-[11px] text-ink-soft">زمان‌های پیشنهادی شما برای جلسات با کارکنان</p>
          </div>
          <button onClick={onClose} aria-label="بستن" className="rounded-md p-1.5 text-ink-faint hover:bg-paper-soft hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">عنوان برنامه</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: جلسات مشاوره روان‌شناسی کارکنان" className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">مدت هر جلسه (دقیقه)</label>
              <FaNumberInput value={durationMin} onChange={setDurationMin} min={10} max={240} step={5} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">فاصله (دقیقه)</label>
              <FaNumberInput value={bufferMin} onChange={setBufferMin} min={0} max={60} step={5} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">محرمانه</label>
              <label className="flex h-10 items-center gap-2 text-[12px]">
                <input type="checkbox" checked={isConfidential} onChange={(e) => setIsConfidential(e.target.checked)} className="size-4 accent-black" />
                جلسه‌ی محرمانه
              </label>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">توضیحات عمومی (اختیاری)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="هدف جلسه برای کارکنان…" className="min-h-[70px] w-full rounded-md border border-line p-2.5 text-[12px] leading-6 outline-none focus:border-ink" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">موضوعات (هر خط یک موضوع)</label>
            <textarea value={topicsText} onChange={(e) => setTopicsText(e.target.value)} placeholder={"بررسی استرس کاری\nتعادل کار و زندگی"} className="min-h-[70px] w-full rounded-md border border-line p-2.5 text-[12px] leading-6 outline-none focus:border-ink" />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-soft">روزها و ساعت‌های در دسترس</label>
            <div className="space-y-2">
              {windows.map((w, i) => (
                <div key={i} className="rounded-lg border border-line bg-paper-soft/40 p-2.5">
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAYS_FA.map((d) => (
                      <button
                        key={d.v}
                        type="button"
                        onClick={() => setWindows((ws) => ws.map((x, j) => j === i ? { ...x, daysOfWeek: x.daysOfWeek.includes(d.v) ? x.daysOfWeek.filter((v) => v !== d.v) : [...x.daysOfWeek, d.v] } : x))}
                        className={cn(
                          "rounded-md border px-2 py-1 text-[10.5px] font-medium transition-colors",
                          w.daysOfWeek.includes(d.v) ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft",
                        )}
                      >
                        {d.l}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <TimePicker
                        value={w.from}
                        onChange={(v) => setWindows((ws) => ws.map((x, j) => j === i ? { ...x, from: v } : x))}
                        className="gap-1.5 [&_button]:h-9 [&_button]:px-2 [&_button]:text-[12px]"
                      />
                    </div>
                    <span className="shrink-0 text-[11px] text-ink-faint">تا</span>
                    <div className="min-w-0 flex-1">
                      <TimePicker
                        value={w.to}
                        onChange={(v) => setWindows((ws) => ws.map((x, j) => j === i ? { ...x, to: v } : x))}
                        className="gap-1.5 [&_button]:h-9 [&_button]:px-2 [&_button]:text-[12px]"
                      />
                    </div>
                    {windows.length > 1 && (
                      <button type="button" aria-label="حذف بازه" onClick={() => setWindows((ws) => ws.filter((_, j) => j !== i))} className="text-ink-faint transition hover:text-red-600">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setWindows((ws) => [...ws, { daysOfWeek: [6], from: "14:00", to: "17:00" }])} className="mt-2 flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft transition hover:border-ink/40 hover:text-ink">
              افزودن بازه‌ی دیگر
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-soft">اتاق‌های مجاز</label>
            <div className="flex flex-wrap gap-1.5">
              {activeRooms.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoomIds((ids) => ids.includes(r.id) ? ids.filter((x) => x !== r.id) : [...ids, r.id])}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors",
                    roomIds.includes(r.id) ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:border-ink/40",
                  )}
                >
                  {r.name}
                </button>
              ))}
              {activeRooms.length === 0 && <p className="text-[11px] text-ink-faint">اتاق فعالی موجود نیست</p>}
            </div>
          </div>

          {/* پیش‌نمایش زنده — ساعات خالی من و اتاق‌ها */}
          {roomIds.length > 0 && (
            <div className="rounded-lg border border-line bg-paper-soft/40 p-3">
              <p className="text-[11.5px] font-bold">
                پیش‌نمایش آزادی (۱۴ روز آینده)
                {previewLoading && <span className="mr-2 text-[10px] font-normal text-ink-faint">در حال بررسی…</span>}
              </p>
              <p className="mt-0.5 text-[10.5px] leading-5 text-ink-faint">
                بازه‌های سبز = شما آزاد هستید و حداقل یک اتاقِ انتخابی خالی است. هنگام انتخاب بازه‌ها از این راهنما استفاده کنید.
              </p>
              <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                {previewDays
                  .filter((d) => d.hostFree.length > 0)
                  .slice(0, 10)
                  .map((d) => {
                    const roomSlots = d.roomFree[d.date] ?? [];
                    const both = d.hostFree.filter((hf) =>
                      roomSlots.some((rs) => new Date(hf.from) >= new Date(rs.from) && new Date(hf.to) <= new Date(rs.to)),
                    );
                    return (
                      <div key={d.date} className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                        <span className="font-bold">
                          {new Date(d.date + "T12:00:00").toLocaleDateString("fa-IR", { weekday: "long", day: "numeric", month: "short" })}:
                        </span>
                        {both.length === 0 ? (
                          <span className="text-ink-faint">ساعت مشترک آزاد نیست</span>
                        ) : (
                          both.slice(0, 4).map((b, i) => (
                            <span key={i} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium tabular-nums text-emerald-800" dir="ltr">
                              {new Date(b.from).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}–{new Date(b.to).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          ))
                        )}
                      </div>
                    );
                  })}
                {!previewLoading && previewDays.filter((d) => d.hostFree.length > 0).length === 0 && (
                  <p className="text-[10.5px] text-ink-faint">در ۱۴ روز آینده ساعت آزادی ندارید</p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">مخاطبان</label>
            <div className="flex gap-1.5">
              {[
                { v: "ALL", l: "همه‌ی کارکنان" },
                { v: "BRANCH", l: "شعبه‌های خاص" },
                { v: "USERS", l: "افراد خاص" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setAudienceType(o.v as "ALL")}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-2 text-[11.5px] font-medium transition-colors",
                    audienceType === o.v ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:border-ink/40",
                  )}
                >
                  {o.l}
                </button>
              ))}
            </div>
            {audienceType === "USERS" && (
              <div className="mt-2">
                <PeoplePicker
                  value={pickedPeople}
                  onChange={setPickedPeople}
                  allowManual={false}
                  placeholder="جستجو و تیک‌زدن افراد مجاز…"
                />
                {pickedPeople.length > 0 && (
                  <p className="mt-1 text-[10.5px] text-ink-faint">{faNum(pickedPeople.filter((x) => x.kind === "INTERNAL").length)} نفر از کارکنان انتخاب شد</p>
                )}
              </div>
            )}
            {audienceType === "BRANCH" && (
              <p className="mt-1 text-[10.5px] text-ink-faint">انتخاب شعبه‌ها از پنل مدیریت انجام می‌شود.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          <Button variant="ghost" onClick={onClose} disabled={busy}>انصراف</Button>
          <Button onClick={submit} loading={busy}>{isEdit ? "ذخیره‌ی تغییرات" : "انتشار برنامه"}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}


/* ═══ ورودی عددی فارسی با دکمه‌های +/- (به‌جای input number لاتین) ═══ */

const FA_D = "۰۱۲۳۴۵۶۷۸۹";
function toFa(n: number): string {
  return String(n).replace(/\d/g, (d) => FA_D[Number(d)]);
}
function faToNum(s: string): number {
  const latin = s.replace(/[۰-۹]/g, (d) => String(FA_D.indexOf(d))).replace(/[^0-9]/g, "");
  return latin === "" ? NaN : Number(latin);
}

function FaNumberInput({ value, onChange, min = 0, max = 9999, step = 1, className = "" }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; className?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
  return (
    <div className={cn("flex h-10 w-full items-center rounded-md border border-line bg-white focus-within:border-ink", className)}>
      <button
        type="button"
        aria-label="افزایش"
        onClick={() => onChange(clamp(value + step))}
        className="flex h-full w-8 shrink-0 items-center justify-center border-l border-line text-[14px] font-bold text-ink-soft transition hover:bg-paper-soft hover:text-ink"
      >
        +
      </button>
      <input
        inputMode="numeric"
        value={toFa(value)}
        onChange={(e) => {
          const n = faToNum(e.target.value);
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
        className="h-full min-w-0 flex-1 bg-transparent text-center text-[12.5px] font-medium tabular-nums outline-none"
      />
      <button
        type="button"
        aria-label="کاهش"
        onClick={() => onChange(clamp(value - step))}
        className="flex h-full w-8 shrink-0 items-center justify-center border-r border-line text-[14px] font-bold text-ink-soft transition hover:bg-paper-soft hover:text-ink"
      >
        −
      </button>
    </div>
  );
}
