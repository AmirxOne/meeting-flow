"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check, X, Play, Square, Clock, DoorOpen, UserPlus, History,
  CalendarClock, ExternalLink, Users, UserCheck,
} from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, EmptyState, SkeletonBlock, SkeletonRow } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";
import { cn, faNum, faStr, formatJalali, CANCEL_REASON_FA, RESPONSE_FA } from "@/lib";
import { Select } from "@/components/ui/select";
import { JalaliDatePicker, TimePicker } from "@/components/ui/jalali-date-picker";
import { PeoplePicker, type PickedPerson } from "@/components/ui/people-picker";
import { GuestCheckinPanel } from "@/components/checkin/guest-checkin-panel";
import { CANCEL_REASONS } from "@/lib";

interface MeetingDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  meetingType: string;
  priority: string;
  startAt: string;
  endAt: string;
  isPrivate: boolean;
  cancelReason: string | null;
  cancelNote: string | null;
  organizer: { id: string; fullName: string; jobTitle: string | null };
  room: { id: string; name: string; capacity: number; floor: { name: string } | null } | null;
  branch: { id: string; name: string };
  participants: {
    id: string;
    userId: string;
    role: string;
    responseStatus: string;
    joinedAt: string | null;
    user: { id: string; fullName: string; jobTitle: string | null; department: string | null };
  }[];
  guests: {
    id: string;
    name: string;
    company: string | null;
    phone: string | null;
    email: string | null;
    checkinCode: string | null;
    arrivedAt: string | null;
  }[];
  approvals: {
    id: string;
    action: string;
    reason: string | null;
    createdAt: string;
    actor: { fullName: string } | null;
  }[];
  events: {
    id: string;
    type: string;
    data: unknown;
    createdAt: string;
    actor: { fullName: string } | null;
  }[];
}

const EVENT_FA: Record<string, string> = {
  CREATED: "ایجاد شد",
  APPROVED: "تأیید شد",
  REJECTED: "رد شد",
  CANCELLED: "لغو شد",
  RESCHEDULED: "زمان‌بندی مجدد",
  ROOM_CHANGED: "تغییر اتاق",
  STARTED: "شروع شد",
  ENDED: "پایان یافت",
  EXTENDED: "تمدید شد",
  PARTICIPANT_ADDED: "افزودن مشارکت‌کننده",
  PARTICIPANT_REMOVED: "حذف مشارکت‌کننده",
  PARTICIPANT_RESPONDED: "پاسخ به دعوت",
  GUEST_CHECKED_IN: "ثبت حضور مهمان",
  IN_PROGRESS: "در حال برگزاری",
  COMPLETED: "تکمیل شد",
  NO_SHOW: "غیبت",
};

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { push } = useToast();
  const { me, can } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>("OTHER");
  const [cancelNote, setCancelNote] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [rsDate, setRsDate] = useState("");
  const [rsTime, setRsTime] = useState("");
  // defaults fill on first data load (only once)
  const defaultsFilled = useState(false);
  const [rsRoomId, setRsRoomId] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["meeting", id],
    queryFn: () => api<{ meeting: MeetingDetail }>(`/api/meetings/${id}`),
  });

  const { data: roomsData } = useQuery({
    queryKey: ["rooms-lite"],
    queryFn: () => api<{ rooms: { id: string; name: string; capacity: number }[] }>("/api/rooms"),
    enabled: showReschedule || data?.meeting.status === "CONFIRMED",
  });

  async function respond(status: "ACCEPTED" | "DECLINED" | "TENTATIVE") {
    setBusy(`rsvp-${status}`);
    try {
      await api(`/api/meetings/${id}/participants/respond`, {
        method: "POST",
        json: { responseStatus: status },
      });
      push("پاسخ شما ثبت شد", "success");
      qc.invalidateQueries({ queryKey: ["meeting", id] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function act(
    key: string,
    path: string,
    json?: unknown,
    successMsg?: string,
  ) {
    setBusy(key);
    try {
      await api(path, { method: "POST", json });
      push(successMsg ?? "انجام شد", "success");
      qc.invalidateQueries({ queryKey: ["meeting", id] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setShowCancel(false);
      setShowReschedule(false);
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 lg:p-6">
        {/* header — title + badges + back button */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-7 w-56" />
            <SkeletonBlock className="h-5 w-20 rounded-full" />
            <SkeletonBlock className="h-5 w-14 rounded-full" />
          </div>
          <SkeletonBlock className="h-8 w-28 rounded-md" />
        </div>
        {/* action buttons row */}
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-8 w-24 rounded-md" />
          ))}
        </div>
        {/* main grid 2:1 */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <div className="border-b border-line px-5 py-4">
                <SkeletonBlock className="h-4 w-24" />
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <SkeletonBlock className="h-3 w-14" />
                    <SkeletonBlock className="h-4 w-36" />
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="border-b border-line px-5 py-4">
                <SkeletonBlock className="h-4 w-32" />
                <SkeletonBlock className="mt-1 h-3 w-40" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </Card>
          </div>
          <Card>
            <div className="border-b border-line px-5 py-4">
              <SkeletonBlock className="h-4 w-20" />
            </div>
            <div className="space-y-3 p-5">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-md border border-line p-3">
                  <div className="flex items-center justify-between">
                    <SkeletonBlock className="h-3.5 w-20" />
                    <SkeletonBlock className="h-5 w-16 rounded-full" />
                  </div>
                  <SkeletonBlock className="mt-2 h-3 w-32" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <EmptyState title="جلسه یافت نشد یا دسترسی ندارید" />
        </Card>
      </div>
    );
  }

  const m = data.meeting;
  if (!defaultsFilled[0] && m) {
    defaultsFilled[1](true);
    const ltStart = new Date(new Date(m.startAt).getTime() + 210 * 60000);
    setRsDate(ltStart.toISOString().slice(0, 10));
    setRsTime(ltStart.toISOString().slice(11, 16));
  }
  const isOrganizer = me?.id === m.organizer.id;
  const myParticipation = m.participants.find(
    (p) => p.userId === me?.id && p.role !== "ORGANIZER",
  );
  const canRespond =
    !!myParticipation && !["COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW"].includes(m.status);
  const now = new Date();
  const isLive = m.status === "IN_PROGRESS";
  const canApprove = m.status === "PENDING_APPROVAL" && can("meeting:approve");
  const canReject = m.status === "PENDING_APPROVAL" && can("meeting:reject");
  const durationMin = Math.round((new Date(m.endAt).getTime() - new Date(m.startAt).getTime()) / 60000);
  const canManageGuests =
    isOrganizer || can("meeting:manage-guests") || can("meeting:add-participant");

  async function manualGuestCheckin(guestId: string) {
    setBusy(`checkin-${guestId}`);
    try {
      await api(`/api/meetings/${id}/guests/${guestId}/checkin`, { method: "POST", json: {} });
      push("حضور مهمان ثبت شد", "success");
      qc.invalidateQueries({ queryKey: ["meeting", id] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold">{m.title}</h1>
            <StatusBadge status={m.status} />
            <TypeBadge type={m.meetingType} />
          </div>
          <p className="mt-1.5 text-[12px] text-ink-soft">
            برگزارکننده: {m.organizer.fullName} · {m.branch.name}
            {m.room ? ` · ${m.room.name}` : ""}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/meetings")}>
          بازگشت به لیست
        </Button>
      </div>

      {/* Live banner */}
      {isLive && (
        <Card className="border-ink bg-ink p-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
              <p className="text-[14px] font-bold">جلسه در حال برگزاری</p>
              <p className="text-[12px] text-white/70" dir="ltr">
                {formatJalali(new Date(m.startAt), { withTime: true }).split("—")[1]} —{" "}
                {formatJalali(new Date(m.endAt), { withTime: true }).split("—")[1]}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={busy === "ext15"}
                onClick={() => act("ext15", `/api/meetings/${id}/extend`, { minutes: 15 }, "۱۵ دقیقه تمدید شد")}
              >
                +۱۵ دقیقه
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={busy === "ext30"}
                onClick={() => act("ext30", `/api/meetings/${id}/extend`, { minutes: 30 }, "۳۰ دقیقه تمدید شد")}
              >
                +۳۰ دقیقه
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={busy === "ext60"}
                onClick={() => act("ext60", `/api/meetings/${id}/extend`, { minutes: 60 }, "۶۰ دقیقه تمدید شد")}
              >
                +۶۰ دقیقه
              </Button>
              <EndMeetingControls
                busy={busy}
                onEnd={async (noShow) => {
                  setBusy(noShow ? "end-noshow" : "end");
                  try {
                    await api(`/api/meetings/${id}/end`, {
                      method: "POST",
                      json: { noShow },
                    });
                    push(noShow ? "جلسه به‌عنوان غیبت ثبت شد" : "جلسه پایان یافت", "success");
                    qc.invalidateQueries({ queryKey: ["meeting", id] });
                    qc.invalidateQueries({ queryKey: ["meetings"] });
                    qc.invalidateQueries({ queryKey: ["dashboard"] });
                  } catch (e) {
                    push((e as ApiError).message, "error");
                  } finally {
                    setBusy(null);
                  }
                }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Actions bar */}
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <Button
            size="sm"
            loading={busy === "approve"}
            onClick={() => act("approve", `/api/meetings/${id}/approve`, {}, "جلسه تأیید شد")}
          >
            <Check className="h-4 w-4" />
            تأیید جلسه
          </Button>
        )}
        {canReject && (
          <RejectButton meetingId={id} onDone={() => qc.invalidateQueries({ queryKey: ["meeting", id] })} />
        )}
        {(isOrganizer || can("meeting:start")) && m.status === "CONFIRMED" && new Date(m.startAt) <= now && (
          <Button
            size="sm"
            loading={busy === "start"}
            onClick={() => act("start", `/api/meetings/${id}/start`, {}, "جلسه شروع شد")}
          >
            <Play className="h-4 w-4" />
            شروع جلسه
          </Button>
        )}
        {(isOrganizer || can("meeting:reschedule")) && !["COMPLETED", "NO_SHOW", "CANCELLED", "REJECTED"].includes(m.status) && (
          <Button size="sm" variant="outline" onClick={() => setShowReschedule((v) => !v)}>
            <CalendarClock className="h-4 w-4" />
            زمان‌بندی مجدد
          </Button>
        )}
        {(isOrganizer || can("meeting:cancel")) && !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(m.status) && (
          <Button size="sm" variant="outline" onClick={() => setShowCancel((v) => !v)}>
            <X className="h-4 w-4" />
            لغو جلسه
          </Button>
        )}
        {(isOrganizer || can("meeting:add-participant")) &&
          !["COMPLETED", "NO_SHOW", "CANCELLED", "REJECTED"].includes(m.status) && (
            <Button size="sm" variant="outline" onClick={() => setShowAddUser((v) => !v)}>
              <UserPlus className="h-4 w-4" />
              افزودن فرد
            </Button>
          )}
      </div>

      {/* Reschedule form */}
      {showReschedule && (
        <Card className="p-4">
          <p className="mb-3 text-[13px] font-bold">زمان‌بندی مجدد</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">تاریخ (شمسی)</label>
              <JalaliDatePicker value={rsDate} onChange={setRsDate} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">ساعت شروع</label>
              <TimePicker value={rsTime} onChange={setRsTime} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">اتاق</label>
              <Select
                value={rsRoomId}
                onChange={setRsRoomId}
                placeholder={`همان اتاق (${m.room?.name ?? "بدون اتاق"})`}
                options={(roomsData?.rooms ?? []).map((r) => ({
                  value: r.id,
                  label: r.name,
                  hint: `ظرفیت ${faNum(r.capacity)} نفر`,
                }))}
              />
            </div>
            <div className="flex items-end">
              <Button
                size="md"
                className="w-full"
                loading={busy === "reschedule"}
                onClick={() => {
                  const base = rsDate || new Date(m.startAt).toISOString().slice(0, 10);
                  const time = rsTime || new Date(m.startAt).toISOString().slice(11, 16);
                  const [y, mo, d] = base.split("-").map(Number);
                  const [h, mi] = time.split(":").map(Number);
                  const utc = new Date(Date.UTC(y, mo - 1, d, h, mi) - 210 * 60000);
                  const end = new Date(utc.getTime() + durationMin * 60000);
                  act(
                    "reschedule",
                    `/api/meetings/${id}/reschedule`,
                    {
                      startAt: utc.toISOString(),
                      endAt: end.toISOString(),
                      ...(rsRoomId ? { roomId: rsRoomId } : {}),
                      reason: "زمان‌بندی مجدد از پنل",
                    },
                    "زمان جلسه تغییر کرد",
                  );
                }}
              >
                ثبت تغییر
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            قبل از ثبت، تداخل اتاق و افراد به‌صورت خودکار بررسی می‌شود.
          </p>
        </Card>
      )}

      {/* Cancel form */}
      {showCancel && (
        <Card className="p-4">
          <p className="mb-3 text-[13px] font-bold text-red-600">لغو جلسه</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">دلیل لغو</label>
              <Select
                value={cancelReason}
                onChange={setCancelReason}
                options={CANCEL_REASONS.map((r) => ({ value: r, label: CANCEL_REASON_FA[r] }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">توضیح (اختیاری)</label>
              <input
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="danger"
                className="w-full"
                loading={busy === "cancel"}
                onClick={() =>
                  act("cancel", `/api/meetings/${id}/cancel`, { reason: cancelReason, note: cancelNote || undefined }, "جلسه لغو شد")
                }
              >
                تأیید لغو
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Add participant */}
      {showAddUser && (
        <Card className="p-4">
          <p className="mb-3 text-[13px] font-bold">افزودن مشارکت‌کننده</p>
          <AddParticipantBlock
            meetingId={id}
            existingUserIds={m.participants.map((p) => p.userId)}
            existingGuestNames={m.guests.map((g) => g.name)}
            onDone={() => qc.invalidateQueries({ queryKey: ["meeting", id] })}
          />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Details */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="جزئیات جلسه" />
            <CardBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="شروع" value={formatJalali(new Date(m.startAt), { withTime: true })} />
                <DetailRow label="پایان" value={formatJalali(new Date(m.endAt), { withTime: true })} />
                <DetailRow label="مدت" value={`${faNum(durationMin)} دقیقه`} />
                <DetailRow label="اتاق" value={m.room ? `${m.room.name} (${faNum(m.room.capacity)} نفر)` : "—"} />
                <DetailRow label="شعبه" value={m.branch.name} />
                <DetailRow label="برگزارکننده" value={m.organizer.fullName} />
              </div>
              {m.description && (
                <div>
                  <p className="mb-1 text-[11px] text-ink-soft">توضیحات</p>
                  <p className="whitespace-pre-wrap text-[13px] leading-6">{m.description}</p>
                </div>
              )}
              {m.cancelReason && (
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-[12px] font-medium text-red-600">
                    دلیل لغو: {CANCEL_REASON_FA[m.cancelReason] ?? m.cancelReason}
                  </p>
                  {m.cancelNote && <p className="mt-1 text-[11px] text-red-500">{m.cancelNote}</p>}
                </div>
              )}
            </CardBody>
          </Card>

          {canRespond && (
            <Card>
              <CardHeader
                title="پاسخ شما به دعوت"
                subtitle={`وضعیت فعلی: ${RESPONSE_FA[myParticipation!.responseStatus] ?? myParticipation!.responseStatus}`}
              />
              <CardBody>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={myParticipation!.responseStatus === "ACCEPTED" ? "primary" : "secondary"}
                    loading={busy === "rsvp-ACCEPTED"}
                    onClick={() => respond("ACCEPTED")}
                  >
                    <Check className="h-4 w-4" />
                    می‌آیم
                  </Button>
                  <Button
                    size="sm"
                    variant={myParticipation!.responseStatus === "DECLINED" ? "primary" : "secondary"}
                    loading={busy === "rsvp-DECLINED"}
                    onClick={() => respond("DECLINED")}
                  >
                    <X className="h-4 w-4" />
                    نمی‌آیم
                  </Button>
                  <Button
                    size="sm"
                    variant={myParticipation!.responseStatus === "TENTATIVE" ? "primary" : "secondary"}
                    loading={busy === "rsvp-TENTATIVE"}
                    onClick={() => respond("TENTATIVE")}
                  >
                    <Clock className="h-4 w-4" />
                    شاید
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Participants */}
          <Card>
            <CardHeader
              title={`مشارکت‌کنندان (${faNum(m.participants.length)})`}
              subtitle={`داخلی: ${faNum(m.participants.length)} · خارجی: ${faNum(m.guests.length)}`}
            />
            <div className="divide-y divide-line">
              {m.participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-soft text-[11px] font-bold">
                    {p.user.fullName.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{p.user.fullName}</p>
                    <p className="text-[11px] text-ink-faint">
                      {p.role === "ORGANIZER" ? "برگزارکننده" : p.user.jobTitle ?? "مشارکت‌کننده"}
                    </p>
                  </div>
                  {p.joinedAt && (
                    <span className="badge badge-green">
                      <UserCheck className="h-3 w-3" />
                      حاضر
                    </span>
                  )}
                  <span
                    className={cn(
                      "badge",
                      p.responseStatus === "ACCEPTED" && "badge-green",
                      p.responseStatus === "DECLINED" && "badge-red",
                      p.responseStatus === "PENDING" && "badge-gray",
                      p.responseStatus === "TENTATIVE" && "badge-amber",
                    )}
                  >
                    {RESPONSE_FA[p.responseStatus]}
                  </span>
                  {(isOrganizer || can("meeting:remove-participant")) &&
                    p.role !== "ORGANIZER" &&
                    !["COMPLETED", "CANCELLED"].includes(m.status) && (
                      <button
                        className="text-ink-faint hover:text-red-600"
                        aria-label="حذف"
                        onClick={async () => {
                          setBusy(`rm-${p.userId}`);
                          try {
                            await api(`/api/meetings/${id}/participants`, {
                              method: "DELETE",
                              json: { userId: p.userId },
                            });
                            push("حذف شد", "success");
                            qc.invalidateQueries({ queryKey: ["meeting", id] });
                          } catch (e) {
                            push((e as ApiError).message, "error");
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                </div>
              ))}
              {m.guests.map((g) => (
                <div key={g.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[11px] font-bold text-amber-700">
                    خ
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{g.name}</p>
                    <p className="text-[11px] text-ink-faint">
                      مهمان خارجی{g.company ? ` · ${g.company}` : ""}
                      {g.phone ? ` · ${faStr(g.phone)}` : ""}
                      {g.arrivedAt
                        ? ` · حاضر ${formatJalali(new Date(g.arrivedAt), { withTime: true }).split("—")[1]?.trim() ?? ""}`
                        : ""}
                    </p>
                  </div>
                  {canManageGuests ? (
                    <GuestCheckinPanel
                      checkinCode={g.checkinCode}
                      arrivedAt={g.arrivedAt}
                      guestName={g.name}
                      meetingTitle={m.title}
                      busy={busy === `checkin-${g.id}`}
                      onManualCheckin={() => manualGuestCheckin(g.id)}
                    />
                  ) : (
                    <span className="badge badge-amber">مهمان</span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* History */}
          <Card>
            <CardHeader title="تاریخچه جلسه" subtitle={`${faNum(m.events.length)} رخداد`} />
            <CardBody>
              <div className="space-y-0">
                {m.events.map((ev, i) => (
                  <div key={ev.id} className="relative flex gap-3 pb-4">
                    {i < m.events.length - 1 && (
                      <span className="absolute right-[7px] top-5 h-full w-px bg-line" />
                    )}
                    <span className="relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-line bg-white" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium">{EVENT_FA[ev.type] ?? ev.type}</p>
                      <p className="mt-0.5 text-[11px] text-ink-faint">
                        {formatJalali(new Date(ev.createdAt), { withTime: true })}
                        {ev.actor ? ` · ${ev.actor.fullName}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Approvals sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="گردش تأیید" />
            <CardBody>
              {m.approvals.length === 0 ? (
                <p className="text-[12px] text-ink-soft">این جلسه نیاز به تأیید نداشته است.</p>
              ) : (
                <div className="space-y-3">
                  {m.approvals.map((a) => (
                    <div key={a.id} className="rounded-md border border-line p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-medium">
                          {a.action === "REQUESTED" ? "ارسال درخواست" : a.action === "APPROVED" ? "تأیید" : "رد"}
                        </p>
                        <span
                          className={cn(
                            "badge",
                            a.action === "APPROVED" && "badge-green",
                            a.action === "REJECTED" && "badge-red",
                            a.action === "REQUESTED" && "badge-amber",
                          )}
                        >
                          {a.action === "APPROVED" ? "تأیید شده" : a.action === "REJECTED" ? "رد شده" : "در انتظار"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-ink-faint">
                        {formatJalali(new Date(a.createdAt), { withTime: true })}
                        {a.actor ? ` · ${a.actor.fullName}` : ""}
                      </p>
                      {a.reason && <p className="mt-1 text-[11px] text-ink-soft">{a.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-center">
              <Link
                href={`/calendar?focus=${m.id}`}
                className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft hover:text-ink"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                مشاهده در تقویم
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-ink-soft">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium">{value}</p>
    </div>
  );
}

function EndMeetingControls({
  busy,
  onEnd,
}: {
  busy: string | null;
  onEnd: (noShow: boolean) => Promise<void>;
}) {
  const [confirmNoShow, setConfirmNoShow] = useState(false);

  if (confirmNoShow) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
        <span className="text-[11px] font-medium text-red-700">
          این جلسه بدون برگزاری به‌عنوان «غیبت» ثبت شود؟
        </span>
        <Button
          size="sm"
          variant="danger"
          loading={busy === "end-noshow"}
          disabled={!!busy}
          onClick={async () => {
            await onEnd(true);
            setConfirmNoShow(false);
          }}
        >
          بله، ثبت غیبت
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!!busy}
          onClick={() => setConfirmNoShow(false)}
        >
          انصراف
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        size="sm"
        className="bg-white text-ink hover:bg-paper-soft"
        loading={busy === "end"}
        disabled={!!busy}
        onClick={() => onEnd(false)}
      >
        <Square className="h-3.5 w-3.5" />
        پایان جلسه
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!!busy}
        onClick={() => setConfirmNoShow(true)}
      >
        ثبت به‌عنوان غیبت
      </Button>
    </>
  );
}

function RejectButton({ meetingId, onDone }: { meetingId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <X className="h-4 w-4" />
        رد جلسه
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="دلیل رد (الزامی)"
        className="h-8 w-56 rounded-md border border-line px-3 text-[12px] outline-none focus:border-red-400"
      />
      <Button
        size="sm"
        variant="danger"
        disabled={reason.trim().length < 3}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/api/meetings/${meetingId}/reject`, { method: "POST", json: { reason } });
            push("جلسه رد شد", "success");
            onDone();
          } catch (e) {
            push((e as ApiError).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        ثبت رد
      </Button>
    </div>
  );
}


function AddParticipantBlock({
  meetingId,
  existingUserIds,
  existingGuestNames,
  onDone,
}: {
  meetingId: string;
  existingUserIds: string[];
  existingGuestNames: string[];
  onDone: () => void;
}) {
  const { push } = useToast();
  const [picked, setPicked] = useState<PickedPerson[]>([]);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (picked.length === 0) return;
    setBusy(true);
    let okCount = 0;
    for (const person of picked) {
      try {
        const dir = await api<{ people: { id: string; userId: string | null }[] }>("/api/people");
        const userIdByDir = new Map(dir.people.map((d) => [d.id, d.userId]));
        if (person.ref.startsWith("dir:")) {
          const uid = userIdByDir.get(person.ref.slice(4));
          if (uid) {
            await api(`/api/meetings/${meetingId}/participants`, {
              method: "POST",
              json: { userId: uid },
            });
            okCount++;
            continue;
          }
        }
        // external / new person → register as guest via guests API
        await api(`/api/meetings/${meetingId}/guests`, {
          method: "POST",
          json: {
            name: person.name,
            company: person.company,
            phone: person.phone,
            email: person.email,
          },
        });
        okCount++;
      } catch (e) {
        push(`خطا در افزودن ${person.name}: ${(e as ApiError).message}`, "error");
      }
    }
    setBusy(false);
    if (okCount > 0) {
      push(`${okCount} نفر اضافه شد`, "success");
      setPicked([]);
      onDone();
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="min-w-56 flex-1">
        <PeoplePicker
          value={picked}
          onChange={setPicked}
          placeholder="انتخاب از افراد شرکت یا ثبت فرد جدید…"
        />
      </div>
      <Button disabled={picked.length === 0} loading={busy} onClick={add}>
        افزودن
      </Button>
    </div>
  );
}
