"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn, faNum, formatJalali } from "@/lib";
import { Check, Clock, Info, UserX, X } from "@/components/ui/icon";
import { UserAvatar } from "@/components/ui/user-avatar";

/**
 * حضورغیاب جلسه — برگزارکننده برای هر شرکت‌کننده ثبت می‌کند:
 * حاضر / تأخیر / غایب / معذرت. بقیه فقط می‌بینند.
 */

type AttStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";

const STATUS_META: Record<AttStatus, { label: string; chip: string; icon: React.ReactNode }> = {
  PRESENT: { label: "حاضر", chip: "bg-emerald-600 text-white", icon: <Check className="h-3.5 w-3.5" /> },
  LATE: { label: "تأخیر", chip: "bg-amber-500 text-white", icon: <Clock className="h-3.5 w-3.5" /> },
  ABSENT: { label: "غایب", chip: "bg-red-500 text-white", icon: <X className="h-3.5 w-3.5" /> },
  EXCUSED: { label: "معذرت", chip: "bg-gray-400 text-white", icon: <Info className="h-3.5 w-3.5" /> },
};

interface AttendanceRow {
  userId: string;
  attendanceStatus: AttStatus | null;
  attendanceMarkedAt: string | null;
  attendanceMarkedBy: { id: string; fullName: string } | null;
}

interface GuestAttendanceRow {
  id: string;
  name: string;
  attendanceStatus: AttStatus | null;
  attendanceMarkedAt: string | null;
  attendanceMarkedBy: { id: string; fullName: string } | null;
}

export function MeetingAttendance({
  meetingId,
  participants,
  guests = [],
  isOrganizer,
}: {
  meetingId: string;
  participants: { userId: string; user: { id: string; fullName: string; jobTitle?: string | null } }[];
  guests?: { id: string; name: string; company?: string | null }[];
  isOrganizer: boolean;
}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const [marking, setMarking] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["attendance", meetingId],
    queryFn: () => api<{ attendance: AttendanceRow[]; guests: GuestAttendanceRow[] }>(`/api/meetings/${meetingId}/attendance`),
    retry: false,
  });

  const byUser = new Map((data?.attendance ?? []).map((a) => [a.userId, a]));
  const byGuest = new Map((data?.guests ?? []).map((g) => [g.id, g]));
  const allRows = [...(data?.attendance ?? []), ...(data?.guests ?? [])];
  const marked = allRows.filter((a) => a.attendanceStatus).length;
  const summary = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 } as Record<AttStatus, number>;
  for (const a of allRows) if (a.attendanceStatus) summary[a.attendanceStatus] += 1;

  async function mark(payload: { userId?: string; guestId?: string }, status: AttStatus | null) {
    const key = payload.userId ?? payload.guestId ?? "";
    const current = payload.userId ? (byUser.get(payload.userId)?.attendanceStatus ?? null) : (byGuest.get(payload.guestId!)?.attendanceStatus ?? null);
    const next = current === status ? null : status;
    setMarking(key);
    try {
      await api(`/api/meetings/${meetingId}/attendance`, {
        method: "POST",
        json: { marks: [{ ...payload, status: next }] },
      });
      await qc.invalidateQueries({ queryKey: ["attendance", meetingId] });
      if (next) push(`«${STATUS_META[next].label}» ثبت شد`, "success");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setMarking(null);
    }
  }

  if (participants.length === 0 && guests.length === 0) return null;

  const total = participants.length + guests.length;

  return (
    <Card data-testid="meeting-attendance" data-tour="meeting-attendance">
      <CardHeader
        title={`حضورغیاب (${faNum(marked)}/${faNum(total)})`}
        subtitle={isOrganizer ? "روی وضعیت هر نفر بزنید تا ثبت شود — دوباره بزنید پاک می‌شود" : "ثبت‌شده توسط برگزارکننده جلسه"}
      />
      <div className="px-5 pb-5">
        {/* summary strip */}
        <div className="mt-3 mb-3 grid grid-cols-4 gap-2">
          {(["PRESENT", "LATE", "ABSENT", "EXCUSED"] as AttStatus[]).map((st) => (
            <div key={st} className={cn("rounded-lg px-2 py-2 text-center", marked ? STATUS_META[st].chip : "bg-paper-soft text-ink-faint")}>
              <p className="text-[15px] font-bold tabular-nums leading-5">{faNum(summary[st])}</p>
              <p className="mt-0.5 text-[10px] leading-3 opacity-90">{STATUS_META[st].label}</p>
            </div>
          ))}
        </div>

        <div className="divide-y divide-line">
          {participants.map((p) => {
            const row = byUser.get(p.userId);
            const st = row?.attendanceStatus ?? null;
            const meta = st ? STATUS_META[st] : null;
            return (
              <div key={p.userId} className="flex flex-wrap items-center gap-2.5 py-2.5" data-testid={`attendance-row-${p.userId}`}>
                <UserAvatar name={p.user.fullName} className="size-8 text-[11px]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{p.user.fullName}</p>
                  {row?.attendanceMarkedAt && (
                    <p className="text-[10.5px] text-ink-faint">
                      ثبت توسط {row.attendanceMarkedBy?.fullName ?? "—"} · {formatJalali(new Date(row.attendanceMarkedAt), { withTime: true })}
                    </p>
                  )}
                </div>
                {isOrganizer ? (
                  <div className="flex items-center gap-1" role="group" aria-label={`حضورغیاب ${p.user.fullName}`}>
                    {(["PRESENT", "LATE", "ABSENT", "EXCUSED"] as AttStatus[]).map((s) => {
                      const active = st === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          title={STATUS_META[s].label}
                          disabled={marking === p.userId}
                          onClick={() => mark({ userId: p.userId }, s)}
                          className={cn(
                            "flex h-8 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-medium transition-colors",
                            active ? STATUS_META[s].chip : "bg-paper-soft text-ink-soft hover:bg-line/50 hover:text-ink",
                            marking === p.userId && "opacity-60",
                          )}
                          data-testid={`attendance-${p.userId}-${s}`}
                        >
                          {STATUS_META[s].icon}
                          <span className="hidden sm:inline">{STATUS_META[s].label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  meta && (
                    <span className={cn("flex h-8 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-medium", meta.chip)}>
                      {meta.icon}
                      {meta.label}
                    </span>
                  )
                )}
              </div>
            );
          })}
          {guests.map((g) => {
            const row = byGuest.get(g.id);
            const st = row?.attendanceStatus ?? null;
            const meta = st ? STATUS_META[st] : null;
            return (
              <div key={g.id} className="flex flex-wrap items-center gap-2.5 py-2.5" data-testid={`attendance-guest-${g.id}`}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-paper-soft text-[11px] font-bold text-ink-soft">
                  {g.name.trim().charAt(0) || "؟"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {g.name}
                    <span className="mr-1.5 rounded-full bg-paper-soft px-1.5 py-0.5 text-[9.5px] font-normal text-ink-faint">مهمان{g.company ? ` · ${g.company}` : ""}</span>
                  </p>
                  {row?.attendanceMarkedAt && (
                    <p className="text-[10.5px] text-ink-faint">
                      ثبت توسط {row.attendanceMarkedBy?.fullName ?? "—"} · {formatJalali(new Date(row.attendanceMarkedAt), { withTime: true })}
                    </p>
                  )}
                </div>
                {isOrganizer ? (
                  <div className="flex items-center gap-1" role="group" aria-label={`حضورغیاب ${g.name}`}>
                    {(["PRESENT", "LATE", "ABSENT", "EXCUSED"] as AttStatus[]).map((s2) => {
                      const active = st === s2;
                      return (
                        <button
                          key={s2}
                          type="button"
                          title={STATUS_META[s2].label}
                          disabled={marking === g.id}
                          onClick={() => mark({ guestId: g.id }, s2)}
                          className={cn(
                            "flex h-8 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-medium transition-colors",
                            active ? STATUS_META[s2].chip : "bg-paper-soft text-ink-soft hover:bg-line/50 hover:text-ink",
                            marking === g.id && "opacity-60",
                          )}
                          data-testid={`attendance-guest-${g.id}-${s2}`}
                        >
                          {STATUS_META[s2].icon}
                          <span className="hidden sm:inline">{STATUS_META[s2].label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  meta && (
                    <span className={cn("flex h-8 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-medium", meta.chip)}>
                      {meta.icon}
                      {meta.label}
                    </span>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
