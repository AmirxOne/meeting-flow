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

export function MeetingAttendance({
  meetingId,
  participants,
  isOrganizer,
}: {
  meetingId: string;
  participants: { userId: string; user: { id: string; fullName: string; jobTitle?: string | null } }[];
  isOrganizer: boolean;
}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const [marking, setMarking] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["attendance", meetingId],
    queryFn: () => api<{ attendance: AttendanceRow[] }>(`/api/meetings/${meetingId}/attendance`),
    retry: false,
  });

  const byUser = new Map((data?.attendance ?? []).map((a) => [a.userId, a]));
  const marked = (data?.attendance ?? []).filter((a) => a.attendanceStatus).length;
  const summary = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 } as Record<AttStatus, number>;
  for (const a of data?.attendance ?? []) if (a.attendanceStatus) summary[a.attendanceStatus] += 1;

  async function mark(userId: string, status: AttStatus | null) {
    // toggle off when clicking the active status
    const current = byUser.get(userId)?.attendanceStatus ?? null;
    const next = current === status ? null : status;
    setMarking(userId);
    try {
      await api(`/api/meetings/${meetingId}/attendance`, {
        method: "POST",
        json: { marks: [{ userId, status: next }] },
      });
      await qc.invalidateQueries({ queryKey: ["attendance", meetingId] });
      if (next) push(`«${STATUS_META[next].label}» ثبت شد`, "success");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setMarking(null);
    }
  }

  if (participants.length === 0) return null;

  return (
    <Card data-testid="meeting-attendance" data-tour="meeting-attendance">
      <CardHeader
        title={`حضورغیاب (${faNum(marked)}/${faNum(participants.length)})`}
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
                          onClick={() => mark(p.userId, s)}
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
        </div>
      </div>
    </Card>
  );
}
