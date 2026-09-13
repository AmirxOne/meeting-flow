import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, fail, handleError, audit } from "@/server/http";
import {
  assertCanViewMeeting,
} from "@/server/services/minutes.service";
import {
  assertCanViewSection,
  canEditContent,
  loadMeetingForAcl,
  filterTopicsForUser,
} from "@/server/services/content-acl.service";

export const dynamic = "force-dynamic";

const topicSchema = z.object({
  title: z.string().trim().min(1).max(200),
  agendaItemId: z.string().nullish(),
  reviewStatus: z.enum(["COVERED", "PARTIAL", "SKIPPED"]).default("COVERED"),
  notes: z.string().trim().max(4000).nullish(),
  decisions: z.string().trim().max(4000).nullish(),
  actions: z.string().trim().max(4000).nullish(),
  sortOrder: z.number().int().min(0).default(0),
  visibility: z.enum(["OPEN", "RESTRICTED"]).default("OPEN"),
  allowedUserIds: z.array(z.string()).max(100).default([]),
});

/** GET — topics visible to THIS user (restricted ones removed entirely). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await prisma.meeting.findFirst({
      where: { id, orgId: user.orgId },
      select: {
        id: true,
        organizerId: true,
        isPrivate: true,
        participants: { select: { userId: true } },
        secretaries: { select: { userId: true } },
      },
    });
    if (!meeting) return fail(404, "جلسه یافت نشد", "NOT_FOUND");
    assertCanViewMeeting(user, meeting as Parameters<typeof assertCanViewMeeting>[1]);
    await assertCanViewSection(user, meeting, "TOPICS");

    const all = await prisma.meetingTopic.findMany({
      where: { meetingId: id },
      orderBy: { sortOrder: "asc" },
    });
    const visible = filterTopicsForUser(user, meeting, all);
    return ok({
      topics: visible.map((t) => ({
        id: t.id,
        title: t.title,
        agendaItemId: t.agendaItemId,
        reviewStatus: t.reviewStatus,
        notes: t.notes,
        decisions: t.decisions,
        actions: t.actions,
        sortOrder: t.sortOrder,
        visibility: t.visibility,
      })),
      // meta: how many are hidden from me (count only — no titles leaked)
      hiddenCount: all.length - visible.length,
    });
  } catch (e) {
    return handleError(e);
  }
}

/** POST — secretary records a raised topic. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = topicSchema.parse(await req.json().catch(() => ({})));
    const meeting = await loadMeetingForAcl(id, user.orgId);
    if (!canEditContent(user, meeting)) {
      return fail(403, "فقط دبیر یا برگزارکننده می‌تواند موضوع ثبت کند", "FORBIDDEN");
    }
    const topic = await prisma.meetingTopic.create({
      data: {
        meetingId: id,
        agendaItemId: input.agendaItemId ?? null,
        title: input.title,
        reviewStatus: input.reviewStatus,
        notes: input.notes ?? null,
        decisions: input.decisions ?? null,
        actions: input.actions ?? null,
        sortOrder: input.sortOrder,
        visibility: input.visibility,
        allowedUserIds: input.allowedUserIds,
        createdById: user.id,
      },
    });
    await audit({
      actorId: user.id,
      action: "TOPIC_CREATE",
      entity: "MeetingTopic",
      entityId: topic.id,
      newValue: { title: topic.title, visibility: topic.visibility },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ topic }, 201);
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH — update a topic (ownership of edit rights re-checked every request). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const topicId = body.topicId as string | undefined;
    if (!topicId) return fail(400, "شناسه موضوع لازم است", "BAD_REQUEST");

    const topic = await prisma.meetingTopic.findUnique({
      where: { id: topicId },
      select: { meetingId: true },
    });
    if (!topic || topic.meetingId !== id)
      return fail(404, "موضوع یافت نشد", "NOT_FOUND");

    const meeting = await loadMeetingForAcl(id, user.orgId);
    if (!canEditContent(user, meeting)) {
      return fail(403, "فقط دبیر یا برگزارکننده می‌تواند موضوع ویرایش کند", "FORBIDDEN");
    }

    const input = topicSchema.partial().parse(body);
    const updated = await prisma.meetingTopic.update({
      where: { id: topicId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.reviewStatus !== undefined ? { reviewStatus: input.reviewStatus } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        ...(input.decisions !== undefined ? { decisions: input.decisions ?? null } : {}),
        ...(input.actions !== undefined ? { actions: input.actions ?? null } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(input.allowedUserIds !== undefined ? { allowedUserIds: input.allowedUserIds } : {}),
      },
    });
    await audit({
      actorId: user.id,
      action: "TOPIC_UPDATE",
      entity: "MeetingTopic",
      entityId: topicId,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ topic: updated });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE — remove a topic. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const url = new URL(req.url);
    const topicId = url.searchParams.get("topicId");
    if (!topicId) return fail(400, "شناسه موضوع لازم است", "BAD_REQUEST");

    const topic = await prisma.meetingTopic.findUnique({
      where: { id: topicId },
      select: { meetingId: true },
    });
    if (!topic || topic.meetingId !== id)
      return fail(404, "موضوع یافت نشد", "NOT_FOUND");

    const meeting = await loadMeetingForAcl(id, user.orgId);
    if (!canEditContent(user, meeting)) {
      return fail(403, "دسترسی لازم را ندارید", "FORBIDDEN");
    }
    await prisma.meetingTopic.delete({ where: { id: topicId } });
    await audit({
      actorId: user.id,
      action: "TOPIC_DELETE",
      entity: "MeetingTopic",
      entityId: topicId,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
