import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { slotsSchema } from "@/lib/validations";
import { findAvailableSlots, findQuickSlot } from "@/server/services/availability.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = slotsSchema.parse(await req.json().catch(() => ({})));

    const from = input.from
      ? new Date(input.from)
      : new Date(Date.now() + 5 * 60000);
    const to = input.to
      ? new Date(input.to)
      : new Date(from.getTime() + 7 * 86400000);

    const slots = await findAvailableSlots({
      branchId: input.branchId,
      organizerId: user.id,
      participantIds: input.participantIds,
      durationMin: input.durationMin,
      from,
      to,
      minCapacity: input.minCapacity,
      requiredEquipment: input.requiredEquipment,
    });
    return ok({ slots, quick: false });
  } catch (e) {
    return handleError(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const branchId = sp.get("branchId");
    const durationMin = Number(sp.get("durationMin") ?? 30);
    const participantIds = (sp.get("participants") ?? "").split(",").filter(Boolean);
    if (!branchId) {
      return ok({ slot: null });
    }
    const slot = await findQuickSlot({
      branchId,
      organizerId: user.id,
      participantIds,
      durationMin,
    });
    return ok({ slot, quick: true });
  } catch (e) {
    return handleError(e);
  }
}
