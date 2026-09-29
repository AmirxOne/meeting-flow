import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, fail, handleError, audit } from "@/server/http";

export const dynamic = "force-dynamic";

/* فرم کامل دستور جلسه — مطابق تمپلیت رسمی شرکت */
const templateSchema = z.object({
  title: z.string().trim().max(300).optional(),
  secretary: z.string().trim().max(120).optional(),
  attendees: z.string().trim().max(2000).optional(),
  goals: z.string().trim().max(4000).optional(),
  appendix: z.string().trim().max(8000).optional(),
  /** روند جلسه */
  flow: z
    .array(z.object({ title: z.string().trim().max(300), start: z.string().trim().max(20), end: z.string().trim().max(20) }))
    .max(40)
    .optional(),
  /** ابهامات و سوالات حاضرین */
  questions: z
    .array(z.object({ title: z.string().trim().max(300), asker: z.string().trim().max(120) }))
    .max(40)
    .optional(),
  /** پیشرفت مصوبات قبلی / مصوبات این جلسه */
  progress: z
    .array(
      z.object({
        decision: z.string().trim().max(800),
        owner: z.string().trim().max(120),
        due: z.string().trim().max(40),
        status: z.string().trim().max(120).optional(),
      }),
    )
    .max(40)
    .optional(),
  /** فرم صورت‌جلسه */
  minTitle: z.string().trim().max(300).optional(),
  minAttendees: z.string().trim().max(2000).optional(),
  minOptionalAttendees: z.string().trim().max(2000).optional(),
  minManager: z.string().trim().max(120).optional(),
  minFlow: z.string().trim().max(8000).optional(),
  minAppendix: z.string().trim().max(8000).optional(),
});

/** GET — فرم رسمی جلسه */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await prisma.meeting.findFirst({
      where: { id, orgId: user.orgId },
      select: { docTemplate: true },
    });
    if (!meeting) return fail(404, "جلسه یافت نشد", "NOT_FOUND");
    const tpl = meeting.docTemplate as object | null;
    return ok({ template: tpl });
  } catch (e) {
    return handleError(e);
  }
}

/** PUT — ذخیره‌ی فرم (برگزارکننده/دبیر/ادمین) */
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
      return fail(403, "فقط برگزارکننده یا دبیر جلسه می‌تواند فرم را تکمیل کند", "FORBIDDEN");
    }

    const template = JSON.parse(JSON.stringify(input)) as object;

    await prisma.meeting.update({ where: { id }, data: { docTemplate: template } });
    await audit({
      actorId: user.id,
      action: "MEETING_DOC_TEMPLATE_SAVE",
      entity: "Meeting",
      entityId: id,
      newValue: {
        flow: input.flow?.length ?? 0,
        questions: input.questions?.length ?? 0,
        progress: input.progress?.length ?? 0,
      },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ template });
  } catch (e) {
    return handleError(e);
  }
}
