import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { hashToken } from "@/server/auth/session";
import { getOrgTimezone } from "./org-timezone.service";
import {
  buildIcsCalendar,
  meetingStatusToIcs,
  type IcsEvent,
} from "@/lib/ics";
import { formatAgendaPlain, mergeDescriptionWithAgenda } from "@/lib/agenda";
import { mergeTextWithVideoLink } from "@/lib/video-link";

const FEED_PAST_MS = 60 * 86400000;
const FEED_FUTURE_MS = 400 * 86400000;

export function newCalendarFeedToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashCalendarFeedToken(token: string): string {
  return hashToken(token);
}

export async function getCalendarFeedStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { calendarFeedTokenHash: true, calendarFeedCreatedAt: true },
  });
  return {
    enabled: !!user?.calendarFeedTokenHash,
    createdAt: user?.calendarFeedCreatedAt ?? null,
  };
}

export async function rotateCalendarFeedToken(userId: string): Promise<{
  token: string;
  createdAt: Date;
}> {
  const token = newCalendarFeedToken();
  const createdAt = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: {
      calendarFeedTokenHash: hashCalendarFeedToken(token),
      calendarFeedCreatedAt: createdAt,
    },
  });
  return { token, createdAt };
}

export async function revokeCalendarFeedToken(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { calendarFeedTokenHash: null, calendarFeedCreatedAt: null },
  });
}

export async function findUserByFeedToken(rawToken: string) {
  const token = rawToken.replace(/\.ics$/i, "").trim();
  if (token.length < 16) return null;
  const user = await prisma.user.findUnique({
    where: { calendarFeedTokenHash: hashCalendarFeedToken(token) },
    select: { id: true, isActive: true, fullName: true, email: true, orgId: true },
  });
  if (!user?.isActive) return null;
  return user;
}

export function calendarFeedUrls(origin: string, token: string) {
  const httpUrl = `${origin.replace(/\/$/, "")}/api/calendar/feed/${token}`;
  const webcalUrl = httpUrl.replace(/^https:/i, "webcal:").replace(/^http:/i, "webcal:");
  return { httpUrl, webcalUrl };
}

export function publicOrigin(req: { headers: Headers; nextUrl?: URL }): string {
  const proto =
    req.headers.get("x-forwarded-proto") ??
    req.nextUrl?.protocol.replace(":", "") ??
    "http";
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    req.nextUrl?.host ??
    "localhost:3100";
  return `${proto}://${host}`;
}

const meetingInclude = {
  organizer: { select: { fullName: true, email: true } },
  room: { select: { name: true } },
  branch: { select: { name: true } },
  participants: {
    include: { user: { select: { fullName: true, email: true } } },
  },
  agendaItems: {
    select: {
      title: true,
      durationMin: true,
      sortOrder: true,
      owner: { select: { fullName: true } },
    },
    orderBy: { sortOrder: "asc" },
  },
} as const;

export async function loadOwnMeetingsForIcs(
  userId: string,
  range?: { from?: Date; to?: Date },
) {
  const from = range?.from ?? new Date(Date.now() - FEED_PAST_MS);
  const to = range?.to ?? new Date(Date.now() + FEED_FUTURE_MS);
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { orgId: true },
  });
  return prisma.meeting.findMany({
    where: {
      ...(owner?.orgId ? { orgId: owner.orgId } : {}),
      OR: [
        { organizerId: userId },
        { participants: { some: { userId } } },
      ],
      status: { notIn: ["DRAFT", "WAITLISTED", "WAITLIST_OFFERED"] },
      startAt: { gte: from, lte: to },
    },
    include: meetingInclude,
    orderBy: { startAt: "asc" },
    take: 500,
  });
}

type FeedMeeting = Awaited<ReturnType<typeof loadOwnMeetingsForIcs>>[number];

export function meetingToIcsEvent(m: FeedMeeting, origin?: string): IcsEvent {
  const location = m.room
    ? `${m.room.name} — ${m.branch.name}`
    : m.branch.name;
  const agendaPlain = formatAgendaPlain(
    m.agendaItems.map((it) => ({
      title: it.title,
      durationMin: it.durationMin,
      ownerName: it.owner?.fullName ?? null,
    })),
  );
  return {
    uid: `${m.id}@mehrsa`,
    title: m.title,
    description: mergeTextWithVideoLink(
      mergeDescriptionWithAgenda(m.description, agendaPlain),
      m.videoProvider,
      m.videoUrl,
    ),
    location,
    startAt: m.startAt,
    endAt: m.endAt,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    status: meetingStatusToIcs(m.status),
    organizer: { name: m.organizer.fullName, email: m.organizer.email },
    attendees: m.participants
      .filter((p) => p.user.email)
      .map((p) => ({ name: p.user.fullName, email: p.user.email })),
    url: m.videoUrl || (origin ? `${origin.replace(/\/$/, "")}/meetings/${m.id}` : undefined),
  };
}

export async function buildOwnMeetingsIcs(
  userId: string,
  opts?: { from?: Date; to?: Date; origin?: string; calendarName?: string },
): Promise<string> {
  const [meetings, tz] = await Promise.all([
    loadOwnMeetingsForIcs(userId, { from: opts?.from, to: opts?.to }),
    (async () => {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { orgId: true },
      });
      return getOrgTimezone(u?.orgId ?? undefined);
    })(),
  ]);
  return buildIcsCalendar({
    events: meetings.map((m) => meetingToIcsEvent(m, opts?.origin)),
    calendarName: opts?.calendarName ?? "جلسات مهرسا",
    tz,
  });
}

export function icsResponse(body: string, filename = "mehrsa.ics", disposition: "inline" | "attachment" = "attachment") {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
