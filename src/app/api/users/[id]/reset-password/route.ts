import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { requirePermission, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { userResetPasswordSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/** POST /api/users/:id/reset-password */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("user:reset-password");
    const { id } = await params;
    const input = userResetPasswordSchema.parse(await req.json().catch(() => ({})));

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new HttpError(404, "کاربر یافت نشد", "NOT_FOUND");

    const passwordHash = await bcrypt.hash(input.password, 10);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    await prisma.session.deleteMany({ where: { userId: id } });

    await audit({
      actorId: actor.id,
      action: "RESET_PASSWORD",
      entity: "User",
      entityId: id,
      newValue: { email: target.email },
      ip: req.headers.get("x-forwarded-for"),
    });

    return ok({ reset: true });
  } catch (e) {
    return handleError(e);
  }
}
