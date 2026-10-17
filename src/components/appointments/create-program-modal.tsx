"use client";

/** فرم ایجاد برنامه‌ی نوبت‌دهی — مودال */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib";
import { X, Plus, Minus } from "@/components/ui/icon";
import { PeoplePicker, type PickedPerson } from "@/components/ui/people-picker";
import { TimePicker, JalaliDatePicker } from "@/components/ui/jalali-date-picker";
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
  validFrom?: string;
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
  const [topics, setTopics] = useState<string[]>((editProgram?.topics ?? []).map((t) => t.title));
  const [topicDraft, setTopicDraft] = useState("");
  const addTopic = () => {
    const t = topicDraft.trim();
    if (!t || topics.includes(t) || topics.length >= 10) return;
    setTopics((prev) => [...prev, t]);
    setTopicDraft("");
  };
  const removeTopic = (t: string) => setTopics((prev) => prev.filter((x) => x !== t));
  const [durationMin, setDurationMin] = useState(editProgram?.durationMin ?? 30);
  const [bufferMin, setBufferMin] = useState(editProgram?.bufferMin ?? 0);
  const [isConfidential, setIsConfidential] = useState(editProgram?.isConfidential ?? false);
  const [audienceType, setAudienceType] = useState<"ALL" | "BRANCH" | "USERS">((editProgram?.audienceType as "ALL") ?? "ALL");
  const [pickedPeople, setPickedPeople] = useState<PickedPerson[]>([]);
  // روز فعال → بازه‌های ساعتی آن روز (چند بازه در روز)
  // مدت اعتبار: یک روز خاص یا بازه — تاریخ شمسی انتخاب می‌شود
  const todayIso = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 10); })();
  const [durationMode, setDurationMode] = useState<"range" | "single">("range");
  const [validFromIso, setValidFromIso] = useState<string>(
    editProgram?.validFrom ? new Date(editProgram.validFrom).toISOString().slice(0, 10) : todayIso,
  );
  const [validToIso, setValidToIso] = useState<string>(
    editProgram?.validTo ? new Date(editProgram.validTo).toISOString().slice(0, 10) : (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); })(),
  );
  const [singleDayIso, setSingleDayIso] = useState<string>(todayIso);

  /** روزهای هفته‌ای که در بازه‌ی اعتبار واقعاً وجود دارند (یا فقط همان روز خاص) */
  const allowedDays = useMemo(() => {
    const set = new Set<number>();
    const from = new Date((durationMode === "single" ? singleDayIso : validFromIso) + "T12:00:00Z");
    const to = new Date((durationMode === "single" ? singleDayIso : validToIso) + "T12:00:00Z");
    // بیش از ~۳ ماه روز شمردن لازم نیست
    for (let d = new Date(from); d <= to && set.size < 7; d.setUTCDate(d.getUTCDate() + 1)) {
      set.add(d.getUTCDay());
    }
    return set;
  }, [durationMode, singleDayIso, validFromIso, validToIso]);

  /** حالت تک‌روز: همان روز به‌صورت خودکار فعال است */
  useEffect(() => {
    if (durationMode !== "single") return;
    const wd = new Date(singleDayIso + "T12:00:00Z").getUTCDay();
    setDayRanges((prev) => {
      const others = { ...prev };
      delete others[wd];
      return { [wd]: prev[wd]?.length ? prev[wd] : [{ from: "09:00", to: "12:00" }], ...others };
    });
  }, [durationMode, singleDayIso]); // eslint-disable-line react-hooks/exhaustive-deps

  /** روزهای فعالِ خارج از بازه → خودکار خاموش شوند */
  useEffect(() => {
    setDayRanges((prev) => {
      const stale = Object.keys(prev).filter((d) => !allowedDays.has(Number(d)));
      if (stale.length === 0) return prev;
      const next = { ...prev };
      for (const d of stale) delete next[Number(d)];
      return next;
    });
  }, [allowedDays]);

  const [dayRanges, setDayRanges] = useState<Record<number, { from: string; to: string }[]>>(
    (() => {
      const init: Record<number, { from: string; to: string }[]> = {};
      if (editProgram?.windows?.length) {
        for (const w of editProgram.windows) {
          for (const d of w.daysOfWeek) init[d] = [...(init[d] ?? []), { from: w.from, to: w.to }];
        }
      }
      return init;
    })(),
  );
  const toggleDay = (v: number) =>
    setDayRanges((prev) => {
      const next = { ...prev };
      if (next[v]) delete next[v];
      else next[v] = [{ from: "09:00", to: "12:00" }];
      return next;
    });
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
      const fromIso = durationMode === "single" ? singleDayIso : validFromIso;
      const toIso = durationMode === "single" ? singleDayIso : validToIso;
      if (fromIso > toIso) { push("تاریخ پایان باید بعد از تاریخ شروع باشد", "error"); return; }
      // پایانِ روزِ آخر + یک روز برای اسلات‌های عصر
      const toEnd = new Date(toIso + "T00:00:00");
      toEnd.setDate(toEnd.getDate() + 1);
      const validFrom = new Date(fromIso + "T00:00:00").toISOString();
      const validTo = toEnd.toISOString();
      if (isEdit) {
        await api(`/api/appointments/programs/${editProgram.id}`, {
          method: "PATCH",
          json: {
            title,
            description: description || null,
            topics: topics.length ? topics.map((title) => ({ title })) : undefined,
            audienceType,
            audienceIds: audienceType === "USERS" ? pickedPeople.filter((x) => x.kind === "INTERNAL" && x.userId).map((x) => x.userId as string) : editProgram?.audienceIds ?? [],
            roomIds,
            durationMin,
            bufferMin,
          windows: Object.entries(dayRanges).flatMap(([d, ranges]) =>
            ranges.map((r) => ({ daysOfWeek: [Number(d)], from: r.from, to: r.to })),
          ),
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
          topics: topics.length ? topics.map((title) => ({ title })) : undefined,
          audienceType,
          audienceIds: audienceType === "USERS"
            ? pickedPeople.filter((p) => p.kind === "INTERNAL" && p.userId).map((p) => p.userId as string)
            : [],
          roomIds,
          durationMin,
          bufferMin,
          windows: Object.entries(dayRanges).flatMap(([d, ranges]) =>
            ranges.map((r) => ({ daysOfWeek: [Number(d)], from: r.from, to: r.to })),
          ),
          validFrom,
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
      <div className="flex max-h-[94dvh] w-full flex-col rounded-t-xl bg-white shadow-2xl sm:max-h-[92vh] sm:max-w-2xl sm:rounded-xl lg:max-w-3xl" onClick={(e) => e.stopPropagation()}>
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
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="هدف جلسه برای کارکنان…" className="min-h-[150px] max-h-[400px] w-full resize-y overflow-y-auto rounded-md border border-line p-2.5 text-[12px] leading-6 outline-none focus:border-ink" />
          </div>
          {/* مدت اعتبار — یک روز خاص یا بازه */}
          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">مدت اعتبار برنامه</label>
            <div className="mb-2 flex gap-1.5">
              {[
                { v: "range", l: "بازه‌ی زمانی" },
                { v: "single", l: "یک روز خاص" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setDurationMode(o.v as "range")}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-2 text-[11.5px] font-medium transition-colors",
                    durationMode === o.v ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:border-ink/40",
                  )}
                >
                  {o.l}
                </button>
              ))}
            </div>
            {durationMode === "range" ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[150px] flex-1">
                  <JalaliDatePicker
                    value={validFromIso}
                    onChange={setValidFromIso}
                    placeholder="از تاریخ"
                    min={todayIso}
                  />
                </div>
                <span className="shrink-0 text-[11px] text-ink-faint">تا</span>
                <div className="min-w-[150px] flex-1">
                  <JalaliDatePicker
                    value={validToIso}
                    onChange={setValidToIso}
                    placeholder="تا تاریخ"
                    min={validFromIso}
                  />
                </div>
              </div>
            ) : (
              <JalaliDatePicker
                value={singleDayIso}
                onChange={setSingleDayIso}
                placeholder="روز برگزاری"
                min={todayIso}
              />
            )}
            {durationMode === "single" && (
              <p className="mt-1.5 text-[10.5px] leading-5 text-ink-faint">
                نوبت‌ها فقط در همین روز ارائه می‌شوند؛ بازه‌های ساعتی همان روز را در بخش «روزها و ساعت‌های در دسترس» تعریف کن.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-ink-soft">موضوعات جلسه {topics.length > 0 && <span className="text-ink-faint">({toFa(topics.length)} از ۱۰)</span>}</label>
            <div className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-1 focus-within:border-ink">
              <input
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTopic();
                  }
                }}
                placeholder="موضوع را بنویس و Enter بزن…"
                className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-[12.5px] outline-none"
              />
              <button
                type="button"
                aria-label="افزودن موضوع"
                disabled={!topicDraft.trim() || topics.length >= 10}
                onClick={addTopic}
                className="my-auto flex size-[30px] shrink-0 items-center justify-center rounded-md border border-line text-ink-soft transition hover:bg-paper-soft hover:text-ink disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {topics.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {topics.map((t) => (
                  <span key={t} className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-paper-soft py-1 pl-2.5 pr-1.5 text-[11.5px] font-medium text-ink transition-colors hover:border-ink/30">
                    <span className="truncate" title={t}>{t}</span>
                    <button
                      type="button"
                      aria-label={"حذف " + t}
                      onClick={() => removeTopic(t)}
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-ink-faint transition hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-soft">روزها و ساعت‌های در دسترس</label>
            <p className="mb-2 text-[10.5px] leading-5 text-ink-faint">
              {durationMode === "single"
                ? "ساعت‌های همین روز را تعریف کن (چند بازه مجاز است)"
                : allowedDays.size < 7
                  ? "فقط روزهای موجود در بازه‌ی اعتبار نمایش داده می‌شوند — روشن کن و برای هر روز چند بازه تعریف کن"
                  : "روزها را روشن کن؛ برای هر روز هر چند بازه که می‌خواهی اضافه کن (مثلاً صبح و عصر)"}
            </p>

            {/* انتخاب روزها — فقط روزهای موجود در بازه‌ی اعتبار */}
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS_FA.filter((d) => allowedDays.has(d.v)).map((d) => {
                const on = !!dayRanges[d.v];
                const cnt = dayRanges[d.v]?.length ?? 0;
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggleDay(d.v)}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                      on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:border-ink/40",
                    )}
                  >
                    {d.l}
                    {on && cnt > 1 ? ` (${toFa(cnt)})` : ""}
                  </button>
                );
              })}
            </div>

            {/* بازه‌های هر روز فعال */}
            {Object.keys(dayRanges).length > 0 && (
              <div className="mt-2.5 space-y-2">
                {WEEKDAYS_FA.filter((d) => dayRanges[d.v]).map((d) => {
                  const ranges = dayRanges[d.v];
                  return (
                    <div key={d.v} className="rounded-lg border border-line bg-paper-soft/40 p-2.5">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[12px] font-bold">{d.l}</p>
                        <button
                          type="button"
                          onClick={() => setDayRanges((prev) => ({ ...prev, [d.v]: [...(prev[d.v] ?? []), { from: "14:00", to: "17:00" }] }))}
                          className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-ink-soft transition hover:bg-white hover:text-ink"
                        >
                          <Plus className="h-3 w-3" />
                          بازه‌ی ساعت
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {ranges.map((r, ri) => (
                          <div key={ri} className="flex items-center gap-2">
                            <span className="w-5 shrink-0 text-center text-[10px] font-bold text-ink-faint">{toFa(ri + 1)}</span>
                            <div className="min-w-0 flex-1">
                              <TimePicker
                                value={r.from}
                                onChange={(v) => setDayRanges((prev) => ({ ...prev, [d.v]: (prev[d.v] ?? []).map((x, j) => j === ri ? { ...x, from: v } : x) }))}
                                className="gap-1.5 [&_button]:h-9 [&_button]:px-2 [&_button]:text-[12px]"
                              />
                            </div>
                            <span className="shrink-0 text-[11px] text-ink-faint">تا</span>
                            <div className="min-w-0 flex-1">
                              <TimePicker
                                value={r.to}
                                onChange={(v) => setDayRanges((prev) => ({ ...prev, [d.v]: (prev[d.v] ?? []).map((x, j) => j === ri ? { ...x, to: v } : x) }))}
                                className="gap-1.5 [&_button]:h-9 [&_button]:px-2 [&_button]:text-[12px]"
                              />
                            </div>
                            {ranges.length > 1 && (
                              <button
                                type="button"
                                aria-label={`حذف بازه‌ی ${toFa(ri + 1)} ${d.l}`}
                                onClick={() => setDayRanges((prev) => ({ ...prev, [d.v]: (prev[d.v] ?? []).filter((_, j) => j !== ri) }))}
                                className="text-ink-faint transition hover:text-red-600"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
        className="my-auto flex size-[38px] shrink-0 items-center justify-center border-l border-line text-ink-soft transition hover:bg-paper-soft hover:text-ink"
      >
        <Plus className="h-4 w-4" />
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
        className="my-auto flex size-[38px] shrink-0 items-center justify-center border-r border-line text-ink-soft transition hover:bg-paper-soft hover:text-ink"
      >
        <Minus className="h-4 w-4" />
      </button>
    </div>
  );
}
