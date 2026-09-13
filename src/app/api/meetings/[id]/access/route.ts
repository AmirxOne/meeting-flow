import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, fail, handleError, audit } from "@/server/http";
import {
  getAcls,
  setSectionAcl,
  SECTIONS,
  type ContentSection,
  type AclLevel,
} from "@/server/services/content-acl.service";

export const dynamic = "force-dynamic";

const aclSchema = z.object({
  section: z.enum(SECTIONS),
  level: z.enum(["ALL_PARTICIPANTS", "RESTRICTED", "ORGANIZER_ONLY"]),
  allowedUserIds: z.array(z.string()).max(100).default([]),
});

const secretarySchema = z.object({
  userIds: z.array(z.string()).max(10),
});

function isOrganizerOrAdmin(user: { id: string; isSuperAdmin?: boolean; roleKeys: string[] }, meeting: { organizerId: string }) {
  return (
    meeting.organizerId === user.id ||
    user.isSuperAdmin ||
    user.roleKeys.includes("SUPER_ADMIN") ||
    user.roleKeys.includes("ADMIN")
  );
}

/** GET — ACL state + secretaries (organizer/admin only — access metadata is itself sensitive). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await prisma.meeting.findFirst({
      where: { id, orgId: user.orgId },
      select: { organizerId: true, secretaries: { select: { user: { select: { id: true, fullName: true } } } } },
    });
    if (!meeting) return fail(404, "جلسه یافت نشد", "NOT_FOUND");
    if (!isOrganizerOrAdmin(user, meeting))
      return fail(403, "فقط برگزارکننده می‌تواند دسترسی‌ها را مدیریت کند", "FORBIDDEN");

    const acls = await getAcls(id);
    return ok({
      acls,
      secretaries: meeting.secretaries.map((s) => s.user),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** PUT — set a section's ACL. Every change is audited with the actor's identity. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = aclSchema.parse(await req.json().catch(() => ({})));
    const meeting = await prisma.meeting.findFirst({
      where: { id, orgId: user.orgId },
      select: { organizerId: true },
    });
    if (!meeting) return fail(404, "جلسه یافت نشد", "NOT_FOUND");
    if (!isOrganizerOrAdmin(user, meeting))
      return fail(403, "فقط برگزارکننده می‌تواند دسترسی‌ها را تغییر دهد", "FORBIDDEN");

    await setSectionAcl(user, id, input.section as ContentSection, input.level as AclLevel, input.allowedUserIds);
    await audit({
      actorId: user.id,
      action: "CONTENT_ACL_CHANGE",
      entity: "Meeting",
      entityId: id,
      newValue: { section: input.section, level: input.level, allowed: input.allowedUserIds.length },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ acls: await getAcls(id) });
  } catch (e) {
    return handleError(e);
  }
}

/** POST — assign secretaries (دبیران جلسه). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = secretarySchema.parse(await req.json().catch(() => ({})));
    const meeting = await prisma.meeting.findFirst({
      where: { id, orgId: user.orgId },
      select: { organizerId: true },
    });
    if (!meeting) return fail(404, "جلسه یافت نشد", "NOT_FOUND");
    if (!isOrganizerOrAdmin(user, meeting))
      return fail(403, "فقط برگزارکننده می‌تواند دبیر تعیین کند", "FORBIDDEN");

    await prisma.meetingSecretary.deleteMany({ where: { meetingId: id } });
    if (input.userIds.length > 0) {
      await prisma.meetingSecretary.createMany({
        data: input.userIds.map((userId) => ({ meetingId: id, userId })),
      });
    }
    await audit({
      actorId: user.id,
      action: "SECRETARIES_SET",
      entity: "Meeting",
      entityId: id,
      newValue: { count: input.userIds.length },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ secretaries: input.userIds });
  } catch (e) {
    return handleError(e);
  }
}
