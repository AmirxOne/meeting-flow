/**
 * Smart Scheduling Service — orchestration
 * Draft در SystemMeta ذخیره می‌شود؛ اعمال نهایی تراکنشی با re-check.
 */

import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import {
  scheduleRequests,
  validatePlan,
  type SchedRequest,
  type SchedConstraints,
  type SchedAssignment,
} from "./smart-schedule-engine";
import { llmChat, ensureAiAvailable } from "../llm-client.service";

const DRAFT_KEY = "smart-schedule:draft";

export interface SmartPlanDraft {
  id: string;
  createdAt: string;
  windowFrom: string;
  windowTo: string;
  assignments: {
    requestId: string;
    title: string;
    start: string;
    end: string;
    roomId: string | null;
    roomName: string | null;
    priorityScore: number;
    reason: string;
  }[];
  unscheduled: { requestId: string; title: string; reason: string; alternatives?: { start: string; end: string }[] }[];
  aiSummary: string | null;
  stats: { total: number; scheduled: number; unscheduled: number; elapsedMs: number };
}

/** جمع‌آوری محدودیت‌ها از داده‌ی واقعی سازمان */
async function buildConstraints(orgId: string, windowFrom: Date, windowTo: Date): Promise<{ c: SchedConstraints; roomBusy: { roomId: string; from: Date; to: Date }[] }> {
  const [rooms, holidays, meetings] = await Promise.all([
    prisma.meetingRoom.findMany({
      where: { orgId },
      select: { id: true, branchId: true, capacity: true, isActive: true, name: true },
    }),
    prisma.orgHoliday.findMany({ where: { orgId }, select: { dateIso: true } }),
    prisma.meeting.findMany({
      where: {
        orgId,
        startAt: { lte: windowTo },
        endAt: { gte: windowFrom },
        status: { in: ["CONFIRMED", "PENDING_APPROVAL", "IN_PROGRESS"] },
      },
      select: { roomId: true, startAt: true, endAt: true, participants: { select: { userId: true } }, organizerId: true },
    }),
  ]);

  const busy: { userId: string; from: Date; to: Date }[] = [];
  const roomBusy: { roomId: string; from: Date; to: Date }[] = [];
  for (const m of meetings) {
    for (const p of m.participants) busy.push({ userId: p.userId, from: m.startAt, to: m.endAt });
    busy.push({ userId: m.organizerId, from: m.startAt, to: m.endAt });
    if (m.roomId) roomBusy.push({ roomId: m.roomId, from: m.startAt, to: m.endAt });
  }

  return {
    c: {
      windowFrom,
      windowTo,
      workStartMin: 8 * 60, // 08:00 — قابل‌گسترش به پالیسی
      workEndMin: 18 * 60, // 18:00
      workDays: [6, 0, 1, 2, 3], // شنبه تا چهارشنبه
      holidaysIso: new Set(holidays.map((h) => h.dateIso)),
      rooms: rooms.map((r) => ({ id: r.id, branchId: r.branchId, capacity: r.capacity, active: r.isActive, name: r.name })),
      busy,
    },
    roomBusy,
  };
}

/** اجرای زمان‌بندی هوشمند — Draft تولید می‌کند، چیزی را تغییر نمی‌دهد */
export async function generateSmartPlan(input: {
  orgId: string;
  windowFrom: Date;
  windowTo: Date;
  useAi: boolean;
}): Promise<SmartPlanDraft> {
  // درخواست‌های واجد شرایط: OPEN بدون جلسه‌ی ساخته‌شده
  const requests = await prisma.meetingRequest.findMany({
    where: {
      orgId: input.orgId,
      status: "OPEN",
      meetingId: null,
    },
    select: {
      id: true, title: true, urgency: true, durationMin: true,
      prefFrom: true, prefTo: true, prefSlots: true,
      participantIds: true, attendeeCount: true, venue: true, requesterId: true,
    },
    orderBy: { createdAt: "asc" },
  });
  if (requests.length === 0) throw new HttpError(400, "درخواست بازِ واجد شرایطی وجود ندارد", "NO_REQUESTS");

  const { c, roomBusy } = await buildConstraints(input.orgId, input.windowFrom, input.windowTo);

  const schedReqs: SchedRequest[] = requests.map((r) => ({
    id: r.id,
    title: r.title,
    urgency: r.urgency,
    durationMin: r.durationMin,
    prefFrom: r.prefFrom,
    prefTo: r.prefTo,
    prefSlots: (r.prefSlots as { from: string; to: string }[] | null) ?? null,
    participantIds: r.requesterId ? [...new Set([r.requesterId, ...r.participantIds])] : r.participantIds,
    attendeeCount: r.attendeeCount,
    venue: r.venue,
  }));

  // موتور — تخصیص زمان توسط کد
  const result = scheduleRequests(schedReqs, c, roomBusy);

  // AI — فقط خلاصه‌ی تحلیلی برنامه (نه تصمیم‌گیرنده)
  let aiSummary: string | null = null;
  if (input.useAi) {
    try {
      await ensureAiAvailable();
      const r = await llmChat({
        messages: [
          {
            role: "system",
            content: `You are a scheduling analyst. Given a draft meeting schedule, write a SHORT Persian (Farsi) summary (max 4 lines): overall fit, notable risks (tight back-to-back meetings, heavy days), and one practical suggestion. No markdown. No fabricated data.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              window: [input.windowFrom.toISOString(), input.windowTo.toISOString()],
              scheduled: result.assignments.map((a) => ({ title: schedReqs.find((r2) => r2.id === a.requestId)?.title, start: a.start, durationMin: schedReqs.find((r2) => r2.id === a.requestId)?.durationMin })),
              unscheduled: result.unscheduled.map((u) => ({ title: u.title, reason: u.reason })),
            }),
          },
        ],
        temperature: 0.3,
        maxTokens: 600,
        purpose: "smart-schedule-summary",
      });
      aiSummary = r.text.slice(0, 600);
    } catch {
      aiSummary = null; // AI قطع است — برنامه بدون خلاصه معتبر است
    }
  }

  const roomMap = new Map<string, string>(c.rooms.map((r) => [r.id, r.name ?? r.id]));
  const titleMap = new Map(schedReqs.map((r) => [r.id, r.title]));

  const draft: SmartPlanDraft = {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    windowFrom: input.windowFrom.toISOString(),
    windowTo: input.windowTo.toISOString(),
    assignments: result.assignments.map((a) => ({
      requestId: a.requestId,
      title: titleMap.get(a.requestId) ?? "?",
      start: a.start.toISOString(),
      end: a.end.toISOString(),
      roomId: a.roomId,
      roomName: a.roomId ? (roomMap.get(a.roomId) ?? null) : null,
      priorityScore: a.priorityScore,
      reason: a.reason,
    })),
    unscheduled: result.unscheduled.map((u) => ({
      requestId: u.requestId,
      title: u.title,
      reason: u.reason,
      alternatives: u.alternatives?.map((al) => ({ start: al.start.toISOString(), end: al.end.toISOString() })),
    })),
    aiSummary,
    stats: result.stats,
  };

  await prisma.systemMeta.upsert({
    where: { key: DRAFT_KEY },
    create: { key: DRAFT_KEY, value: draft as unknown as object },
    update: { value: draft as unknown as object },
  });
  return draft;
}

/** ویرایش Draft (تغییر دستی زمان/اتاق توسط ادمین) + اعتبارسنجی مجدد */
export async function updateDraftAssignment(input: {
  orgId: string;
  draftId: string;
  requestId: string;
  start: Date;
  end: Date;
  roomId: string | null;
}): Promise<{ draft: SmartPlanDraft; validation: { ok: boolean; errors: { requestId: string; message: string }[] } }> {
  const row = await prisma.systemMeta.findUnique({ where: { key: DRAFT_KEY } });
  const draft = row?.value as unknown as SmartPlanDraft | null;
  if (!draft || draft.id !== input.draftId) throw new HttpError(409, "برنامه‌ی پیش‌نویس یافت نشد یا منقضی شده — دوباره تولید کنید", "DRAFT_STALE");

  const a = draft.assignments.find((x) => x.requestId === input.requestId);
  if (!a) throw new HttpError(404, "این درخواست در برنامه نیست", "NOT_IN_PLAN");
  a.start = input.start.toISOString();
  a.end = input.end.toISOString();
  a.roomId = input.roomId;
  a.roomName = input.roomId ? (await prisma.meetingRoom.findUnique({ where: { id: input.roomId }, select: { name: true } }))?.name ?? null : null;

  await prisma.systemMeta.update({ where: { key: DRAFT_KEY }, data: { value: draft as unknown as object } });

  const { c, roomBusy } = await buildConstraints(input.orgId, new Date(draft.windowFrom), new Date(draft.windowTo));
  const reqs = await prisma.meetingRequest.findMany({
    where: { orgId: input.orgId, status: "OPEN", meetingId: null },
    select: { id: true, title: true, urgency: true, durationMin: true, prefFrom: true, prefTo: true, prefSlots: true, participantIds: true, attendeeCount: true, venue: true, requesterId: true },
  });
  const schedReqs: SchedRequest[] = reqs.map((r) => ({
    id: r.id, title: r.title, urgency: r.urgency, durationMin: r.durationMin,
    prefFrom: r.prefFrom, prefTo: r.prefTo,
    prefSlots: (r.prefSlots as { from: string; to: string }[] | null) ?? null,
    participantIds: r.requesterId ? [...new Set([r.requesterId, ...r.participantIds])] : r.participantIds,
    attendeeCount: r.attendeeCount, venue: r.venue,
  }));
  const validation = validatePlan(
    draft.assignments.map((x) => ({ requestId: x.requestId, start: new Date(x.start), end: new Date(x.end), roomId: x.roomId })),
    c,
    schedReqs,
  );
  void roomBusy;
  return { draft, validation };
}

/** اعمال نهایی — تراکنشی، idempotent، با re-check کامل */
export async function applySmartPlan(input: { orgId: string; userId: string; draftId: string }): Promise<{ created: number; meetings: { id: string; title: string }[] }> {
  const row = await prisma.systemMeta.findUnique({ where: { key: DRAFT_KEY } });
  const draft = row?.value as unknown as SmartPlanDraft | null;
  if (!draft || draft.id !== input.draftId) throw new HttpError(409, "برنامه‌ی پیش‌نویس یافت نشد یا منقضی شده — دوباره تولید کنید", "DRAFT_STALE");

  // re-check: درخواست‌ها هنوز OPEN و بدون جلسه‌اند؟
  const reqs = await prisma.meetingRequest.findMany({
    where: { orgId: input.orgId, id: { in: draft.assignments.map((a) => a.requestId) } },
    select: { id: true, status: true, meetingId: true, title: true, requesterId: true, participantIds: true, durationMin: true, venue: true, description: true, urgency: true, isPrivate: true },
  });
  const changed = reqs.filter((r) => r.status !== "OPEN" || r.meetingId);
  if (changed.length) throw new HttpError(409, `${changed.length} درخواست از زمان تولید برنامه تغییر کرده — برنامه را دوباره تولید کنید`, "PLAN_STALE");

  // اعتبارسنجی نهایی همان لحظه
  const { c } = await buildConstraints(input.orgId, new Date(draft.windowFrom), new Date(draft.windowTo));
  const schedReqs: SchedRequest[] = reqs.map((r) => ({
    id: r.id, title: r.title, urgency: r.urgency, durationMin: r.durationMin,
    prefFrom: null, prefTo: null, prefSlots: null,
    participantIds: r.requesterId ? [...new Set([r.requesterId, ...r.participantIds])] : r.participantIds,
    attendeeCount: null, venue: r.venue,
  }));
  const v = validatePlan(
    draft.assignments.map((x) => ({ requestId: x.requestId, start: new Date(x.start), end: new Date(x.end), roomId: x.roomId })),
    c,
    schedReqs,
  );
  if (!v.ok) throw new HttpError(409, `برنامه معتبر نیست: ${v.errors[0]?.message ?? ""}`, "PLAN_INVALID");

  const created: { id: string; title: string }[] = [];

  // کاربران معتبر — participantIds قدیمی ممکن است به کاربر حذف‌شده اشاره کنند (FK)
  const validUsers = new Set(
    (await prisma.user.findMany({ where: { orgId: input.orgId }, select: { id: true } })).map((u) => u.id),
  );

  // تراکنش: جلسه‌ها + بستن درخواست‌ها یکجا
  await prisma.$transaction(async (tx) => {
    for (const a of draft.assignments) {
      const req = reqs.find((r) => r.id === a.requestId)!;
      const allIds = req.requesterId ? [...new Set([req.requesterId, ...req.participantIds])] : req.participantIds;
      const safeIds = allIds.filter((uid) => validUsers.has(uid));
      if (safeIds.length === 0) safeIds.push(input.userId); // حداقل برگزارکننده = ادمین
      const meeting = await tx.meeting.create({
        data: {
          orgId: input.orgId,
          title: req.title,
          description: req.description,
          organizerId: req.requesterId ?? input.userId,
          createdById: input.userId,
          roomId: a.roomId,
          startAt: new Date(a.start),
          endAt: new Date(a.end),
          status: "CONFIRMED",
          meetingType: "INTERNAL",
          priority: req.urgency === "URGENT" ? "HIGH" : "NORMAL",
          isPrivate: req.isPrivate,
          participants: {
            create: safeIds.map((uid) => ({
              userId: uid,
              role: uid === (req.requesterId ?? input.userId) ? "ORGANIZER" : "ATTENDEE",
            })),
          },
        },
      });
      await tx.meetingRequest.update({
        where: { id: a.requestId },
        data: { status: "SCHEDULED", meetingId: meeting.id },
      });
      created.push({ id: meeting.id, title: meeting.title });
    }
    // حذف Draft پس از اعمال — idempotency
    await tx.systemMeta.delete({ where: { key: DRAFT_KEY } }).catch(() => undefined);
  });

  return { created: created.length, meetings: created };
}

export async function getDraft(): Promise<SmartPlanDraft | null> {
  const row = await prisma.systemMeta.findUnique({ where: { key: DRAFT_KEY } });
  return (row?.value as unknown as SmartPlanDraft) ?? null;
}
