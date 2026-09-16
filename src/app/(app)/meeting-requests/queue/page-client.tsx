"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarPlus, XCircle, Users, Pencil, CheckCircle2, Clock, Building2 } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
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
  isPrivate: boolean;
  description: string | null;
  urgency: string;
  durationMin: number;
  participantIds: string[];
  attendeeCount: number | null;
  prefFrom: string | null;
  prefTo: string | null;
  venue: string;
  offsiteOrg: string | null;
  offsiteNote: string | null;
  status: string;
  adminNote: string | null;
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
  const [scheduling, setScheduling] = useState<Req | null>(null);
  const [rejecting, setRejecting] = useState<Req | null>(null);
  const [editing, setEditing] = useState<Req | null>(null);

  const { data } = useQuery({
    queryKey: ["meeting-requests", "all"],
    queryFn: () => api<{ items: Req[]; total: number }>("/api/meeting-requests?scope=all"),
  });

  const items = data?.items ?? [];
  const open = items.filter((r) => r.status === "OPEN");
  const done = items.filter((r) => r.status !== "OPEN");
  const refresh = () => qc.invalidateQueries({ queryKey: ["meeting-requests"] });

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="text-[18px] font-bold">هماهنگی درخواست‌های جلسه</h1>
        <p className="mt-1 text-[12px] text-ink-soft">
          درخواست‌های کارکنان و مهمان‌ها — تأیید، ویرایش، زمان‌بندی یا رد
        </p>
      </div>

      <Card>
        <CardHeader title={`در انتظار هماهنگی (${faNum(open.length)})`} />
        <CardBody>
          {open.length === 0 ? (
            <EmptyState
              title="درخواست بازی نیست"
              description="هر زمان کارمند یا مهمانی درخواست جلسه بدهد، این‌جا می‌آید"
            />
          ) : (
            <div className="space-y-3">
              {open.map((r) => (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.22, 0.8, 0.36, 1] }}
                  className="rounded-lg border border-line p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[14px] font-bold">
                        {r.isPrivate && (
                          <span className="rounded bg-ink px-1.5 py-0.5 text-[9.5px] font-bold text-white">محرمانه</span>
                        )}
                        {r.title}
                      </p>
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
                        {r.attendeeCount ? ` · ${faNum(r.attendeeCount)} نفر حاضر` : ""}
                      </p>
                      {r.participantIds.length > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-faint">
                          <Users className="h-3 w-3" />
                          {faNum(r.participantIds.length)} نفر شرکت‌کننده درخواست شده
                        </p>
                      )}
                      {r.venue === "OFFSITE" && (
                        <p className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-ink/25 bg-paper-soft px-2.5 py-1.5 text-[11.5px] font-medium text-ink">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          بیرون از شرکت — در محل «{r.offsiteOrg}»
                          {r.offsiteNote ? ` (${r.offsiteNote})` : ""}
                          <span className="text-ink-faint">· اتاق لازم ندارد؛ ساعت را هماهنگ کنید</span>
                        </p>
                      )}
                      {(r.prefFrom || r.prefTo) && (
                        <p className="mt-2 flex items-center gap-1.5 rounded-md border border-dashed border-ink/30 bg-amber-50/60 px-2.5 py-1.5 text-[11.5px] font-medium text-amber-800">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          بازه‌ی درخواستی: {formatJalali(new Date(r.prefFrom!), { withTime: true })}
                          {r.prefTo ? ` تا ${formatJalali(new Date(r.prefTo), { withTime: true }).split(" — ")[1] ?? formatJalali(new Date(r.prefTo), { withTime: true })}` : ""}
                        </p>
                      )}
                      {r.description && (
                        <p className="mt-2 rounded-md bg-paper-soft p-2 text-[12px] leading-5 text-ink-soft">
                          {r.description}
                        </p>
                      )}
                      <p className="mt-1.5 text-[10.5px] text-ink-faint">
                        ثبت: {formatJalali(new Date(r.createdAt), { withTime: true })}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button onClick={() => setScheduling(r)}>
                        <CalendarPlus className="h-4 w-4" />
                        زمان‌بندی و تأیید
                      </Button>
                      <Button variant="outline" onClick={() => setEditing(r)}>
                        <Pencil className="h-4 w-4" />
                        ویرایش
                      </Button>
                      <Button variant="outline" onClick={() => setRejecting(r)}>
                        <XCircle className="h-4 w-4" />
                        رد
                      </Button>
                    </div>
                  </div>

                  {scheduling?.id === r.id && (
                    <ScheduleForm r={r} onDone={() => { setScheduling(null); refresh(); }} onCancel={() => setScheduling(null)} />
                  )}
                </motion.div>
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
                    {r.adminNote ? ` · یادداشت: ${r.adminNote}` : ""}
                  </p>
                </div>
                <StatusChip status={r.status} />
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* reject modal (with reason) */}
      <RejectModal req={rejecting} onClose={() => setRejecting(null)} onDone={refresh} />
      {/* edit modal */}
      <EditModal req={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refresh(); }} />
    </div>
  );
}

/* ── reject with reason ── */
function RejectModal({ req, onClose, onDone }: { req: Req | null; onClose: () => void; onDone: () => void }) {
  const { push } = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function reject() {
    if (!req) return;
    setBusy(true);
    try {
      await api(`/api/meeting-requests/${req.id}`, {
        method: "PATCH",
        json: { action: "reject", adminNote: reason.trim() || null },
      });
      push("درخواست رد شد", "success");
      onClose();
      setReason("");
      onDone();
    } catch (e) {
      push((e as Error).message || "خطا در رد درخواست", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!req} onClose={onClose} title="رد درخواست">
      {req && (
        <div className="space-y-4">
          <p className="text-[13px] leading-6">
            درخواست «<span className="font-bold">{req.title}</span>»
            {req.requester ? ` از ${req.requester.fullName}` : ` از مهمان ${req.guestName ?? ""}`} رد شود؟
          </p>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">دلیل رد (اختیاری — برای اطلاع درخواست‌کننده)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="مثلاً: موضوع خارج از حدود اختیارات است"
              className="w-full rounded-md border border-[#d9d9e0] p-3 text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={reject} disabled={busy} className="!bg-red-600 hover:!bg-red-700">
              <XCircle className="h-4 w-4" />
              {busy ? "در حال ثبت…" : "رد قطعی"}
            </Button>
            <Button variant="outline" onClick={onClose}>انصراف</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ── edit before approve ── */
function EditModal({ req, onClose, onDone }: { req: Req | null; onClose: () => void; onDone: () => void }) {
  const { push } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("NORMAL");
  const [durationMin, setDurationMin] = useState("60");
  const [busy, setBusy] = useState(false);

  // sync when a different request opens
  const reqId = req?.id ?? null;
  const [syncedId, setSyncedId] = useState<string | null>(null);
  if (reqId && syncedId !== reqId) {
    setSyncedId(reqId);
    setTitle(req!.title);
    setDescription(req!.description ?? "");
    setUrgency(req!.urgency);
    setDurationMin(String(req!.durationMin));
  }

  async function save() {
    if (!req) return;
    if (title.trim().length < 2) {
      push("عنوان را کامل کنید", "error");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/meeting-requests/${req.id}`, {
        method: "PATCH",
        json: { action: "update", title: title.trim(), description: description.trim(), urgency, durationMin: Number(durationMin) },
      });
      push("درخواست ویرایش شد — حالا می‌توانید زمان‌بندی کنید", "success");
      onClose();
      onDone();
    } catch (e) {
      push((e as Error).message || "خطا در ویرایش", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!req} onClose={onClose} title="ویرایش و تأیید درخواست">
      {req && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">عنوان جلسه</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium">توضیحات</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-[#d9d9e0] p-3 text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">فوریت</label>
              <Select
                value={urgency}
                onChange={(v) => setUrgency(v)}
                options={Object.entries(URGENCY_FA).map(([v, l]) => ({ value: v, label: l }))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium">مدت</label>
              <Select
                value={durationMin}
                onChange={(v) => setDurationMin(v)}
                options={[
                  { value: "30", label: "۳۰ دقیقه" },
                  { value: "45", label: "۴۵ دقیقه" },
                  { value: "60", label: "۱ ساعت" },
                  { value: "90", label: "۱.۵ ساعت" },
                  { value: "120", label: "۲ ساعت" },
                ]}
              />
            </div>
          </div>
          <p className="text-[11px] text-ink-faint">
            <CheckCircle2 className="ml-1 inline h-3.5 w-3.5" />
            بعد از ذخیره، از دکمه‌ی «زمان‌بندی و تأیید» جلسه را قطعی کنید
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={save} disabled={busy}>
              <Pencil className="h-4 w-4" />
              {busy ? "در حال ذخیره…" : "ذخیره تغییرات"}
            </Button>
            <Button variant="outline" onClick={onClose}>انصراف</Button>
          </div>
        </div>
      )}
    </Modal>
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
    const offsite = r.venue === "OFFSITE";
    if (!startIso || !startTime || (!offsite && !roomId)) {
      push(offsite ? "تاریخ و ساعت را انتخاب کنید" : "تاریخ، ساعت و اتاق را انتخاب کنید", "error");
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
            ...(r.venue === "OFFSITE"
              ? {}
              : {
                  branchId: branchId || (rooms?.rooms ?? []).find((x) => x.id === roomId)?.id
                    ? ((rooms?.rooms ?? []).find((x) => x.id === roomId) as { branchId?: string })?.branchId ?? ""
                    : "",
                  roomId,
                }),
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
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 0.8, 0.36, 1] }}
      className="mt-4 overflow-hidden"
    >
      <div className="space-y-3 rounded-lg border border-dashed border-line bg-paper-soft/50 p-4">
        <p className="text-[12px] font-bold">
          هماهنگی جلسه {r.requester ? "" : "مهمان"}
        </p>
        {!r.requester && (
          <p className="rounded-md bg-amber-50 p-2 text-[11px] leading-5 text-amber-800">
            این درخواست از مهمان «{r.guestName}» است — با ثبت نهایی، شما برگزارکننده می‌شوید و مهمان به‌عنوان مهمان خارجی به جلسه اضافه می‌شود.
          </p>
        )}
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
          مدت: {faNum(r.durationMin)} دقیقه · برگزارکننده: {r.requester?.fullName ?? "شما (ادمین — درخواست مهمان)"} ·
          شرکت‌کنندگان درخواست‌شده خودکار دعوت می‌شوند
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={schedule} disabled={busy}>
            {busy ? "در حال ثبت…" : "ثبت نهایی جلسه"}
          </Button>
          <Button variant="outline" onClick={onCancel}>انصراف</Button>
        </div>
      </div>
    </motion.div>
  );
}
