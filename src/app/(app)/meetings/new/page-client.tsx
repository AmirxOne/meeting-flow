"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Sparkles } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, faNum, faStr, formatJalali, isoDateInTz, EQUIPMENT_FA, TYPE_FA, TYPE_HINT_FA, isSoloMeetingType } from "@/lib";
import { formatClockInTz, DEFAULT_ORG_TIMEZONE } from "@/lib/timezone";
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

interface Slot {
  start: string;
  end: string;
  availableRooms: { id: string; name: string; capacity: number; equipment: string[] }[];
  conflicts: { userId: string; userName: string; meetingTitle: string }[];
}

export function NewMeetingPageContent({ searchParams }: { searchParams: NextSearchParams }) {
  const router = useRouter();
  const { push } = useToast();
  const prefilledFromAvailability = useRef(false);

  // form state
  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
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
  const soloType = isSoloMeetingType(meetingType);

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: { id: string; name: string }[] }>("/api/branches"),
  });

  const branches = branchesData?.branches ?? [];

  const { data: brandingData } = useQuery({
    queryKey: ["organization-branding"],
    queryFn: () =>
      api<{ branding: { timezone: string } }>("/api/organization/branding"),
  });
  const orgTz = brandingData?.branding.timezone ?? DEFAULT_ORG_TIMEZONE;

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
    if (!branchId || !title.trim()) {
      push("عنوان و شعبه را انتخاب کنید", "error");
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

  async function submit() {
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
      const data = await api<{ meeting: { id: string } }>("/api/meetings", {
        method: "POST",
        json: {
          title: title.trim(),
          description: description.trim() || undefined,
          isPrivate,
          branchId,
          roomId,
          startAt: new Date(slot.start).toISOString(),
          endAt: new Date(slot.end).toISOString(),
          meetingType,
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
        },
      });
      push("جلسه ایجاد شد", "success");
      router.push(`/meetings/${data.meeting.id}`);
    } catch (e) {
      const err = e as ApiError;
      push(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  const fromAvailability = fromAvailabilityHandoff && !!slot;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 lg:p-6">
      <h1 className="text-lg font-bold">جلسه جدید</h1>

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
                }}
                options={Object.entries(TYPE_FA).map(([value, label]) => ({ value, label }))}
              />
              {TYPE_HINT_FA[meetingType] && (
                <p className="mt-1.5 text-[11px] leading-5 text-ink-soft">{TYPE_HINT_FA[meetingType]}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">شعبه</label>
              <Select
                value={branchId}
                onChange={setBranchId}
                placeholder="انتخاب شعبه…"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
              />
            </div>
          </div>
          
          {soloType ? (
            <div className="rounded-md border border-line bg-paper-soft px-3.5 py-3 text-[12px] leading-6 text-ink-soft">
              {meetingType === "ONLINE"
                ? "این رزرو برای برگزاری جلسه آنلاین از داخل اتاق است — دعوت‌شونده حضوری لازم نیست."
                : "این رزرو فقط برای خودتان است — اتاق در آن بازه به نام شما قفل می‌شود."}
            </div>
          ) : (
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">افراد دعوت‌شده ({faNum(people.length)} نفر — از لیست انتخاب کنید یا نام جدید بنویسید)</label>
            <PeoplePicker value={people} onChange={setPeople} />
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
          {!fromAvailability && (
            <div className="flex justify-end">
              <Button onClick={findSlots} loading={searching} className="w-full sm:w-auto">
                <Sparkles className="h-4 w-4" />
                یافتن زمان‌های آزاد
              </Button>
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
              <p className="mb-2 text-[12px] font-medium">اتاق مناسب (مرتب‌شده بر اساس ظرفیت — کمترین ظرفیت کافی در اولویت است):</p>
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
              <p>نوع: {TYPE_FA[meetingType] ?? meetingType}</p>
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

            <Button onClick={submit} loading={submitting} size="lg" className="w-full">
              ارسال درخواست جلسه
            </Button>
          </CardBody>
        </Card>
        </div>
      )}
    </div>
  );
}
