import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

const COLORS = ["#0d0d0d", "#3b3b40", "#5a5a60", "#7d7d84", "#9d9da4", "#b8b8bf", "#d4d4d9"];

/** GET /api/reports/me — personal stats for the logged-in user. No special perm. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const months = Math.min(Math.max(Number(sp.get("months") ?? 6), 1), 24);
    const from = new Date();
    from.setMonth(from.getMonth() - months);

    // meetings where I'm organizer or participant (not cancelled/rejected)
    const involved = {
      OR: [{ organizerId: user.id }, { participants: { some: { userId: user.id } } }],
      status: { notIn: ["CANCELLED", "REJECTED", "DRAFT"] },
      startAt: { gte: from },
    };

    const [meetings, organized, participated] = await Promise.all([
      prisma.meeting.findMany({
        where: involved,
        select: {
          id: true,
          title: true,
          description: true,
          startAt: true,
          endAt: true,
          status: true,
          meetingType: true,
          isPrivate: true,
          organizerId: true,
          organizer: { select: { id: true, fullName: true } },
          participants: { select: { user: { select: { id: true, fullName: true } } } },
          guests: { select: { name: true, company: true } },
          room: { select: { name: true } },
        },
        orderBy: { startAt: "desc" },
        take: 500,
      }),
      prisma.meeting.count({
        where: { organizerId: user.id, status: { notIn: ["CANCELLED", "REJECTED", "DRAFT"] }, startAt: { gte: from } },
      }),
      prisma.meeting.count({
        where: { participants: { some: { userId: user.id } }, status: { notIn: ["CANCELLED", "REJECTED", "DRAFT"] }, startAt: { gte: from } },
      }),
    ]);

    // ── aggregate stats ──
    const totalMin = meetings.reduce((s, m) => s + (m.endAt.getTime() - m.startAt.getTime()) / 60000, 0);
    const completed = meetings.filter((m) => m.status === "COMPLETED").length;
    const noShow = meetings.filter((m) => m.status === "NO_SHOW").length;

    // top companions: count per fellow participant (exclude me)
    const peopleCount = new Map<string, { name: string; count: number; minutes: number }>();
    for (const m of meetings) {
      const mins = (m.endAt.getTime() - m.startAt.getTime()) / 60000;
      const people: string[] = [];
      if (m.organizerId && m.organizerId !== user.id) people.push(m.organizer.id + "|" + m.organizer.fullName);
      for (const p of m.participants) {
        if (p.user.id !== user.id) people.push(p.user.id + "|" + p.user.fullName);
      }
      for (const key of new Set(people)) {
        const [id, name] = key.split("|");
        const cur = peopleCount.get(id) ?? { name, count: 0, minutes: 0 };
        cur.count += 1;
        cur.minutes += mins;
        peopleCount.set(id, cur);
      }
    }
    const topPeople = [...peopleCount.values()].sort((a, b) => b.count - a.count).slice(0, 8);

    // monthly hours series (Jalali month label approximated by Gregorian months — chart only)
    const byMonth = new Map<string, number>();
    for (const m of meetings) {
      const k = m.startAt.toISOString().slice(0, 7);
      byMonth.set(k, (byMonth.get(k) ?? 0) + (m.endAt.getTime() - m.startAt.getTime()) / 3600000);
    }
    const series = [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ month: k, hours: Math.round(v * 10) / 10 }));

    // meeting-type breakdown
    const typeCount = new Map<string, number>();
    for (const m of meetings) typeCount.set(m.meetingType, (typeCount.get(m.meetingType) ?? 0) + 1);
    const types = [...typeCount.entries()].map(([t, c], i) => ({
      type: t,
      count: c,
      color: COLORS[i % COLORS.length],
    }));

    // top topics (by title frequency — same-ish titles grouped exactly)
    const titleCount = new Map<string, number>();
    for (const m of meetings) titleCount.set(m.title, (titleCount.get(m.title) ?? 0) + 1);
    const topics = [...titleCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

    return ok({
      range: { months, from: from.toISOString() },
      summary: {
        totalMeetings: meetings.length,
        organized,
        participated,
        totalHours: Math.round((totalMin / 60) * 10) / 10,
        avgMinutes: meetings.length ? Math.round(totalMin / meetings.length) : 0,
        completed,
        noShow,
        cancellationRate:
          meetings.length ? Math.round(((meetings.length - completed - noShow) / meetings.length) * 100) : 0,
      },
      topPeople,
      series,
      types,
      topics,
      meetings: meetings.slice(0, 50).map((m) => ({
        id: m.id,
        title: m.title,
        startAt: m.startAt.toISOString(),
        endAt: m.endAt.toISOString(),
        status: m.status,
        isPrivate: m.isPrivate,
        organizer: m.organizer.fullName,
        role: m.organizerId === user.id ? "ORGANIZER" : "PARTICIPANT",
        participants: m.participants.map((p) => p.user.fullName),
        guests: m.guests.map((g) => g.name),
        room: m.room?.name ?? null,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
