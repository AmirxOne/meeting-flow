import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { ok, fail, handleError, audit } from "@/server/http";
import { minutesUpsertSchema } from "@/lib/validations";
import {
  assertCanViewMeeting,
  getMinutes,
  loadMeetingForMinutes,
  upsertMinutes,
} from "@/server/services/minutes.service";
import {
  assertCanViewSection,
  canEditContent,
  loadMeetingForAcl,
} from "@/server/services/content-acl.service";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/** GET — returns ONLY the sections this user may see. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await loadMeetingForMinutes(id, user.orgId);
    assertCanViewMeeting(user, meeting);

    const aclMeeting = await loadMeetingForAcl(id, user.orgId);
    const [canBody, canSummary] = await Promise.all([
      assertCanViewSection(user, aclMeeting, "BODY").then(() => true).catch(() => false),
      assertCanViewSection(user, aclMeeting, "SUMMARY").then(() => true).catch(() => false),
    ]);
    // fully uninvolved user gets a hard 403 — never a 200 with metadata
    if (!canBody && !canSummary) {
      const involved =
        aclMeeting.organizerId === user.id ||
        aclMeeting.participants.some((p) => p.userId === user.id);
      if (!involved) {
        return Response.json(
          { ok: false, error: { message: "دسترسی لازم را ندارید", code: "FORBIDDEN" } },
          { status: 403 },
        );
      }
    }

    const minutes = await getMinutes(id);
    if (!minutes) return ok({ minutes: null, access: { body: canBody, summary: canSummary } });

    // strip fields the user cannot see — server-side, per request
    const safe: Record<string, unknown> = {
      id: minutes.id,
      status: minutes.status,
      updatedAt: minutes.updatedAt,
      publishedAt: minutes.publishedAt,
      publishedBy: minutes.publishedBy,
    };
    if (canSummary) safe.summary = minutes.summary;
    if (canBody) {
      safe.body = minutes.body;
      safe.decisions = minutes.decisions;
    }
    return ok({ minutes: safe, access: { body: canBody, summary: canSummary } });
  } catch (e) {
    return handleError(e);
  }
}

const actionSchema = z.object({
  action: z.enum(["submit", "approve", "finalize", "reject"]),
});

/** POST — workflow transitions on the minutes (submit/approve/finalize). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { action } = actionSchema.parse(await req.json().catch(() => ({})));
    const meeting = await loadMeetingForAcl(id, user.orgId);

    // view meeting first (private meetings still require involvement)
    assertCanViewMeeting(user, await loadMeetingForMinutes(id, user.orgId));

    const minutes = await prisma.meetingMinutes.findUnique({ where: { meetingId: id } });
    if (!minutes) return fail(404, "صورتجلسه ثبت نشده است", "NOT_FOUND");

    const isOrganizer = meeting.organizerId === user.id;
    const isSecretary = meeting.secretaries.some((s) => s.userId === user.id);
    const isAdmin =
      user.isSuperAdmin || user.roleKeys.some((r) => ["SUPER_ADMIN", "ADMIN"].includes(r));

    if (action === "submit") {
      if (!isOrganizer && !isSecretary && !isAdmin)
        return fail(403, "فقط دبیر یا برگزارکننده می‌تواند ارسال کند", "FORBIDDEN");
      if (minutes.status === "FINAL")
        return fail(409, "صورتجلسه نهایی‌شده قابل تغییر نیست", "LOCKED");
      await prisma.meetingMinutes.update({
        where: { meetingId: id },
        data: { status: "PENDING_APPROVAL" },
      });
    }

    if (action === "approve") {
      // approver = designated approver, organizer, or admin
      const allowed =
        isOrganizer || isAdmin || (minutes.approverId !== null && minutes.approverId === user.id);
      if (!allowed) return fail(403, "شما تأییدکننده این صورتجلسه نیستید", "FORBIDDEN");
      if (minutes.status !== "PENDING_APPROVAL")
        return fail(409, "صورتجلسه در انتظار بررسی نیست", "BAD_STATE");
      await prisma.meetingMinutes.update({
        where: { meetingId: id },
        data: { status: "APPROVED", approverId: user.id, approvedAt: new Date() },
      });
    }

    if (action === "finalize") {
      if (!isOrganizer && !isAdmin)
        return fail(403, "فقط برگزارکننده می‌تواند نهایی کند", "FORBIDDEN");
      await prisma.meetingMinutes.update({
        where: { meetingId: id },
        data: { status: "FINAL", finalizedAt: new Date() },
      });
    }

    if (action === "reject") {
      const allowed =
        isOrganizer || isAdmin || (minutes.approverId !== null && minutes.approverId === user.id);
      if (!allowed) return fail(403, "شما تأییدکننده این صورتجلسه نیستید", "FORBIDDEN");
      if (minutes.status === "FINAL")
        return fail(409, "صورتجلسه نهایی‌شده قابل تغییر نیست", "LOCKED");
      await prisma.meetingMinutes.update({
        where: { meetingId: id },
        data: { status: "DRAFT" },
      });
    }

    await audit({
      actorId: user.id,
      action: `MINUTES_${action.toUpperCase()}`,
      entity: "Meeting",
      entityId: id,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ minutes: await getMinutes(id) });
  } catch (e) {
    return handleError(e);
  }
}

/** PUT — save draft (summary/body are independent fields). */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = minutesUpsertSchema.parse(await req.json().catch(() => ({})));
    const aclMeeting = await loadMeetingForAcl(id, user.orgId);
    if (!canEditContent(user, { ...aclMeeting, secretaries: aclMeeting.secretaries })) {
      return fail(403, "فقط دبیر یا برگزارکننده می‌تواند صورتجلسه را ثبت کند", "FORBIDDEN");
    }
    const existing = await prisma.meetingMinutes.findUnique({ where: { meetingId: id } });
    if (existing?.status === "FINAL")
      return fail(409, "صورتجلسه نهایی‌شده قابل ویرایش نیست", "LOCKED");

    const minutes = await upsertMinutes(id, user, {
      ...input,
      summary: (input as { summary?: string }).summary,
    });
    await audit({
      actorId: user.id,
      action: "MINUTES_SAVE_DRAFT",
      entity: "Meeting",
      entityId: id,
      newValue: {
        bodyLength: input.body?.length ?? 0,
        hasSummary: !!(input as { summary?: string }).summary,
      },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ minutes });
  } catch (e) {
    return handleError(e);
  }
}
