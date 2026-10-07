/**
 * ═══════════════════════════════════════════════════════════════
 *  AI Context Builder — لایه‌ی ۱ از معماری AI اپ
 * ═══════════════════════════════════════════════════════════════
 * تک‌مسئولیت: گردآوری و ساختاردهی «همه‌ی» داده‌ی مرتبط یک جلسه
 * به‌صورت یک context object خنثی — بدون هیچ منطق AI.
 *
 * هر فیچر AI (پیشنهاد موضوع، خلاصه صورت‌جلسه، …) همین context را
 * مصرف می‌کند؛ افزودن فیلد جدید به این‌جا برای همه‌ی فیچرها در
 * دسترس قرار می‌گیرد.
 *
 * لایه‌ها:
 *   1. ai-context.service.ts   → داده (این فایل)
 *   2. ai-features/*.service   → منطق هر فیچر (پرامپت + اعتبارسنجی)
 *   3. llm-client.service.ts   → دروازه‌ی پروایدر (فعال/پشتیبان)
 */

import { prisma } from "@/server/db";

export interface MeetingAiContext {
  meeting: {
    title: string;
    description: string | null;
    status: string;
    meetingType: string;
    priority: string;
    startAt: Date;
    endAt: Date;
    durationMin: number;
    isPrivate: boolean;
    isRecurring: boolean;
    videoUrl: string | null;
    cancelReason: string | null;
  };
  organizer: { name: string; jobTitle: string | null } | null;
  room: { name: string; capacity: number | null } | null;
  branch: { name: string } | null;
  participants: {
    name: string;
    jobTitle: string | null;
    responseStatus: string | null;
    attendanceStatus: string | null;
    isOrganizer: boolean;
  }[];
  guests: { name: string; company: string | null; notes: string | null }[];
  secretaries: { name: string }[];
  agendaItems: { title: string; durationMin: number | null; owner: string | null }[];
  /** موضوعات ثبت‌شده در جلسات + وضعیت پوشش */
  topics: { title: string; reviewStatus: string; decisions: string | null; actions: string | null }[];
  /** صورت‌جلسه‌ی قبلی/موجود */
  minutes: { body: string; summary: string | null; status: string } | null;
  /** مصوبات جلسه */
  decisions: { text: string; owner: string | null; dueAt: Date | null }[];
  /** فرم رسمی دستور جلسه (تمپلیت شرکت) */
  docTemplate: {
    goals?: string;
    flow?: { title: string; start: string; end: string }[];
    questions?: { title: string; asker: string }[];
    progress?: { decision: string; owner: string; due: string; status?: string }[];
  } | null;
  /** جلسه‌ی قبلی همان سری (در صورت تکرارشونده) */
  previousInSeries: {
    title: string;
    startAt: Date;
    topics: string[];
    decisions: string[];
  } | null;
  attachments: { name: string; kind: string; mimeType: string; sizeBytes: number }[];
  /** تاریخچه‌ی رویدادهای جلسه — فشرده */
  events: { type: string; at: Date }[];
}

/** ساخت context کامل جلسه برای مصرف پرامپت‌ها */
export async function buildMeetingAiContext(meetingId: string): Promise<MeetingAiContext | null> {
  const m = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      organizer: { select: { fullName: true, jobTitle: true } },
      room: { select: { name: true, capacity: true } },
      branch: { select: { name: true } },
      participants: {
        include: { user: { select: { fullName: true, jobTitle: true } } },
      },
      guests: { select: { name: true, company: true, notes: true } },
      secretaries: { include: { user: { select: { fullName: true } } } },
      agendaItems: {
        orderBy: { sortOrder: "asc" },
        include: { owner: { select: { fullName: true } } },
      },
      minutes: {
        include: {
          topics: { orderBy: { sortOrder: "asc" } },
          decisions: { include: { owner: { select: { fullName: true } } } },
        },
      },
      attachments: { select: { originalName: true, kind: true, mimeType: true, sizeBytes: true } },
      events: { orderBy: { createdAt: "desc" }, take: 12, select: { type: true, createdAt: true } },
      series: { select: { id: true, title: true } },
    },
  });
  if (!m) return null;

  // جلسه‌ی قبلی همان سری
  let previousInSeries: MeetingAiContext["previousInSeries"] = null;
  if (m.seriesId) {
    const prev = await prisma.meeting.findFirst({
      where: { seriesId: m.seriesId, startAt: { lt: m.startAt }, status: { not: "CANCELLED" } },
      orderBy: { startAt: "desc" },
      include: {
        minutes: { include: { topics: { select: { title: true } }, decisions: { select: { text: true } } } },
      },
    });
    if (prev) {
      previousInSeries = {
        title: prev.title,
        startAt: prev.startAt,
        topics: prev.minutes?.topics.map((t) => t.title) ?? [],
        decisions: prev.minutes?.decisions.map((d) => d.text) ?? [],
      };
    }
  }

  return {
    meeting: {
      title: m.title,
      description: m.description,
      status: m.status,
      meetingType: m.meetingType,
      priority: m.priority,
      startAt: m.startAt,
      endAt: m.endAt,
      durationMin: Math.round((m.endAt.getTime() - m.startAt.getTime()) / 60000),
      isPrivate: m.isPrivate,
      isRecurring: !!m.seriesId,
      videoUrl: m.videoUrl,
      cancelReason: m.cancelReason,
    },
    organizer: m.organizer ? { name: m.organizer.fullName, jobTitle: m.organizer.jobTitle } : null,
    room: m.room ? { name: m.room.name, capacity: m.room.capacity } : null,
    branch: m.branch ? { name: m.branch.name } : null,
    participants: m.participants.map((p) => ({
      name: p.user?.fullName ?? "?",
      jobTitle: p.user?.jobTitle ?? null,
      responseStatus: p.responseStatus,
      attendanceStatus: p.attendanceStatus,
      isOrganizer: p.userId === m.organizerId,
    })),
    guests: m.guests,
    secretaries: m.secretaries.map((s) => ({ name: s.user.fullName })),
    agendaItems: m.agendaItems.map((a) => ({
      title: a.title,
      durationMin: a.durationMin,
      owner: a.owner?.fullName ?? null,
    })),
    topics: (m.minutes?.topics ?? []).map((t) => ({
      title: t.title,
      reviewStatus: t.reviewStatus,
      decisions: t.decisions,
      actions: t.actions,
    })),
    minutes: m.minutes ? { body: m.minutes.body, summary: m.minutes.summary, status: m.minutes.status } : null,
    decisions: (m.minutes?.decisions ?? []).map((d) => ({
      text: d.text,
      owner: d.owner?.fullName ?? null,
      dueAt: d.dueAt,
    })),
    docTemplate: (m.docTemplate as MeetingAiContext["docTemplate"]) ?? null,
    previousInSeries,
    attachments: m.attachments.map((a) => ({
      name: a.originalName,
      kind: a.kind,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
    })),
    events: m.events.map((e) => ({ type: e.type, at: e.createdAt })),
  };
}
