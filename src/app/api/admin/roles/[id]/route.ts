import { NextRequest } from "next/server";
import { requirePermission, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { roleUpdateSchema } from "@/lib/validations";
import { deleteRole, listRoles, updateRole } from "@/server/services/role.service";

export const dynamic = "force-dynamic";

/** GET /api/admin/roles/:id */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("role:manage");
    const { id } = await params;
    const role = (await listRoles()).find((r) => r.id === id);
    if (!role) throw new HttpError(404, "نقش یافت نشد", "NOT_FOUND");
    return ok({ role });
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/admin/roles/:id */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("role:manage");
    const { id } = await params;
    const input = roleUpdateSchema.parse(await req.json().catch(() => ({})));
    const role = await updateRole(id, input);
    await audit({
      actorId: actor.id,
      action: "UPDATE",
      entity: "Role",
      entityId: id,
      newValue: { name: role.name, permissionKeys: role.permissionKeys },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ role });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/admin/roles/:id */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("role:manage");
    const { id } = await params;
    await deleteRole(id);
    await audit({
      actorId: actor.id,
      action: "DELETE",
      entity: "Role",
      entityId: id,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
