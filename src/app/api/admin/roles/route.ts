import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { roleCreateSchema } from "@/lib/validations";
import { createRole, getPermissionCatalog, listRoles } from "@/server/services/role.service";

export const dynamic = "force-dynamic";

/** GET /api/admin/roles — list roles + permission catalog */
export async function GET() {
  try {
    await requirePermission("role:manage");
    const [roles, catalog] = await Promise.all([listRoles(), Promise.resolve(getPermissionCatalog())]);
    return ok({ roles, catalog });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/admin/roles — create custom role */
export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("role:manage");
    const input = roleCreateSchema.parse(await req.json().catch(() => ({})));
    const role = await createRole(input);
    await audit({
      actorId: actor.id,
      action: "CREATE",
      entity: "Role",
      entityId: role.id,
      newValue: { key: role.key, permissionKeys: role.permissionKeys },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ role }, 201);
  } catch (e) {
    return handleError(e);
  }
}
