import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { z } from "zod";
import { updateProgram, deleteProgram } from "@/server/services/appointment.service";

export const dynamic = "force-dynamic";

const windowSchema = z.object({
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  from: z.string().regex(/^\d{1,2}:\d{2}$/),
  to: z.string().regex(/^\d{1,2}:\d{2}$/),
});

const patchSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  topics: z.array(z.object({ title: z.string().trim().min(1).max(200) })).max(10).optional(),
  audienceType: z.enum(["ALL", "BRANCH", "USERS"]).optional(),
  audienceIds: z.array(z.string()).max(100).optional(),
  roomIds: z.array(z.string()).min(1).optional(),
  durationMin: z.number().int().min(10).max(240).optional(),
  bufferMin: z.number().int().min(0).max(60).optional(),
  windows: z.array(windowSchema).optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  isConfidential: z.boolean().optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).optional(),
});

/** PATCH — ویرایش برنامه (مسئول یا ادمین) */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const input = patchSchema.parse(await req.json().catch(() => ({})));
    const { validFrom, validTo, ...rest } = input;
    const program = await updateProgram(id, user, {
      ...rest,
      ...(validFrom && { validFrom: new Date(validFrom) }),
      ...(validTo && { validTo: new Date(validTo) }),
    });
    return ok({ program });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE — حذف برنامه بدون رزرو فعال (مسئول یا ادمین) */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    return ok(await deleteProgram(id, user));
  } catch (e) {
    return handleError(e);
  }
}
