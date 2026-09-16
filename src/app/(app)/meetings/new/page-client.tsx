"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Sparkles } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import { CalendarPlus } from "@/components/ui/icon";
import { cn, faNum, faStr, formatJalali, isoDateInTz, EQUIPMENT_FA, TYPE_FA, TYPE_HINT_FA, isSoloMeetingType, VIDEO_PROVIDER_FA, isVideoProvider } from "@/lib";
import { formatClockInTz, DEFAULT_ORG_TIMEZONE } from "@/lib/timezone";
import { J_WEEKDAYS_LONG, iranianWeekdayIndex, zonedTimeToUtc } from "@/lib/jalali";
import {
  describeRecurrence,
  expandOccurrences,
  RECURRENCE_FREQ_FA,
  type RecurrenceFreq,
} from "@/lib/recurrence";
import { Select } from "@/components/ui/select";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { PeoplePicker, type PickedPerson } from "@/components/ui/people-picker";
import { FaInput } from "@/components/ui/fa-input";
import {
  bookingMatchesQuery,
  clearAvailabilityBooking,
  loadAvailabilityBooking,
  suggestRoomId,
} from "@/lib/availability-booking";
import { queryParam, type NextSearchParams } from "@/lib/next-page-props";
import { VideoLinkFields } from "@/components/meetings/video-link-fields";
import { useAuth } from "@/lib/auth-store";
import { Modal } from "@/components/ui/modal";

interface Slot {
  start: string;
  end: string;
  availableRooms: { id: string; name: string; capacity: number; equipment: string[] }[];
  conflicts: { userId: string; userName: string; meetingTitle: string }[];
}

export function NewMeetingPageContent({ searchParams }: { searchParams: NextSearchParams }) {
  const router = useRouter();
  const { push } = useToast();
  const { me } = useAuth();
  const prefilledFromAvailability = useRef(false);

  // form state
  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  // venue: ONSITE (our rooms) | OFFSITE (at another org — no room needed)
  const [venue, setVenue] = useState<"ONSITE" | "OFFSITE">("ONSITE");
  const [offsiteOrg, setOffsiteOrg] = useState("");
  const [offsiteNote, setOffsiteNote] = useState("");
  const [offsiteHour, setOffsiteHour] = useState("");
  const offsite = venue === "OFFSITE";
  const [description, setDescription] = useState("");
  const [meetingType, setMeetingType] = useState("INTERNAL");
  const [branchId, setBranchId] = useState("");
  const [people, setPeople] = useState<PickedPerson[]>([]);
  const [durationMin, setDurationMin] = useState(30);
  const [dateIso, setDateIso] = useState(""); // gregorian iso from jalali picker
  const [slot, setSlot] = useState<Slot | null>(null);
  const [roomId, setRoomId] = useState("");
  const [guests, setGuests] = useState<{ name: string; company: string; phone: string; email: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [fromAvailabilityHandoff, setFromAvailabilityHandoff] = useState(false);
  const [fromCalendarHint, setFromCalendarHint] = useState<string | null>(null);
  const [recurrenceFreq, setRecurrenceFreq] = useState<"NONE" | RecurrenceFreq>("NONE");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([]);
  const [recurrenceUntilIso, setRecurrenceUntilIso] = useState("");
  const [recurrenceCount, setRecurrenceCount] = useState("");
  const [videoProvider, setVideoProvider] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [organizerId, setOrganizerId] = useState("");
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const soloType = isSoloMeetingType(meetingType);

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: { id: string; name: string }[] }>("/api/branches"),
  });

  const { data: delegateData } = useQuery({
    queryKey: ["delegates"],
    queryFn: () =>
      api<{
        principals: { id: string; user: { id: string; fullName: string } }[];
      }>("/api/delegates"),
  });
  const principals = delegateData?.principals ?? [];

  const branches = branchesData?.branches ?? [];

  const { data: brandingData } = useQuery({
    queryKey: ["organization-branding"],
    queryFn: () =>
      api<{ branding: { timezone: string } }>("/api/organization/branding"),
  });
  const orgTz = brandingData?.branding.timezone ?? DEFAULT_ORG_TIMEZONE;

  const { data: holidayData } = useQuery({
    queryKey: ["org-holidays", dateIso],
    queryFn: () =>
      api<{ holidays: { dateIso: string; name: string }[]; bookingMode: "BLOCK" | "REQUIRE_APPROVAL" }>(
        dateIso ? `/api/holidays?from=${dateIso}&to=${dateIso}` : "/api/holidays",
      ),
    enabled: !!dateIso,
  });
  const dayHoliday = holidayData?.holidays.find((h) => h.dateIso === dateIso);
  const holidayBlocked = !!dayHoliday && (holidayData?.bookingMode ?? "BLOCK") === "BLOCK";

  useEffect(() => {
    if (me?.id && !organizerId) setOrganizerId(me.id);
  }, [me?.id, organizerId]);

  useEffect(() => {
    if (prefilledFromAvailability.current) return;

    if (queryParam(searchParams, "from") !== "availability") return;

    const draft = loadAvailabilityBooking();
    if (
      !draft ||
      !bookingMatchesQuery(draft, {
        branchId: queryParam(searchParams, "branchId"),
        startAt: queryParam(searchParams, "startAt"),
        endAt: queryParam(searchParams, "endAt"),
        durationMin: queryParam(searchParams, "durationMin"),
      })
    ) {
      return;
    }

    prefilledFromAvailability.current = true;
    clearAvailabilityBooking();

    setBranchId(draft.branchId);
    setDurationMin(draft.durationMin);
    setPeople(draft.people);
    setDateIso(isoDateInTz(new Date(draft.startAt), orgTz));

    const rooms = draft.availableRooms.map((r) => ({
      ...r,
      equipment: r.equipment ?? [],
    }));
    const slotData: Slot = {
      start: draft.startAt,
      end: draft.endAt,
      availableRooms: rooms,
      conflicts: [],
    };
    setSlot(slotData);

    const queryRoomId = queryParam(searchParams, "roomId") ?? undefined;
    const picked =
      (queryRoomId && rooms.some((r) => r.id === queryRoomId) ? queryRoomId : undefined) ??
      draft.roomId ??
      suggestRoomId(rooms, draft.people.length + 1) ??
      "";
    setRoomId(picked);
    setFromAvailabilityHandoff(true);
    if (draft.organizerId) setOrganizerId(draft.organizerId);

    requestAnimationFrame(() => {
      document.getElementById("meeting-step-room")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [orgTz, searchParams]);

  useEffect(() => {
    if (queryParam(searchParams, "from") !== "calendar") return;
    const date = queryParam(searchParams, "date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setDateIso(date);
    const hourRaw = queryParam(searchParams, "hour");
    const hour = hourRaw != null ? Number(hourRaw) : NaN;
    setFromCalendarHint(
      faStr(
        Number.isFinite(hour)
          ? `تاریخ و ساعت از تقویم پر شد — ${formatJalali(new Date(`${date}T12:00:00`), { monthName: true })}، ساعت ${String(hour).padStart(2, "0")}:۰۰`
          : `تاریخ از تقویم پر شد — ${formatJalali(new Date(`${date}T12:00:00`), { monthName: true })}`,
      ),
    );
  }, [searchParams]);

  function isoToday(): string {
    const t = new Date(Date.now() + 210 * 60000);
    return t.toISOString().slice(0, 10);
  }

  async function findSlots() {
    if (offsite) {
      // OFFSITE: no room search — build the slot directly from the picked day + hour
      if (!title.trim()) { push("عنوان را بنویسید", "error"); return; }
      if (!dateIso) { push("تاریخ را انتخاب کنید", "error"); return; }
      if (!offsiteHour) { push("ساعت جلسه را انتخاب کنید", "error"); return; }
      const [y, m, d] = dateIso.split("-").map(Number);
      const [hh, mm] = offsiteHour.split(":").map(Number);
      const start = new Date(Date.UTC(y, m - 1, d, hh - 3, mm - 30, 0));
      setSlot({ start: start.toISOString(), end: new Date(start.getTime() + durationMin * 60000).toISOString(), availableRooms: [] } as unknown as Slot);
      setRoomId("");
      return;
    }
    if (!branchId || !title.trim()) {
      push("عنوان و شعبه را انتخاب کنید", "error");
      return;
    }
    if (holidayBlocked && dayHoliday) {
      push(`رزرو در روز تعطیل «${dayHoliday.name}» مجاز نیست`, "error");
      return;
    }
    setSearching(true);
    setSlot(null);
    setRoomId("");
    try {
      // window for the picked day (or today if none picked)
      const iso = dateIso || isoToday();
      const [gy, gm, gd] = iso.split("-").map(Number);
      const from = new Date(Date.UTC(gy, gm - 1, gd, 0, 0) - 210 * 60000);
      const to = new Date(from.getTime() + 86400000);
      const internalIds = soloType ? [] : people.filter((p) => p.ref.startsWith("dir:"));
      const dir = await api<{ people: { id: string; userId: string | null }[] }>(`/api/people`);
      const userIdByDir = new Map(dir.people.map((d) => [d.id, d.userId]));
      const participantIds = internalIds
        .map((p) => userIdByDir.get(p.ref.slice(4)))
        .filter((x): x is string => !!x);
      const data = await api<{ slots: Slot[] }>("/api/availability", {
        method: "POST",
        json: {
          branchId,
          participantIds,
          durationMin,
          from: from.toISOString(),
          to: to.toISOString(),
          minCapacity: soloType ? 1 : people.length + 1,
          ...(organizerId && me?.id && organizerId !== me.id ? { organizerId } : {}),
        },
      });
      if (data.slots.length === 0) push("هیچ زمان آزادی برای این روز یافت نشد", "error");
      else {
        setSlot(data.slots[0]);
        const best = [...data.slots[0].availableRooms].sort((a, b) => {
          if (meetingType === "ONLINE") {
            const av = a.equipment.includes("VIDEO_CONFERENCE") ? 0 : 1;
            const bv = b.equipment.includes("VIDEO_CONFERENCE") ? 0 : 1;
            if (av !== bv) return av - bv;
          }
          return a.capacity - b.capacity;
        })[0];
        if (best) setRoomId(best.id);
      }
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setSearching(false);
    }
  }

  const selectedRoom = slot?.availableRooms.find((r) => r.id === roomId);

  useEffect(() => {
    if (recurrenceFreq !== "WEEKLY" || !dateIso) return;
    if (recurrenceWeekdays.length > 0) return;
    setRecurrenceWeekdays([iranianWeekdayIndex(dateIso)]);
  }, [recurrenceFreq, dateIso, recurrenceWeekdays.length]);

  const untilDate = useMemo(() => {
    if (!recurrenceUntilIso) return undefined;
    const [y, m, d] = recurrenceUntilIso.split("-").map(Number);
    return zonedTimeToUtc(y, m, d, 23, 59, 0, orgTz);
  }, [recurrenceUntilIso, orgTz]);

  const recurrencePreview = useMemo(() => {
    if (recurrenceFreq === "NONE" || !slot) return [];
    const count = recurrenceCount ? Number(recurrenceCount) : undefined;
    return expandOccurrences(
      new Date(slot.start),
      {
        freq: recurrenceFreq,
        interval: recurrenceInterval,
        byWeekday: recurrenceFreq === "WEEKLY" ? recurrenceWeekdays : undefined,
        until: untilDate,
        count,
      },
      orgTz,
    );
  }, [recurrenceFreq, slot, recurrenceInterval, recurrenceWeekdays, untilDate, recurrenceCount, orgTz]);

  async function submit(opts?: { waitlistIfBusy?: boolean }) {
    if (!slot || !roomId) {
      push("ابتدا زمان و اتاق را انتخاب کنید", "error");
      return;
    }
    setSubmitting(true);
    try {
      const dir = await api<{ people: { id: string; userId: string | null }[] }>(`/api/people`);
      const userIdByDir = new Map(dir.people.map((d) => [d.id, d.userId]));
      const participantIds = soloType
        ? []
        : people
            .filter((p) => p.ref.startsWith("dir:"))
            .map((p) => userIdByDir.get(p.ref.slice(4)))
            .filter((x): x is string => !!x);
      const guestPeople = soloType ? [] : people.filter((p) => p.kind === "EXTERNAL");
      const recurrence =
        recurrenceFreq === "NONE"
          ? undefined
          : {
              freq: recurrenceFreq,
              interval: recurrenceInterval,
              byWeekday: recurrenceFreq === "WEEKLY" ? recurrenceWeekdays : undefined,
              until: untilDate?.toISOString(),
              count: recurrenceCount ? Number(recurrenceCount) : undefined,
            };
      const data = await api<{ meeting: { id: string; status?: string }; occurrenceCount?: number }>("/api/meetings", {
        method: "POST",
        json: {
          title: title.trim(),
          description: [
            description.trim() || undefined,
            offsite ? `📍 محل جلسه: ${offsiteOrg.trim() || "بیرون از شرکت"}${offsiteNote.trim() ? ` — ${offsiteNote.trim()}` : ""}` : undefined,
          ].filter(Boolean).join("\n\n") || undefined,
          isPrivate,
          ...(offsite ? {} : { branchId, roomId }),
          startAt: new Date(slot.start).toISOString(),
          endAt: new Date(slot.end).toISOString(),
          meetingType: offsite ? "EXTERNAL" : meetingType,
          ...(organizerId && me?.id && organizerId !== me.id ? { organizerId } : {}),
          ...(videoUrl.trim()
            ? { videoProvider: videoProvider || "CUSTOM", videoUrl: videoUrl.trim() }
            : {}),
          participantIds,
          guests: [
            ...guests
              .filter((g) => g.name.trim())
              .map((g) => ({
                name: g.name.trim(),
                company: g.company.trim() || undefined,
                phone: g.phone.trim() || undefined,
                email: g.email.trim() || undefined,
              })),
            ...guestPeople.map((p) => ({
              name: p.name,
              company: p.company || undefined,
              phone: p.phone || undefined,
              email: p.email || undefined,
              notes: p.ref.startsWith("new:") ? "افزودهشده دستی هنگام ساخت جلسه" : undefined,
            })),
          ],
          ...(recurrence ? { recurrence } : {}),
          ...(opts?.waitlistIfBusy ? { waitlistIfBusy: true } : {}),
        },
      });
      setWaitlistOpen(false);
      push(
        data.meeting.status === "WAITLISTED"
          ? "در لیست انتظار ثبت شدید — اتاق هنوز قفل نشده است"
          : data.occurrenceCount && data.occurrenceCount > 1
          ? `سری جلسه با ${faNum(data.occurrenceCount)} نوبت ایجاد شد`
          : "جلسه ایجاد شد",
        "success",
      );
      router.push(`/meetings/${data.meeting.id}`);
    } catch (e) {
      const err = e as ApiError;
      const extra = err.extra as { canWaitlist?: boolean; waitlistCount?: number } | undefined;
      if (
        err.status === 409 &&
        err.code === "ROOM_CONFLICT" &&
        extra?.canWaitlist &&
        recurrenceFreq === "NONE" &&
        !opts?.waitlistIfBusy
      ) {
        setWaitlistCount(extra.waitlistCount ?? 0);
        setWaitlistOpen(true);
        return;
      }
      push(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  const fromAvailability = fromAvailabilityHandoff && !!slot;

  const { can } = useAuth();

  if (!can("meeting:create")) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <h1 className="text-lg font-bold">ثبت جلسه</h1>
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-paper-soft">
            <CalendarPlus className="h-6 w-6 text-ink-soft" />
          </div>
          <p className="text-[14px] font-bold">اینجا مخصوص مدیریت است</p>
          <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-6 text-ink-soft">
            در این سازمان جلسه‌ها را همه به‌صورت <span className="font-medium">درخواست</span> ثبت می‌کنند و مدیریت
            متناسب با شرایط و اولویت، زمان‌بندی می‌کند. درخواست خود را ثبت کنید:
          </p>
          <Link
            href="/meeting-requests"
            className="mt-5 inline-flex h-10 items-center rounded-lg bg-ink px-5 text-[13px] font-medium text-white transition-colors hover:bg-[#2a2a2e]"
          >
            ثبت درخواست جلسه
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-clip p-4 lg:p-6">
      <div>
        <h1 className="text-lg font-bold">ثبت مستقیم جلسه</h1>
        <p className="mt-0.5 text-[12px] leading-6 text-ink-soft">
          فقط برای مدیریت — ثبت قطعی بدون صف درخواست · برای نیازهای عادی، از «درخواست جلسه» استفاده کنید
        </p>
      </div>

      {/* Step 1: basics */}
      <Card>
        <CardHeader title="۱. اطلاعات جلسه" />
        <CardBody className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">عنوان</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: جلسه هفتگی تیم فروش"
              className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink focus:ring-2 focus:ring-ink/15"
            />
          </div>
          <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-md border border-line bg-white px-3.5">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="h-4 w-4 accent-black" />
            <span className="text-[12px]">جلسه محرمانه — عنوان و جزئیات فقط برای برگزارکننده و دعوت‌شدگان دیده می‌شود</span>
          </label>
          {principals.length > 0 && me && (
            <div data-tour="meeting-delegate" data-testid="meeting-organizer">
              <label className="mb-1.5 block text-[12px] font-medium">برگزارکننده</label>
              <Select
                value={organizerId || me.id}
                onChange={setOrganizerId}
                options={[
                  { value: me.id, label: `خودم (${me.fullName})` },
                  ...principals.map((p) => ({
                    value: p.user.id,
                    label: `برگزارکننده = ${p.user.fullName}`,
                  })),
                ]}
              />
              {organizerId && organizerId !== me.id && (
                <p className="mt-1.5 text-[11px] leading-5 text-ink-soft">
                  جلسه به نام این فرد ساخته می‌شود و تقویم مشغول او در جستجوی زمان لحاظ می‌شود. عنوان جلسه‌های محرمانه‌اش دیده نمی‌شود.
                </p>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">نوع جلسه</label>
              <Select
                value={meetingType}
                onChange={(v) => {
                  setMeetingType(v);
                  if (isSoloMeetingType(v)) {
                    setPeople([]);
                    setGuests([]);
                  }
                  if (v === "ONE_ON_ONE") {
                    setPeople((p) => p.slice(0, 1));
                  }
                  if (v !== "ONLINE") {
                    setVideoUrl("");
                    setVideoProvider("");
                  }
                }}
                options={Object.entries(TYPE_FA).map(([value, label]) => ({ value, label }))}
              />
              {TYPE_HINT_FA[meetingType] && (
                <p className="mt-1.5 text-[11px] leading-5 text-ink-soft">{TYPE_HINT_FA[meetingType]}</p>
              )}
            </div>
            {!offsite && (
              <div>
                <label className="mb-1.5 block text-[12px] font-medium">شعبه</label>
                <Select
                  value={branchId}
                  onChange={setBranchId}
                  placeholder="انتخاب شعبه…"
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                />
              </div>
            )}
          </div>
          
          {/* venue */}
          <div className="rounded-lg border border-line bg-paper-soft/40 p-3.5">
            <p className="text-[12px] font-bold">محل برگزاری</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setVenue("ONSITE")}
                className={cn("flex items-center gap-2.5 rounded-md border p-3 text-right transition-colors", venue === "ONSITE" ? "border-ink bg-white shadow-sm" : "border-line bg-white hover:bg-paper-soft")}>
                <span className={cn("h-3.5 w-3.5 shrink-0 rounded-full border-2", venue === "ONSITE" ? "border-ink bg-ink" : "border-[#c9c9d0]")} />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium">در شرکت خودمان</span>
                  <span className="block text-[10.5px] text-ink-faint">جستجوی اتاق آزاد و رزرو</span>
                </span>
              </button>
              <button type="button" onClick={() => setVenue("OFFSITE")}
                className={cn("flex items-center gap-2.5 rounded-md border p-3 text-right transition-colors", venue === "OFFSITE" ? "border-ink bg-white shadow-sm" : "border-line bg-white hover:bg-paper-soft")}>
                <span className={cn("h-3.5 w-3.5 shrink-0 rounded-full border-2", venue === "OFFSITE" ? "border-ink bg-ink" : "border-[#c9c9d0]")} />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium">بیرون از شرکت</span>
                  <span className="block text-[10.5px] text-ink-faint">جلسه در محل سازمان مقصد — بدون رزرو اتاق</span>
                </span>
              </button>
            </div>
            {offsite && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-ink-soft">نام سازمان مقصد *</label>
                  <input value={offsiteOrg} onChange={(e) => setOffsiteOrg(e.target.value)} placeholder="مثلاً: همراه اول"
                    className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-ink-soft">نشانی / توضیح (اختیاری)</label>
                  <input value={offsiteNote} onChange={(e) => setOffsiteNote(e.target.value)} placeholder="مثلاً: برج ساعی، طبقه ۵"
                    className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
                </div>
              </div>
            )}
          </div>

          {soloType ? (
            <div className="rounded-md border border-line bg-paper-soft px-3.5 py-3 text-[12px] leading-6 text-ink-soft">
              {meetingType === "ONLINE"
                ? "این رزرو برای برگزاری جلسه آنلاین از داخل اتاق است — دعوت‌شونده حضوری لازم نیست."
                : "این رزرو فقط برای خودتان است — اتاق در آن بازه به نام شما قفل می‌شود."}
            </div>
          ) : (
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">
              {meetingType === "ONE_ON_ONE"
                ? `طرف مقابل (${faNum(people.length)}/۱ — فقط یک نفر)`
                : `افراد دعوت‌شده (${faNum(people.length)} نفر — از لیست انتخاب کنید یا نام جدید بنویسید)`}
            </label>
            <PeoplePicker value={people} onChange={setPeople} max={meetingType === "ONE_ON_ONE" ? 1 : undefined} />
            {people.filter((p) => p.kind === "EXTERNAL").length > 0 && (
              <p className="mt-1.5 text-[11px] text-amber-600">
                ⚠ افراد خارجی به‌عنوان مهمان ثبت می‌شوند و جلسه نیازمند تأیید اپراتور خواهد بود.
              </p>
            )}
          </div>
          )}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">توضیحات (اختیاری)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-[#d9d9e0] px-3.5 py-2.5 text-[13px] outline-none focus:border-ink"
            />
          </div>
          {meetingType === "ONLINE" && (
            <VideoLinkFields
              provider={videoProvider}
              url={videoUrl}
              onProvider={setVideoProvider}
              onUrl={setVideoUrl}
              highlighted
            />
          )}
        </CardBody>
      </Card>

      {/* Step 2: date + duration + find slots */}
      <Card>
        <CardHeader
          title="۲. تاریخ و مدت"
          subtitle={
            fromAvailability
              ? "زمان از صفحه یافتن زمان مناسب انتخاب شده — می‌توانید دوباره جستجو کنید"
              : soloType
                ? "سیستم اولین اتاق آزاد را برای خودتان پیدا می‌کند"
                : "سیستم زمان‌های آزاد مشترک همه افراد را پیدا می‌کند"
          }
        />
        <CardBody className="space-y-4">
          {fromCalendarHint && (
            <p className="rounded-md bg-paper-soft px-3 py-2 text-[12px] leading-6 text-ink-soft">{fromCalendarHint}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">تاریخ (شمسی)</label>
              <JalaliDatePicker
                value={dateIso}
                onChange={setDateIso}
                min={isoToday()}
              />
              {dayHoliday && (
                <p className={cn(
                  "mt-1.5 text-[11px] leading-5",
                  holidayBlocked ? "text-red-600" : "text-amber-700",
                )}>
                  {holidayBlocked
                    ? `تعطیل سازمانی «${dayHoliday.name}» — رزرو اتاق در این روز ممنوع است.`
                    : `تعطیل سازمانی «${dayHoliday.name}» — رزرو نیاز به تأیید دارد.`}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">مدت (دقیقه)</label>
              <Select
                value={String(durationMin)}
                onChange={(v) => setDurationMin(Number(v))}
                options={[15, 30, 45, 60, 90, 120].map((d) => ({ value: String(d), label: `${faNum(d)} دقیقه` }))}
              />
            </div>
          </div>
          <div data-tour="meeting-recurrence" className="space-y-3 rounded-md border border-line bg-paper-soft/60 p-3.5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium">تکرار جلسه</label>
                <Select
                  value={recurrenceFreq}
                  onChange={(v) => {
                    const next = v as "NONE" | RecurrenceFreq;
                    setRecurrenceFreq(next);
                    if (next === "WEEKLY" && dateIso && recurrenceWeekdays.length === 0) {
                      setRecurrenceWeekdays([iranianWeekdayIndex(dateIso)]);
                    }
                  }}
                  options={[
                    { value: "NONE", label: "تکرار ندارد" },
                    { value: "DAILY", label: RECURRENCE_FREQ_FA.DAILY },
                    { value: "WEEKLY", label: RECURRENCE_FREQ_FA.WEEKLY },
                    { value: "MONTHLY", label: RECURRENCE_FREQ_FA.MONTHLY },
                  ]}
                />
              </div>
              {recurrenceFreq !== "NONE" && (
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium">فاصله تکرار</label>
                  <Select
                    value={String(recurrenceInterval)}
                    onChange={(v) => setRecurrenceInterval(Number(v))}
                    options={[1, 2, 3, 4, 6, 8, 12].map((n) => ({
                      value: String(n),
                      label:
                        recurrenceFreq === "DAILY"
                          ? n === 1 ? "هر روز" : `هر ${faNum(n)} روز`
                          : recurrenceFreq === "WEEKLY"
                            ? n === 1 ? "هر هفته" : `هر ${faNum(n)} هفته`
                            : n === 1 ? "هر ماه" : `هر ${faNum(n)} ماه`,
                    }))}
                  />
                </div>
              )}
            </div>
            {recurrenceFreq === "WEEKLY" && (
              <div>
                <p className="mb-1.5 text-[12px] font-medium">روزهای هفته</p>
                <div className="flex flex-wrap gap-1.5">
                  {J_WEEKDAYS_LONG.map((label, i) => {
                    const on = recurrenceWeekdays.includes(i);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          setRecurrenceWeekdays((prev) => {
                            if (prev.includes(i)) {
                              const next = prev.filter((d) => d !== i);
                              return next.length ? next : prev;
                            }
                            return [...prev, i].sort((a, b) => a - b);
                          });
                        }}
                        className={cn(
                          "rounded-md border px-2.5 py-1.5 text-[12px] transition-colors",
                          on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink-faint",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {recurrenceFreq !== "NONE" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium">تا تاریخ (اختیاری)</label>
                  <JalaliDatePicker
                    value={recurrenceUntilIso}
                    onChange={setRecurrenceUntilIso}
                    min={dateIso || isoToday()}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium">تعداد نوبت (اختیاری)</label>
                  <Select
                    value={recurrenceCount}
                    onChange={setRecurrenceCount}
                    placeholder="خودکار تا سقف مجاز"
                    options={[
                      { value: "", label: "خودکار تا سقف مجاز" },
                      ...[2, 3, 4, 5, 8, 10, 12, 20, 30, 52].map((n) => ({
                        value: String(n),
                        label: `${faNum(n)} نوبت`,
                      })),
                    ]}
                  />
                </div>
              </div>
            )}
            {recurrenceFreq !== "NONE" && (
              <p className="text-[11px] leading-5 text-ink-soft">
                {describeRecurrence({
                  freq: recurrenceFreq,
                  interval: recurrenceInterval,
                  byWeekday: recurrenceFreq === "WEEKLY" ? recurrenceWeekdays : undefined,
                })}
                {recurrencePreview.length > 0 &&
                  ` · ${faNum(recurrencePreview.length)} نوبت ساخته می‌شود`}
                {slot && recurrencePreview.length > 0 && (
                  <>
                    {" "}
                    (اولین: {formatJalali(recurrencePreview[0], { withTime: true, monthName: true })}
                    {recurrencePreview.length > 1
                      ? `، آخرین: ${formatJalali(recurrencePreview[recurrencePreview.length - 1], { monthName: true })}`
                      : ""}
                    )
                  </>
                )}
              </p>
            )}
          </div>
          {!fromAvailability && !offsite && (
            <div className="flex justify-end">
              <Button onClick={findSlots} loading={searching} disabled={holidayBlocked} className="w-full sm:w-auto">
                <Sparkles className="h-4 w-4" />
                یافتن زمان‌های آزاد
              </Button>
            </div>
          )}
          {offsite && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium">ساعت جلسه *</label>
                <Select
                  value={offsiteHour}
                  onChange={(v) => setOffsiteHour(v)}
                  placeholder="انتخاب ساعت"
                  options={Array.from({ length: 13 }, (_, i) => 8 + i).map((h) => ({
                    value: String(h).padStart(2, "0") + ":00",
                    label: faNum(String(h).padStart(2, "0")) + ":۰۰",
                  }))}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={findSlots} className="w-full sm:w-auto">
                  ثبت زمان جلسه بیرونی
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Step 3: slot + room */}
      {slot && (
        <div id="meeting-step-room">
        <Card>
          <CardHeader title="۳. انتخاب زمان و اتاق" />
          <CardBody className="space-y-4">
            <div className="rounded-md bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-[13px] font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                زمان پیشنهادی: {formatClockInTz(new Date(slot.start), orgTz)} تا {formatClockInTz(new Date(slot.end), orgTz)}
              </p>
              <p className="mt-1 pr-6 text-[11px] text-emerald-600">
                {soloType ? "شما در این بازه آزاد هستید" : "همه افراد انتخابی در این بازه آزاد هستند"}
              </p>
            </div>

            <div>
              {offsite ? (
                <p className="mb-2 text-[12px] font-medium text-amber-800">📍 جلسه در محل «{offsiteOrg.trim() || "سازمان مقصد"}» — اتاقی رزرو نمی‌شود</p>
              ) : (
              <p className="mb-2 text-[12px] font-medium">اتاق مناسب (مرتب‌شده بر اساس ظرفیت — کمترین ظرفیت کافی در اولویت است):</p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {[...slot.availableRooms]
                  .sort((a, b) => {
                    if (meetingType === "ONLINE") {
                      const av = a.equipment.includes("VIDEO_CONFERENCE") ? 0 : 1;
                      const bv = b.equipment.includes("VIDEO_CONFERENCE") ? 0 : 1;
                      if (av !== bv) return av - bv;
                    }
                    const target = soloType ? 1 : people.length + 1;
                    return Math.abs(a.capacity - target) - Math.abs(b.capacity - target);
                  })
                  .map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoomId(r.id)}
                      className={cn(
                        "rounded-md border p-3 text-right transition-colors",
                        roomId === r.id ? "border-ink bg-paper-soft" : "border-line hover:border-ink-faint",
                      )}
                    >
                      <p className="text-[13px] font-medium">{r.name}</p>
                      <p className="mt-1 text-[11px] text-ink-soft">
                        ظرفیت: {faNum(r.capacity)} نفر
                        {r.equipment.length > 0 && ` · ${r.equipment.map((e) => EQUIPMENT_FA[e] ?? e).join("، ")}`}
                      </p>
                    </button>
                  ))}
              </div>
            </div>

            {/* Guests (external) */}
            {!soloType && (
            <div>
              <p className="mb-2 text-[12px] font-medium">مهمان‌های خارجی اضافی (افراد خارجی بالا خودکار مهمان محسوب می‌شوند)</p>
              {guests.map((g, i) => (
                <div key={i} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <input placeholder="نام" value={g.name} onChange={(e) => setGuests(guests.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
                  <input placeholder="شرکت" value={g.company} onChange={(e) => setGuests(guests.map((x, j) => j === i ? { ...x, company: e.target.value } : x))} className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
                  <FaInput allow="phone" placeholder="تلفن" value={g.phone} onChange={(phone) => setGuests(guests.map((x, j) => j === i ? { ...x, phone } : x))} />
                  <input placeholder="ایمیل" dir="ltr" value={g.email} onChange={(e) => setGuests(guests.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setGuests(guests.filter((_, j) => j !== i))}>حذف</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setGuests([...guests, { name: "", company: "", phone: "", email: "" }])}>
                + افزودن مهمان
              </Button>
            </div>
            )}

            {/* Review */}
            <div className="rounded-md border border-line bg-paper-soft p-4 text-[12px] leading-6">
              <p className="font-bold">بازبینی نهایی</p>
              <p>عنوان: {title}</p>
              <p>زمان: {formatJalali(new Date(slot.start), { withTime: true, monthName: true })} تا {formatClockInTz(new Date(slot.end), orgTz)}</p>
              <p>اتاق: {selectedRoom?.name} ({faNum(selectedRoom?.capacity ?? 0)} نفر)</p>
              {recurrenceFreq !== "NONE" && (
                <p>
                  تکرار: {describeRecurrence({
                    freq: recurrenceFreq,
                    interval: recurrenceInterval,
                    byWeekday: recurrenceFreq === "WEEKLY" ? recurrenceWeekdays : undefined,
                  })}
                  {recurrencePreview.length > 0 ? ` · ${faNum(recurrencePreview.length)} نوبت` : ""}
                </p>
              )}
              <p>نوع: {TYPE_FA[meetingType] ?? meetingType}</p>
              {videoUrl.trim() && (
                <p>
                  لینک ویدئو:{" "}
                  {isVideoProvider(videoProvider) ? VIDEO_PROVIDER_FA[videoProvider] : VIDEO_PROVIDER_FA.CUSTOM}
                  {" · "}
                  <span dir="ltr">{videoUrl.trim()}</span>
                </p>
              )}
              <p>
                افراد:{" "}
                {soloType
                  ? "فقط برگزارکننده"
                  : `${faNum(people.filter((p) => p.kind === "INTERNAL").length + 1)} نفر داخلی${people.filter((p) => p.kind === "EXTERNAL").length + guests.filter((g) => g.name).length > 0 ? ` + ${faNum(people.filter((p) => p.kind === "EXTERNAL").length + guests.filter((g) => g.name).length)} مهمان` : ""}`}
              </p>
              {(people.filter((p) => p.kind === "EXTERNAL").length > 0 || guests.filter((g) => g.name).length > 0) && (
                <p className="mt-1 text-amber-600">⚠ این جلسه به دلیل داشتن مهمان خارجی نیازمند تأیید اپراتور است.</p>
              )}
            </div>

            <Button onClick={() => submit()} loading={submitting} size="lg" className="w-full">
              ارسال درخواست جلسه
            </Button>
          </CardBody>
        </Card>
        </div>
      )}

      <Modal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        title="اتاق در این بازه پر است"
        subtitle="می‌توانید در لیست انتظار بمانید؛ تا قطعی کردن، اتاق قفل نمی‌شود"
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => submit({ waitlistIfBusy: true })} loading={submitting}>
              پیوستن به لیست انتظار
            </Button>
            <Button variant="ghost" onClick={() => setWaitlistOpen(false)}>
              انصراف
            </Button>
          </div>
        }
      >
        <p className="text-[13px] leading-6 text-ink-soft">
          اگر جلسهٔ فعلی لغو یا جابه‌جا شود، نفر اول صف اعلان می‌گیرد و{" "}
          {faNum(15)} دقیقه مهلت دارد رزرو را قطعی کند.
          {waitlistCount > 0
            ? ` الان ${faNum(waitlistCount)} نفر در همین بازه منتظرند.`
            : " شما نفر اول این بازه خواهید بود."}
        </p>
      </Modal>
    </div>
  );
}
