import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, fail, handleError, audit } from "@/server/http";

export const dynamic = "force-dynamic";

const templateSchema = z.object({
  agenda: z
    .array(
      z.object({
        title: z.string().trim().max(300),
        presenter: z.string().trim().max(120).default(""),
        schedule: z.string().trim().max(60).default(""),
      }),
    )
    .max(40)
    .default([]),
  decisions: z
    .array(
      z.object({
        text: z.string().trim().max(800),
        owner: z.string().trim().max(120).default(""),
        due: z.string().trim().max(40).default(""),
      }),
    )
    .max(40)
    .default([]),
});

/** GET — تمپلیت رسمی جلسه (دستور جلسه + صورت‌جلسه) */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await prisma.meeting.findFirst({
      where: { id, orgId: user.orgId },
      select: {
        docTemplate: true,
        organizerId: true,
        participants: { select: { userId: true } },
        isPrivate: true,
      },
    });
    if (!meeting) return fail(404, "جلسه یافت نشد", "NOT_FOUND");

    const tpl = meeting.docTemplate as { agenda?: unknown[]; decisions?: unknown[] } | null;
    return ok({
      template: tpl
        ? { agenda: (tpl.agenda ?? []) as object[], decisions: (tpl.decisions ?? []) as object[] }
        : null,
    });
  } catch (e) {
    return handleError(e);
  }
}

/** PUT — ذخیره‌ی تمپلیت (دبیر/برگزارکننده) */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = templateSchema.parse(await req.json().catch(() => ({})));

    const meeting = await prisma.meeting.findFirst({
      where: { id, orgId: user.orgId },
      select: { organizerId: true },
    });
    if (!meeting) return fail(404, "جلسه یافت نشد", "NOT_FOUND");

    const isSecretary = await prisma.meetingSecretary.findFirst({
      where: { meetingId: id, userId: user.id },
    });
    const canEdit = meeting.organizerId === user.id || !!isSecretary || user.isSuperAdmin;
    if (!canEdit) {
      return fail(403, "فقط برگزارکننده یا دبیر جلسه می‌تواند تمپلیت را تکمیل کند", "FORBIDDEN");
    }

    const template = JSON.parse(
      JSON.stringify({ agenda: input.agenda, decisions: input.decisions }),
    ) as object;

    await prisma.meeting.update({ where: { id }, data: { docTemplate: template } });
    await audit({
      actorId: user.id,
      action: "MEETING_DOC_TEMPLATE_SAVE",
      entity: "Meeting",
      entityId: id,
      newValue: { agenda: input.agenda.length, decisions: input.decisions.length },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ template });
  } catch (e) {
    return handleError(e);
  }
}
