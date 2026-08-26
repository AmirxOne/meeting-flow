import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { branchCreateSchema } from "@/lib/validations";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("branch:update");
    const { id } = await params;
    const { z } = await import("zod");
    const schema = branchCreateSchema.partial().extend({ isActive: z.boolean().optional() });
    const input = schema.parse(await req.json().catch(() => ({})));

    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new HttpError(404, "شعبه یافت نشد", "NOT_FOUND");

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.address !== undefined ? { address: input.address || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.managerId !== undefined ? { managerId: input.managerId || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    if (input.isActive === false) {
      // disabling a branch also disables its rooms
      await prisma.meetingRoom.updateMany({ where: { branchId: id }, data: { isActive: false } });
    }

    await audit({
      actorId: actor.id,
      action: input.isActive === false ? "BRANCH_DISABLE" : "UPDATE",
      entity: "Branch",
      entityId: id,
      oldValue: { name: branch.name, isActive: branch.isActive },
      newValue: { name: updated.name, isActive: updated.isActive },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ branch: updated });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("branch:update");
    const { id } = await params;

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        users: { where: { isActive: true } },
        _count: { select: { meetings: true } },
      },
    });
    if (!branch) throw new HttpError(404, "شعبه یافت نشد", "NOT_FOUND");

    if (branch._count.meetings > 0) {
      throw new HttpError(
        409,
        `این شعبه ${branch._count.meetings} جلسه ثبت‌شده دارد — حذف ممکن نیست، غیرفعالش کنید`,
        "BRANCH_IN_USE",
      );
    }
    if (branch.users.length > 0) {
      throw new HttpError(
        409,
        `این شعبه ${branch.users.length} کاربر فعال دارد — ابتدا آن‌ها را منتقل کنید`,
        "BRANCH_HAS_USERS",
      );
    }

    // safe: detach everything then delete
    await prisma.user.updateMany({ where: { branchId: id }, data: { branchId: null } });
    await prisma.meeting.updateMany({ where: { branchId: id }, data: { branchId: undefined, roomId: undefined } }).catch(() => {});
    // meetings reference branch via FK Restrict default → delete meetings of this branch first (none active at this point but drafts may exist)
    await prisma.meeting.deleteMany({ where: { branchId: id } });
    await prisma.floor.deleteMany({ where: { branchId: id } });
    await prisma.roomEquipment.deleteMany({ where: { room: { branchId: id } } });
    await prisma.meetingRoom.deleteMany({ where: { branchId: id } });
    await prisma.branch.delete({ where: { id } });

    await audit({
      actorId: actor.id,
      action: "DELETE",
      entity: "Branch",
      entityId: id,
      oldValue: { name: branch.name },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
