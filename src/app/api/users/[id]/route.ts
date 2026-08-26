import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { userUpdateSchema } from "@/lib/validations";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("user:update");
    const { id } = await params;
    const input = userUpdateSchema.parse(await req.json().catch(() => ({})));

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new HttpError(404, "کاربر یافت نشد", "NOT_FOUND");

    // privilege escalation guard: only role:manage holders may change roles
    if (input.roleKeys) {
      const actorPerms = await prisma.userRole.findFirst({
        where: {
          userId: actor.id,
          role: { key: { in: ["SUPER_ADMIN", "ADMIN"] } },
        },
      });
      if (!actorPerms && !actor.isSuperAdmin) {
        throw new HttpError(403, "تغییر نقش مجاز نیست", "FORBIDDEN");
      }
      const roles = await prisma.role.findMany({ where: { key: { in: input.roleKeys } } });
      await prisma.userRole.deleteMany({ where: { userId: id } });
      await prisma.userRole.createMany({
        data: roles.map((r) => ({ userId: id, roleId: r.id })),
      });
    }

    if (input.isActive === false && id === actor.id) {
      throw new HttpError(400, "نمی‌توانید خودتان را غیرفعال کنید", "BAD_REQUEST");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(input.fullName ? { fullName: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle || null } : {}),
        ...(input.department !== undefined ? { department: input.department || null } : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    if (input.isActive === false) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }

    await audit({
      actorId: actor.id, action: "UPDATE", entity: "User", entityId: id,
      oldValue: { isActive: target.isActive, fullName: target.fullName },
      newValue: { isActive: updated.isActive, fullName: updated.fullName },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ user: { id: updated.id } });
  } catch (e) {
    return handleError(e);
  }
}
