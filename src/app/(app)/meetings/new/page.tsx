"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, AlertTriangle, Sparkles } from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, faNum, faStr, formatJalali, toJalali, EQUIPMENT_FA, TYPE_FA } from "@/lib";

interface Slot {
  start: string;
  end: string;
  availableRooms: { id: string; name: string; capacity: number; equipment: string[] }[];
  conflicts: { userId: string; userName: string; meetingTitle: string }[];
}

export default function NewMeetingPage() {
  const router = useRouter();
  const { push } = useToast();

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingType, setMeetingType] = useState("INTERNAL");
  const [branchId, setBranchId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [durationMin, setDurationMin] = useState(30);
  const [dateIso, setDateIso] = useState(""); // gregorian iso from jalali picker
  const [slot, setSlot] = useState<Slot | null>(null);
  const [roomId, setRoomId] = useState("");
  const [guests, setGuests] = useState<{ name: string; company: string; phone: string; email: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: { id: string; name: string }[] }>("/api/branches"),
  });
  const { data: usersData } = useQuery({
    queryKey: ["users-lite"],
    queryFn: () => api<{ users: { id: string; fullName: string; jobTitle: string | null; department: string | null }[] }>("/api/users"),
  });

  const branches = branchesData?.branches ?? [];
  const users = (usersData?.users ?? []).filter((u) => u.id);

  // Jalali date state
  const today = toJalali(new Date());
  const [jy, setJy] = useState(today.jy);
  const [jm, setJm] = useState(today.jm);
  const [jd, setJd] = useState(today.jd);

  async function findSlots() {
    if (!branchId || !title.trim()) {
      push("عنوان و شعبه را انتخاب کنید", "error");
      return;
    }
    setSearching(true);
    setSlot(null);
    setRoomId("");
    try {
      // build UTC window for selected Jalali day
      const [gy, gm, gd] = jalaliToIso(jy, jm, jd);
      const from = new Date(Date.UTC(gy, gm - 1, gd, 0, 0) - 210 * 60000);
      const to = new Date(from.getTime() + 86400000);
      const data = await api<{ slots: Slot[] }>("/api/availability", {
        method: "POST",
        json: {
          branchId,
          participantIds,
          durationMin,
          from: from.toISOString(),
          to: to.toISOString(),
          minCapacity: participantIds.length + 1,
        },
      });
      if (data.slots.length === 0) push("هیچ زمان آزادی برای این روز یافت نشد", "error");
      else {
        setSlot(data.slots[0]);
        // smart room suggestion: smallest capacity that fits
        const best = [...data.slots[0].availableRooms].sort(
          (a, b) => a.capacity - b.capacity,
        )[0];
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
      const data = await api<{ meeting: { id: string } }>("/api/meetings", {
        method: "POST",
        json: {
          title: title.trim(),
          description: description.trim() || undefined,
          branchId,
          roomId,
          startAt: new Date(slot.start).toISOString(),
          endAt: new Date(slot.end).toISOString(),
          meetingType,
          participantIds,
          guests: guests
            .filter((g) => g.name.trim())
            .map((g) => ({
              name: g.name.trim(),
              company: g.company.trim() || undefined,
              phone: g.phone.trim() || undefined,
              email: g.email.trim() || undefined,
            })),
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

  const monthNames = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];

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
              className="h-11 w-full rounded-xl border border-[#d9d9e0] px-3.5 text-[13px] outline-none focus:border-ink focus:ring-2 focus:ring-ink/15"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">نوع جلسه</label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#d9d9e0] bg-white px-3 text-[13px] outline-none focus:border-ink"
              >
                {Object.entries(TYPE_FA).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">شعبه</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#d9d9e0] bg-white px-3 text-[13px] outline-none focus:border-ink"
              >
                <option value="">انتخاب شعبه…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">افراد ({faNum(participantIds.length)} نفر انتخاب شده)</label>
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-line p-2.5 max-h-40 overflow-y-auto">
              {users.map((u) => {
                const selected = participantIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      setParticipantIds((prev) =>
                        selected ? prev.filter((x) => x !== u.id) : [...prev, u.id],
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                      selected ? "border-ink bg-ink text-white" : "border-line text-ink-soft hover:border-ink-faint",
                    )}
                  >
                    {u.fullName}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">توضیحات (اختیاری)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-[#d9d9e0] px-3.5 py-2.5 text-[13px] outline-none focus:border-ink"
            />
          </div>
        </CardBody>
      </Card>

      {/* Step 2: date + duration + find slots */}
      <Card>
        <CardHeader title="۲. تاریخ و مدت" subtitle="سیستم زمان‌های آزاد مشترک همه افراد را پیدا می‌کند" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">سال</label>
              <select value={jy} onChange={(e) => setJy(Number(e.target.value))} className="h-11 w-full rounded-xl border border-[#d9d9e0] bg-white px-3 text-[13px]">
                {[0, 1].map((d) => (
                  <option key={d} value={today.jy + d}>{faNum(today.jy + d)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">ماه</label>
              <select value={jm} onChange={(e) => setJm(Number(e.target.value))} className="h-11 w-full rounded-xl border border-[#d9d9e0] bg-white px-3 text-[13px]">
                {monthNames.map((name, i) => (
                  <option key={i} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">روز</label>
              <select value={jd} onChange={(e) => setJd(Number(e.target.value))} className="h-11 w-full rounded-xl border border-[#d9d9e0] bg-white px-3 text-[13px]">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{faNum(d)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">مدت (دقیقه)</label>
              <select value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className="h-11 w-full rounded-xl border border-[#d9d9e0] bg-white px-3 text-[13px]">
                {[15, 30, 45, 60, 90, 120].map((d) => (
                  <option key={d} value={d}>{faNum(d)}</option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={findSlots} loading={searching} className="w-full sm:w-auto">
            <Sparkles className="h-4 w-4" />
            یافتن زمان‌های آزاد
          </Button>
        </CardBody>
      </Card>

      {/* Step 3: slot + room */}
      {slot && (
        <Card>
          <CardHeader title="۳. انتخاب زمان و اتاق" />
          <CardBody className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-[13px] font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                زمان پیشنهادی: {tehranTime(slot.start)} تا {tehranTime(slot.end)}
              </p>
              <p className="mt-1 pr-6 text-[11px] text-emerald-600">همه افراد انتخابی در این بازه آزاد هستند</p>
            </div>

            <div>
              <p className="mb-2 text-[12px] font-medium">اتاق مناسب (مرتب‌شده بر اساس ظرفیت — کمترین ظرفیت کافی در اولویت است):</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[...slot.availableRooms]
                  .sort((a, b) => a.capacity - (participantIds.length + 1) - (b.capacity - (participantIds.length + 1)) * -1)
                  .sort((a, b) => Math.abs(a.capacity - (participantIds.length + 1)) - Math.abs(b.capacity - (participantIds.length + 1)))
                  .map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoomId(r.id)}
                      className={cn(
                        "rounded-xl border p-3 text-right transition-colors",
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
            <div>
              <p className="mb-2 text-[12px] font-medium">مهمان‌های خارجی (اختیاری — نیاز به تأیید دارد)</p>
              {guests.map((g, i) => (
                <div key={i} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <input placeholder="نام" value={g.name} onChange={(e) => setGuests(guests.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="h-10 rounded-xl border border-line px-3 text-[12px] outline-none focus:border-ink" />
                  <input placeholder="شرکت" value={g.company} onChange={(e) => setGuests(guests.map((x, j) => j === i ? { ...x, company: e.target.value } : x))} className="h-10 rounded-xl border border-line px-3 text-[12px] outline-none focus:border-ink" />
                  <input placeholder="تلفن" dir="ltr" value={g.phone} onChange={(e) => setGuests(guests.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} className="h-10 rounded-xl border border-line px-3 text-[12px] outline-none focus:border-ink" />
                  <input placeholder="ایمیل" dir="ltr" value={g.email} onChange={(e) => setGuests(guests.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} className="h-10 rounded-xl border border-line px-3 text-[12px] outline-none focus:border-ink" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setGuests(guests.filter((_, j) => j !== i))}>حذف</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setGuests([...guests, { name: "", company: "", phone: "", email: "" }])}>
                + افزودن مهمان
              </Button>
            </div>

            {/* Review */}
            <div className="rounded-xl border border-line bg-paper-soft p-4 text-[12px] leading-6">
              <p className="font-bold">بازبینی نهایی</p>
              <p>عنوان: {title}</p>
              <p>زمان: {formatJalali(new Date(slot.start), { withTime: true, monthName: true })} تا {tehranTime(slot.end)}</p>
              <p>اتاق: {selectedRoom?.name} ({faNum(selectedRoom?.capacity ?? 0)} نفر)</p>
              <p>افراد: {faNum(participantIds.length + 1)} نفر داخلی{guests.filter((g) => g.name).length > 0 ? ` + ${faNum(guests.filter((g) => g.name).length)} مهمان` : ""}</p>
              {guests.filter((g) => g.name).length > 0 && (
                <p className="mt-1 text-amber-600">⚠ این جلسه به دلیل داشتن مهمان خارجی نیازمند تأیید اپراتور است.</p>
              )}
            </div>

            <Button onClick={submit} loading={submitting} size="lg" className="w-full">
              ارسال درخواست جلسه
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function tehranTime(iso: string): string {
  const d = new Date(iso);
  const t = new Date(d.getTime() + 210 * 60000);
  return faStr(`${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`);
}

function jalaliToIso(jy: number, jm: number, jd: number): [number, number, number] {
  // reuse lib via dynamic import at module scope is awkward; inline minimal conversion
  // using the algorithm from lib/jalali (toGregorian)
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0], jump = 0;
  for (let i = 1; i < bl; i += 1) {
    const jm2 = breaks[i];
    jump = jm2 - jp;
    if (jy < jm2) break;
    leapJ += Math.floor(jump / 33) * 8 + Math.floor((jump % 33) / 4);
    jp = jm2;
  }
  let n = jy - jp;
  leapJ += Math.floor(n / 33) * 8 + Math.floor(((n % 33) + 3) / 4);
  if (jump % 33 === 4 && jump - n === 4) leapJ += 1;
  const leapG = Math.floor(gy / 4) - Math.floor((Math.floor(gy / 100) + 1) * 3 / 4) - 150;
  const march = 20 + leapJ - leapG;
  // day-of-year
  const doy = (jm - 1) * 31 - Math.floor(jm / 7) * (jm - 7) + jd - 1;
  const date = new Date(Date.UTC(gy, 2, march)); // March
  const g = new Date(date.getTime() + doy * 86400000);
  return [g.getUTCFullYear(), g.getUTCMonth() + 1, g.getUTCDate()];
}
