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
  /** تاریخ‌های واقعی بازه (ISO) — هر روزِ تقویم، نه روز هفته؛ سقف ۳۰ روز */
  const rangeDates = useMemo(() => {
    const from = new Date((durationMode === "single" ? singleDayIso : validFromIso) + "T12:00:00Z");
    const to = new Date((durationMode === "single" ? singleDayIso : validToIso) + "T12:00:00Z");
    const out: string[] = [];
    for (let d = new Date(from); d <= to && out.length < 30; d.setUTCDate(d.getUTCDate() + 1)) {
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [durationMode, singleDayIso, validFromIso, validToIso]);

  /** حالت تک‌روز: همان روز به‌صورت خودکار فعال است */
  useEffect(() => {
    if (durationMode !== "single") return;
    setDayRanges((prev) => {
      const kept = { ...prev };
      delete kept[singleDayIso];
      return { [singleDayIso]: prev[singleDayIso]?.length ? prev[singleDayIso] : [{ from: "09:00", to: "12:00" }], ...kept };
    });
  }, [durationMode, singleDayIso]); // eslint-disable-line react-hooks/exhaustive-deps

  /** تاریخ‌های فعالِ خارج از بازه → خودکار خاموش شوند */
  useEffect(() => {
    const valid = new Set(rangeDates);
    setDayRanges((prev) => {
      const stale = Object.keys(prev).filter((d) => !valid.has(d));
      if (stale.length === 0) return prev;
      const next = { ...prev };
      for (const d of stale) delete next[d];
      return next;
    });
  }, [rangeDates]);

  const [dayRanges, setDayRanges] = useState<Record<string, { from: string; to: string }[]>>({});
  const toggleDate = (iso: string) =>
    setDayRanges((prev) => {
      const next = { ...prev };
      if (next[iso]) delete next[iso];
      else next[iso] = [{ from: "09:00", to: "12:00" }];
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
          windows: Object.entries(dayRanges).flatMap(([iso, ranges]) =>
            ranges.map((r) => ({ daysOfWeek: [new Date(iso + "T12:00:00Z").getUTCDay()], from: r.from, to: r.to })),
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
          windows: Object.entries(dayRanges).flatMap(([iso, ranges]) =>
            ranges.map((r) => ({ daysOfWeek: [new Date(iso + "T12:00:00Z").getUTCDay()], from: r.from, to: r.to })),
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

          {/* ═══ زمان‌بندی نوبت‌دهی — تاریخ + روزها و ساعت‌ها در یک پنل ═══ */}
          <div className="overflow-hidden rounded-xl border border-line">
            {/* گام ۱ — مدت اعتبار */}
            <div className="border-b border-line bg-paper-soft/50 px-4 py-3.5">
              <p className="flex items-center gap-2 text-[12px] font-bold">
                <span className="flex size-5 items-center justify-center rounded-full bg-ink text-[10.5px] font-bold text-white">۱</span>
                چه زمانی نوبت‌دهی فعال باشد؟
              </p>
              <div className="mt-2.5 flex gap-1.5">
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
              <div className="mt-2">
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
              </div>
            </div>

            {/* گام ۲ — روزها و ساعت‌ها */}
            <div className="px-4 py-3.5">
              <p className="flex items-center gap-2 text-[12px] font-bold">
                <span className="flex size-5 items-center justify-center rounded-full bg-ink text-[10.5px] font-bold text-white">۲</span>
                {durationMode === "single" ? "ساعت‌های این روز" : "چه روزهایی و چه ساعتی؟"}
              </p>
              <p className="mt-1.5 text-[10.5px] leading-5 text-ink-faint">
                {durationMode === "single"
                  ? "برای این روز هر چند بازه‌ی ساعتی که می‌خواهی تعریف کن"
                  : rangeDates.length <= 14
                    ? "تک‌تک روزهای بازه بالا — روشن کن و ساعت‌های همان روز را تعریف کن"
                    : "روزهایی از بازه که می‌خواهی نوبت بدهی را روشن کن و ساعت‌هایشان را تعریف کن"}
              </p>

              {/* چیپ تاریخ‌های واقعی بازه */}
              <div className="mt-2.5 flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                {rangeDates.map((iso) => {
                  const on = !!dayRanges[iso];
                  const cnt = dayRanges[iso]?.length ?? 0;
                  const dt = new Date(iso + "T12:00:00Z");
                  const wd = WEEKDAYS_FA.find((w) => w.v === dt.getUTCDay())?.l ?? "";
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => toggleDate(iso)}
                      className={cn(
                        "flex flex-col items-center rounded-md border px-2.5 py-1 text-center transition-colors",
                        on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:border-ink/40",
                      )}
                    >
                      <span className="text-[10.5px] font-medium leading-4">{wd}</span>
                      <span className={cn("text-[11px] font-bold leading-4 tabular-nums", on ? "text-white" : "text-ink")}>
                        {dt.toLocaleDateString("fa-IR", { day: "numeric", month: "short" })}
                      </span>
                      {on && cnt > 1 ? <span className={cn("text-[9px] leading-3", on ? "text-white/70" : "text-ink-faint")}>{toFa(cnt)} بازه</span> : null}
                    </button>
                  );
                })}
              </div>

              {/* کارت بازه‌های هر روز */}
              {Object.keys(dayRanges).length > 0 && (
                <div className="mt-2.5 space-y-2">
                  {Object.keys(dayRanges).sort().map((iso) => {
                    const ranges = dayRanges[iso];
                    const dt = new Date(iso + "T12:00:00Z");
                    const wd = WEEKDAYS_FA.find((w) => w.v === dt.getUTCDay())?.l ?? "";
                    return (
                      <div key={iso} className="rounded-lg border border-line bg-paper-soft/40 p-2.5">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[12px] font-bold">{wd} {dt.toLocaleDateString("fa-IR", { day: "numeric", month: "long" })}</p>
                          <button
                            type="button"
                            onClick={() => setDayRanges((prev) => ({ ...prev, [iso]: [...(prev[iso] ?? []), { from: "14:00", to: "17:00" }] }))}
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
                                  onChange={(v) => setDayRanges((prev) => ({ ...prev, [iso]: (prev[iso] ?? []).map((x, j) => j === ri ? { ...x, from: v } : x) }))}
                                  className="gap-1.5 [&_button]:h-9 [&_button]:px-2 [&_button]:text-[12px]"
                                />
                              </div>
                              <span className="shrink-0 text-[11px] text-ink-faint">تا</span>
                              <div className="min-w-0 flex-1">
                                <TimePicker
                                  value={r.to}
                                  onChange={(v) => setDayRanges((prev) => ({ ...prev, [iso]: (prev[iso] ?? []).map((x, j) => j === ri ? { ...x, to: v } : x) }))}
                                  className="gap-1.5 [&_button]:h-9 [&_button]:px-2 [&_button]:text-[12px]"
                                />
                              </div>
                              {ranges.length > 1 && (
                                <button
                                  type="button"
                                  aria-label={"حذف بازه‌ی " + toFa(ri + 1)}
                                  onClick={() => setDayRanges((prev) => ({ ...prev, [iso]: (prev[iso] ?? []).filter((_, j) => j !== ri) }))}
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

          {/* ═══ پیش‌نمایش آزادی — تایم‌لاین بصری ═══ */}
          {roomIds.length > 0 && <FreeTimePreview days={previewDays} loading={previewLoading} />}

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


/* ═══════════ پیش‌نمایش آزادی — نوار تایم‌لاین بصری روزانه ═══════════ */

const PREVIEW_DAY_START = 9; // ساعت شروع نوار
const PREVIEW_DAY_END = 18; // ساعت پایان نوار
const PREVIEW_SPAN = (PREVIEW_DAY_END - PREVIEW_DAY_START) * 3600_000;

function FreeTimePreview({
  days,
  loading,
}: {
  days: { date: string; hostFree: { from: string; to: string }[]; roomFree: Record<string, { from: string; to: string; freeRooms: number }[]> }[];
  loading: boolean;
}) {
  // تقاطع آزادی من و اتاق‌ها + دقیقه‌ی آزاد هر روز
  const rows = days
    .map((d) => {
      const roomSlots = d.roomFree[d.date] ?? [];
      const both = d.hostFree.filter((hf) =>
        roomSlots.some((rs) => new Date(hf.from) >= new Date(rs.from) && new Date(hf.to) <= new Date(rs.to)),
      );
      const freeMin = both.reduce((sum, b) => sum + (new Date(b.to).getTime() - new Date(b.from).getTime()) / 60000, 0);
      return { date: d.date, both, freeMin };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const freeDays = rows.filter((r) => r.freeMin > 0);
  const busyDays = rows.filter((r) => r.freeMin === 0);
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      {/* هدر + خلاصه */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper-soft/50 px-4 py-3">
        <div>
          <p className="text-[12px] font-bold">پیش‌نمایش آزادی — ۱۴ روز آینده</p>
          <p className="mt-0.5 text-[10.5px] leading-5 text-ink-faint">
            نوارهای سبز = شما آزاد هستید و حداقل یک اتاقِ انتخابی خالی است
          </p>
        </div>
        {loading ? (
          <span className="text-[10.5px] text-ink-faint">در حال بررسی…</span>
        ) : (
          <span className={cn(
            "rounded-full px-2.5 py-1 text-[10.5px] font-bold",
            freeDays.length > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
          )}>
            {freeDays.length > 0
              ? toFa(freeDays.length) + " روز آزاد از " + toFa(rows.length)
              : "ساعت آزاد مشترکی نیست"}
          </span>
        )}
      </div>

      {/* مقیاس ساعت بالای نوارها */}
      {freeDays.length > 0 && (
        <div className="flex items-center border-b border-line/60 bg-white px-4 py-1.5" aria-hidden>
          <span className="w-[6.5rem] shrink-0" />
          <div className="relative h-3 flex-1">
            {[...Array(PREVIEW_DAY_END - PREVIEW_DAY_START + 1)].map((_, i) => (
              <span
                key={i}
                className="absolute -translate-x-1/2 text-[9px] tabular-nums text-ink-faint"
                style={{ right: (i / (PREVIEW_DAY_END - PREVIEW_DAY_START)) * 100 + "%" }}
              >
                {toFa(Number(String(PREVIEW_DAY_START + i).padStart(2, "0")))}
              </span>
            ))}
          </div>
          <span className="w-[3.2rem] shrink-0" />
        </div>
      )}

      {/* ردیف‌های روز — اسکرول داخلی */}
      <div className="max-h-44 divide-y divide-line/50 overflow-y-auto bg-white">
        {freeDays.map((r) => {
          const dt = new Date(r.date + "T12:00:00Z");
          const wd = dt.toLocaleDateString("fa-IR", { weekday: "short" });
          const md = dt.toLocaleDateString("fa-IR", { day: "numeric", month: "short" });
          return (
            <div key={r.date} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-paper-soft/40">
              {/* تاریخ */}
              <div className="w-[6.5rem] shrink-0 text-right">
                <p className="text-[11px] font-bold leading-4">{wd}</p>
                <p className="text-[10px] leading-4 text-ink-faint tabular-nums">{md}</p>
              </div>
              {/* نوار تایم‌لاین — RTL: راست = صبح */}
              <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-paper-soft ring-1 ring-line/60">
                {r.both.map((b, i) => {
                  const from = new Date(b.from).getTime();
                  const to = new Date(b.to).getTime();
                  const start = new Date(b.from); start.setHours(0, 0, 0, 0);
                  const right = Math.max(0, Math.min(100, ((from - (start.getTime() + PREVIEW_DAY_START * 3600_000)) / PREVIEW_SPAN) * 100));
                  const width = Math.max(1, Math.min(100 - right, ((to - from) / PREVIEW_SPAN) * 100));
                  return (
                    <span
                      key={i}
                      title={hhmm(b.from) + " تا " + hhmm(b.to)}
                      className="absolute inset-y-0.5 rounded-[5px] bg-gradient-to-l from-emerald-400 to-emerald-500 shadow-sm"
                      style={{ right: right + "%", width: width + "%" }}
                    />
                  );
                })}
              </div>
              {/* دقیقه‌ی آزاد */}
              <span className="w-[3.2rem] shrink-0 text-left text-[10.5px] font-bold tabular-nums text-emerald-700">
                {toFa(Math.round(r.freeMin)) + "\u2032"}
              </span>
            </div>
          );
        })}

        {/* روزهای بدون آزادی — جمع‌شده و کم‌رنگ */}
        {busyDays.length > 0 && (
          <div className="px-4 py-2 text-[10.5px] text-ink-faint">
            {toFa(busyDays.length)} روز دیگر — ساعت مشترک آزاد نیست
            <span className="mr-1.5 text-[9px]">
              ({busyDays.slice(0, 5).map((r) => new Date(r.date + "T12:00:00Z").toLocaleDateString("fa-IR", { day: "numeric", month: "short" })).join("\u060c")}{busyDays.length > 5 ? " و…" : ""})
            </span>
          </div>
        )}

        {!loading && rows.length === 0 && (
          <p className="px-4 py-4 text-center text-[11px] text-ink-faint">در ۱۴ روز آینده داده‌ای موجود نیست</p>
        )}
      </div>
    </div>
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
