import { NextRequest } from "next/server";
import { z } from "zod";
import { validateReminderOffsets } from "@/lib/reminder-offsets";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requirePermission("policy:manage");
    const org = await prisma.organization.findUnique({
      where: { id: actor.orgId },
      include: { policies: { orderBy: { key: "asc" } } },
    });
    return ok({ org, policies: org?.policies ?? [] });
  } catch (e) {
    return handleError(e);
  }
}

const updateSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.number())]),
  description: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requirePermission("policy:manage");
    const input = updateSchema.parse(await req.json().catch(() => ({})));
    let value: string | number | boolean | number[] = input.value;
    if (input.key === "defaultReminderOffsets") {
      const checked = validateReminderOffsets(input.value);
      if (!checked.ok) {
        return Response.json(
          { ok: false, error: { message: checked.error, code: "VALIDATION" } },
          { status: 400 },
        );
      }
      value = checked.offsets;
    }
    if (input.key === "holidayBooking") {
      if (input.value !== "BLOCK" && input.value !== "REQUIRE_APPROVAL") {
        return Response.json(
          { ok: false, error: { message: "سیاست رزرو تعطیل نامعتبر است", code: "VALIDATION" } },
          { status: 400 },
        );
      }
    }
    const org = await prisma.organization.findUnique({ where: { id: actor.orgId } });
    if (!org) return ok({ updated: false });
    const updated = await prisma.meetingPolicy.upsert({
      where: { orgId_key: { orgId: org.id, key: input.key } },
      update: { value: value as object, updatedBy: actor.id },
      create: {
        orgId: org.id,
        key: input.key,
        value: value as object,
        updatedBy: actor.id,
      },
    });
    await audit({
      actorId: actor.id, action: "POLICY_UPDATE", entity: "MeetingPolicy",
      entityId: updated.id, newValue: { key: input.key, value },
    });
    return ok({ policy: updated });
  } catch (e) {
    return handleError(e);
  }
}
