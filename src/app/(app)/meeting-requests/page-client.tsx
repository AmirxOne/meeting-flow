"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, ArrowLeft } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PeoplePicker, type PickedPerson } from "@/components/ui/people-picker";
import { useToast } from "@/components/ui/toast";
import { faNum } from "@/lib";
import { StatusChip, MyRequest } from "@/components/ui/request-status";

const URGENCY_FA: Record<string, string> = {
  URGENT: "فوری — در اسرع وقت",
  NORMAL: "معمولی",
  FLEXIBLE: "منعطف — هر زمان مناسب",
};

/** Employee page: «ما به چنین جلسه‌ای نیاز داریم» — the admin schedules it. */
export function MeetingRequestForm() {
  const { push } = useToast();
  const qc = useQueryClient();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("NORMAL");
  const [durationMin, setDurationMin] = useState("60");
  const [participants, setParticipants] = useState<PickedPerson[]>([]);
  const [busy, setBusy] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  // my past requests
  const { data } = useQuery({
    queryKey: ["meeting-requests", "mine"],
    queryFn: () => api<{ items: MyRequest[]; total: number }>("/api/meeting-requests"),
  });

  async function submit() {
    if (title.trim().length < 2) {
      push("عنوان درخواست را بنویسید", "error");
      return;
    }
    setBusy(true);
    try {
      await api("/api/meeting-requests", {
        method: "POST",
        json: {
          title: title.trim(),
          description: description.trim() || undefined,
          urgency,
          isPrivate,
          durationMin: Number(durationMin),
          participantIds: participants
            .filter((p) => p.ref.startsWith("user:"))
            .map((p) => p.ref.slice(5)),
        },
      });
      push("درخواست جلسه ثبت شد — هماهنگی با مدیریت انجام می‌شود", "success");
      setTitle("");
      setDescription("");
      setParticipants([]);
      qc.invalidateQueries({ queryKey: ["meeting-requests"] });
    } catch (e) {
      push((e as Error).message || "خطا در ثبت درخواست", "error");
    } finally {
      setBusy(false);
    }
  }

  const mine = data?.items ?? [];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold">درخواست جلسه</h1>
          <p className="mt-1 text-[12px] leading-6 text-ink-soft">
            روش اصلی همه‌ی همکاران: نیازتان را این‌جا ثبت کنید (موضوع، افراد، فوریت) —
            <span className="font-medium text-ink"> مدیریت زمان و اتاق را هماهنگ و اولویت‌بندی می‌کند</span> و نتیجه با اعلان می‌رسد.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader title="جزئیات درخواست" />
        <CardBody className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">موضوع جلسه</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: بررسی بودجه بازاریابی سه‌ماهه"
              className="h-11 w-full rounded-md border border-line px-3.5 text-[13px] outline-none focus:border-ink focus:ring-2 focus:ring-ink/15"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">توضیح نیاز (اختیاری)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="چه چیزی باید در این جلسه تصمیم گرفته شود؟"
              className="w-full rounded-md border border-line p-3 text-[13px] outline-none focus:border-ink focus:ring-2 focus:ring-ink/15"
            />
          </div>
          <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-md border border-line bg-white px-3.5">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="h-4 w-4 accent-black" />
            <span className="text-[12px]">جلسه محرمانه — موضوع و جزئیات فقط برای خودم، دعوت‌شدگان و مدیریت دیده می‌شود</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">فوریت</label>
              <Select
                value={urgency}
                onChange={(v) => setUrgency(v)}
                options={Object.entries(URGENCY_FA).map(([v, l]) => ({ value: v, label: l }))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">مدت تقریبی</label>
              <Select
                value={durationMin}
                onChange={(v) => setDurationMin(v)}
                options={[
                  { value: "30", label: "۳۰ دقیقه" },
                  { value: "60", label: "۱ ساعت" },
                  { value: "90", label: "۱.۵ ساعت" },
                  { value: "120", label: "۲ ساعت" },
                ]}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">افراد مورد نیاز (اختیاری)</label>
            <PeoplePicker
              value={participants}
              onChange={(next) => setParticipants(next)}
              placeholder="با چه کسانی می‌خواهید جلسه داشته باشید؟"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={busy}>
              <ArrowLeft className="h-4 w-4" />
              {busy ? "در حال ثبت…" : "ثبت درخواست"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="درخواست‌های من" />
        <CardBody>
          {mine.length === 0 ? (
            <EmptyState
              title="هنوز درخواستی ثبت نکرده‌اید"
              description="فرم بالا را پر کنید تا مدیریت زمان آن را هماهنگ کند"
            />
          ) : (
            <div className="space-y-2">
              {mine.map((r) => (
                <RequestRow key={r.id} r={r} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function RequestRow({ r }: { r: MyRequest }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium">{r.title}</p>
        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-faint">
          <Clock className="h-3 w-3" />
          {faNum(Math.round(r.durationMin / 60) || 1)} ساعت · {URGENCY_FA[r.urgency] ?? r.urgency}
        </p>
      </div>
      <StatusChip status={r.status} />
    </div>
  );
}


