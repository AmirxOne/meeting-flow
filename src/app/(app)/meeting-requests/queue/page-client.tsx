"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, CalendarPlus, XCircle, Users } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";
import { faNum, formatJalali } from "@/lib";
import { StatusChip } from "@/components/ui/request-status";

const URGENCY_FA: Record<string, string> = {
  URGENT: "فوری",
  NORMAL: "معمولی",
  FLEXIBLE: "منعطف",
};

type Req = {
  id: string;
  title: string;
  description: string | null;
  urgency: string;
  durationMin: number;
  participantIds: string[];
  status: string;
  createdAt: string;
  requester: { id: string; fullName: string } | null;
  guestName: string | null;
  guestPhone: string | null;
  guestCompany: string | null;
  meeting: { id: string; title: string; startAt: string } | null;
};

/** Admin/operator queue: employees' requests → schedule the real meeting. */
export function RequestQueuePage() {
  const { push } = useToast();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [scheduling, setScheduling] = useState<Req | null>(null);

  const { data } = useQuery({
    queryKey: ["meeting-requests", "all"],
    queryFn: () => api<{ items: Req[]; total: number }>("/api/meeting-requests?scope=all"),
  });

  async function reject(r: Req) {
    if (!confirm(`درخواست «${r.title}» رد شود؟`)) return;
    try {
      await api(`/api/meeting-requests/${r.id}`, { method: "PATCH", json: { action: "reject" } });
      push("درخواست رد شد", "success");
      qc.invalidateQueries({ queryKey: ["meeting-requests"] });
    } catch (e) {
      push((e as Error).message, "error");
    }
  }

  const items = data?.items ?? [];
  const open = items.filter((r) => r.status === "OPEN");
  const done = items.filter((r) => r.status !== "OPEN");

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="text-[18px] font-bold">هماهنگی درخواست‌های جلسه</h1>
        <p className="mt-1 text-[12px] text-ink-soft">
          درخواست‌های کارکنان — زمان و اتاق را شما تعیین می‌کنید
        </p>
      </div>

      <Card>
        <CardHeader title={`در انتظار هماهنگی (${faNum(open.length)})`} />
        <CardBody>
          {open.length === 0 ? (
            <EmptyState
              title="درخواست بازی نیست"
              description="هر زمان کارمندی درخواست جلسه بدهد، این‌جا می‌آید"
            />
          ) : (
            <div className="space-y-3">
              {open.map((r) => (
                <div key={r.id} className="rounded-lg border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold">{r.title}</p>
                      <p className="mt-1 text-[12px] text-ink-soft">
                        درخواست‌کننده:{" "}
                        {r.requester ? (
                          r.requester.fullName
                        ) : (
                          <span className="font-medium text-amber-700">
                            🌐 مهمان: {r.guestName}
                            {r.guestCompany ? ` (${r.guestCompany})` : ""} · {r.guestPhone}
                          </span>
                        )}{" "}
                        ·{" "}
                        <span className={r.urgency === "URGENT" ? "font-bold text-red-600" : ""}>
                          {URGENCY_FA[r.urgency] ?? r.urgency}
                        </span>{" "}
                        · حدود {faNum(Math.round((r.durationMin / 60) * 10) / 10)} ساعت
                      </p>
                      {r.participantIds.length > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-faint">
                          <Users className="h-3 w-3" />
                          {faNum(r.participantIds.length)} نفر شرکت‌کننده درخواست شده
                        </p>
                      )}
                      {r.description && (
                        <p className="mt-2 rounded-md bg-paper-soft p-2 text-[12px] leading-5 text-ink-soft">
                          {r.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {r.requester && (
                        <Button onClick={() => setScheduling(r)}>
                          <CalendarPlus className="h-4 w-4" />
                          زمان‌بندی جلسه
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => reject(r)}>
                        <XCircle className="h-4 w-4" />
                        رد
                      </Button>
                    </div>
                  </div>

                  {scheduling?.id === r.id && (
                    <ScheduleForm
                      r={r}
                      onDone={() => {
                        setScheduling(null);
                        qc.invalidateQueries({ queryKey: ["meeting-requests"] });
                      }}
                      onCancel={() => setScheduling(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {done.length > 0 && (
        <Card>
          <CardHeader title="پردازش‌شده" />
          <CardBody className="space-y-2">
            {done.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{r.title}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {r.requester ? r.requester.fullName : `مهمان: ${r.guestName ?? "—"}`}
                    {r.meeting && (
                      <>
                        {" · جلسه: "}
                        {formatJalali(new Date(r.meeting.startAt), { withTime: true })}
                      </>
                    )}
                  </p>
                </div>
                <StatusChip status={r.status} />
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/** Inline scheduling form: branch + room + datetime → POST schedule. */
function ScheduleForm({ r, onDone, onCancel }: { r: Req; onDone: () => void; onCancel: () => void }) {
  const { push } = useToast();
  const [branchId, setBranchId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [startIso, setStartIso] = useState("");
  const [startTime, setStartTime] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<{ branches: { id: string; name: string }[] }>("/api/branches"),
  });
  const { data: rooms } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => api<{ rooms: { id: string; name: string; capacity: number }[] }>("/api/rooms"),
  });

  const branchRooms = (rooms?.rooms ?? []).filter(
    (room) => !branchId || (room as { branchId?: string }).branchId === branchId,
  );

  async function schedule() {
    if (!startIso || !startTime || !roomId) {
      push("تاریخ، ساعت و اتاق را انتخاب کنید", "error");
      return;
    }
    // Tehran local → UTC (offset +03:30 fixed)
    const [y, m, d] = startIso.split("-").map(Number);
    const [hh, mm] = startTime.split(":").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d, hh - 3, mm - 30, 0));
    const end = new Date(start.getTime() + r.durationMin * 60000);
    setBusy(true);
    try {
      const res = await api<{ meeting: { id: string } }>(
        `/api/meeting-requests/${r.id}/schedule`,
        {
          method: "POST",
          json: {
            branchId: branchId || (rooms?.rooms ?? []).find((x) => x.id === roomId)?.id
              ? ((rooms?.rooms ?? []).find((x) => x.id === roomId) as { branchId?: string })?.branchId ?? ""
              : "",
            roomId,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
          },
        },
      );
      push("جلسه زمان‌بندی شد و دعوت‌ها ارسال گردید ✓", "success");
      onDone();
    } catch (e) {
      push((e as Error).message || "خطا در زمان‌بندی", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-dashed border-line bg-paper-soft/50 p-4">
      <p className="text-[12px] font-bold">هماهنگی جلسه</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-medium">شعبه</label>
          <Select
            value={branchId}
            onChange={(v) => {
              setBranchId(v);
              setRoomId("");
            }}
            placeholder="انتخاب شعبه"
            options={(branches?.branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium">اتاق</label>
          <Select
            value={roomId}
            onChange={(v) => setRoomId(v)}
            placeholder="انتخاب اتاق"
            options={branchRooms.map((room) => ({
              value: room.id,
              label: `${room.name} (${faNum(room.capacity)} نفر)`,
            }))}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-medium">تاریخ</label>
          <JalaliDatePicker value={startIso} onChange={(v) => setStartIso(v)} />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium">ساعت</label>
          <Select
            value={startTime}
            onChange={(v) => setStartTime(v)}
            placeholder="انتخاب ساعت"
            options={Array.from({ length: 24 }, (_, h) => ({
              value: String(h).padStart(2, "0") + ":00",
              label: faNum(String(h).padStart(2, "0")) + ":۰۰",
            }))}
          />
        </div>
      </div>
      <p className="text-[11px] text-ink-faint">
        مدت: {faNum(r.durationMin)} دقیقه · برگزارکننده: {r.requester?.fullName ?? "—"} (درخواست‌دهنده) ·
        شرکت‌کنندگان درخواست‌شده خودکار دعوت می‌شوند
      </p>
      <div className="flex gap-2">
        <Button onClick={schedule} disabled={busy}>
          {busy ? "در حال ثبت…" : "ثبت نهایی جلسه"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          انصراف
        </Button>
      </div>
    </div>
  );
}
