import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { profileSelfUpdateSchema } from "@/lib/validations";
import { updateSelfProfile } from "@/server/services/profile.service";

export const dynamic = "force-dynamic";

/** PATCH /api/auth/profile — self-service profile fields only. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = profileSelfUpdateSchema.parse(await req.json().catch(() => ({})));
    const updated = await updateSelfProfile(user.id, input);

    await audit({
      actorId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      newValue: {
        fullName: updated.fullName,
        phone: updated.phone,
        jobTitle: updated.jobTitle,
        department: updated.department,
      },
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({
      user: {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        phone: updated.phone,
        jobTitle: updated.jobTitle,
        department: updated.department,
        branchId: updated.branchId,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
