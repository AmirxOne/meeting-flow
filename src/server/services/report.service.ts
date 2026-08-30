import { prisma } from "@/server/db";
import { fillHourlyHistogram } from "@/lib/report-histogram";

export interface ReportFilters {
  from?: Date;
  to?: Date;
  branchId?: string;
  roomId?: string;
  organizerId?: string;
  participantId?: string;
  meetingType?: string;
  status?: string;
}

export interface SummaryReport {
  totalMeetings: number;
  totalHours: number;
  avgDurationMin: number;
  cancelledCount: number;
  cancellationRate: number;
  noShowRate: number;
  externalCount: number;
  completedCount: number;
  peakHour: number | null;
  meetingsByDay: { date: string; count: number; hours: number }[];
  roomUtilization: {
    roomId: string;
    roomName: string;
    branchName: string;
    hours: number;
    utilization: number; // % of branch open hours (8-20 assumed 12h/day window)
    meetings: number;
  }[];
  byBranch: { branchId: string; branchName: string; meetings: number; hours: number }[];
  byType: { type: string; count: number }[];
  hourlyHistogram: { hour: number; count: number }[];
}

const ACTIVE = ["PENDING_APPROVAL", "APPROVED", "CONFIRMED", "RESCHEDULED", "IN_PROGRESS", "COMPLETED"];

function meetingWhere(f: ReportFilters) {
  return {
    startAt: { gte: f.from, lte: f.to },
    ...(f.branchId ? { branchId: f.branchId } : {}),
    ...(f.roomId ? { roomId: f.roomId } : {}),
    ...(f.organizerId ? { organizerId: f.organizerId } : {}),
    ...(f.meetingType ? { meetingType: f.meetingType } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.participantId
      ? { participants: { some: { userId: f.participantId } } }
      : {}),
  };
}

export async function summaryReport(f: ReportFilters): Promise<SummaryReport> {
  const where = meetingWhere(f);

  const [meetings, byRoomRaw, byBranchRaw, byTypeRaw] =
    await Promise.all([
      prisma.meeting.findMany({
        where,
        select: { startAt: true, endAt: true, status: true, meetingType: true },
      }),
      prisma.meetingRoom.findMany({
        include: {
          branch: { select: { name: true } },
          meetings: { where },
        },
      }),
      prisma.branch.findMany({
        include: { meetings: { where } },
      }),
      prisma.meeting.groupBy({
        by: ["meetingType"],
        where,
        _count: { _all: true },
      }),
    ]);

  const total = meetings.length;
  const cancelled = meetings.filter((m) => m.status === "CANCELLED").length;
  const noShow = meetings.filter((m) => m.status === "NO_SHOW").length;
  const completed = meetings.filter((m) => m.status === "COMPLETED").length;
  const external = meetings.filter((m) =>
    ["EXTERNAL", "CLIENT", "INTERVIEW"].includes(m.meetingType),
  ).length;
  const activeDurations = meetings
    .filter((m) => ACTIVE.includes(m.status))
    .map((m) => m.endAt.getTime() - m.startAt.getTime());
  const totalMs = activeDurations.reduce((a, b) => a + b, 0);
  const totalHours = totalMs / 3600000;

  // day buckets (Tehran local date)
  const dayMap = new Map<string, { count: number; ms: number }>();
  const hourMap = new Map<number, number>();
  for (const m of meetings) {
    const local = new Date(m.startAt.getTime() + 210 * 60000);
    const key = local.toISOString().slice(0, 10);
    const cur = dayMap.get(key) ?? { count: 0, ms: 0 };
    cur.count += 1;
    if (ACTIVE.includes(m.status)) cur.ms += m.endAt.getTime() - m.startAt.getTime();
    dayMap.set(key, cur);
    hourMap.set(local.getUTCHours(), (hourMap.get(local.getUTCHours()) ?? 0) + 1);
  }

  const days = f.from && f.to ? Math.max(1, (f.to.getTime() - f.from.getTime()) / 86400000) : 1;
  const OPEN_HOURS_PER_DAY = 12;

  return {
    totalMeetings: total,
    totalHours: Math.round(totalHours * 10) / 10,
    avgDurationMin: activeDurations.length ? Math.round(totalMs / activeDurations.length / 60000) : 0,
    cancelledCount: cancelled,
    cancellationRate: total ? Math.round((cancelled / total) * 100) : 0,
    noShowRate: total ? Math.round((noShow / total) * 100) : 0,
    externalCount: external,
    completedCount: completed,
    peakHour: [...hourMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    meetingsByDay: [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, count: v.count, hours: Math.round((v.ms / 3600000) * 10) / 10 })),
    roomUtilization: byRoomRaw
      .map((r) => {
        const ms = r.meetings
          .filter((m) => ACTIVE.includes(m.status))
          .reduce((a, m) => a + (m.endAt.getTime() - m.startAt.getTime()), 0);
        const capacityMs = days * OPEN_HOURS_PER_DAY * 3600000;
        return {
          roomId: r.id,
          roomName: r.name,
          branchName: r.branch.name,
          hours: Math.round((ms / 3600000) * 10) / 10,
          utilization: Math.min(100, Math.round((ms / capacityMs) * 100)),
          meetings: r.meetings.length,
        };
      })
      .sort((a, b) => b.hours - a.hours),
    byBranch: byBranchRaw.map((b) => ({
      branchId: b.id,
      branchName: b.name,
      meetings: b.meetings.length,
      hours:
        Math.round(
          (b.meetings
            .filter((m) => ACTIVE.includes(m.status))
            .reduce((a, m) => a + (m.endAt.getTime() - m.startAt.getTime()), 0) /
            3600000) *
            10,
        ) / 10,
    })),
    byType: byTypeRaw.map((t) => ({ type: t.meetingType, count: t._count._all })),
    hourlyHistogram: fillHourlyHistogram(hourMap),
  };
}

// ── CSV / Excel export data (flat rows) ──────────────────────────

export interface MeetingRow {
  id: string;
  title: string;
  status: string;
  type: string;
  branch: string;
  room: string;
  organizer: string;
  participants: number;
  guests: number;
  startAt: Date;
  endAt: Date;
  durationMin: number;
}

export function meetingsCsv(rows: MeetingRow[]): string {
  const header = "id,title,status,type,branch,room,organizer,participants,guests,start,end,duration_min";
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.id, r.title, r.status, r.type, r.branch, r.room, r.organizer,
      r.participants, r.guests, r.startAt.toISOString(), r.endAt.toISOString(), r.durationMin,
    ]
      .map(esc)
      .join(","),
  );
  return `\uFEFF${[header, ...lines].join("\n")}`;
}

export async function meetingsForExport(f: ReportFilters): Promise<MeetingRow[]> {
  const rows = await prisma.meeting.findMany({
    where: meetingWhere(f),
    include: {
      room: { select: { name: true } },
      branch: { select: { name: true } },
      organizer: { select: { fullName: true } },
      _count: { select: { participants: true, guests: true } },
    },
    orderBy: { startAt: "desc" },
  });
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status,
    type: m.meetingType,
    branch: m.branch.name,
    room: m.room?.name ?? "—",
    organizer: m.organizer.fullName,
    participants: m._count.participants,
    guests: m._count.guests,
    startAt: m.startAt,
    endAt: m.endAt,
    durationMin: Math.round((m.endAt.getTime() - m.startAt.getTime()) / 60000),
  }));
}
