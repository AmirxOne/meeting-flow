import { getSessionUser } from "@/server/auth/session";
import { ok } from "@/server/http";
import { ROLE_DEFINITIONS } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return ok({ user: null });
  const roles = user.roleKeys.map((key) => ({
    key,
    name: ROLE_DEFINITIONS[key]?.name ?? key,
  }));
  return ok({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone ?? null,
      avatarUrl: user.avatarUrl,
      jobTitle: user.jobTitle,
      department: user.department,
      branchId: user.branchId,
      isSuperAdmin: user.isSuperAdmin,
      roles,
      permissions: [...user.permissions],
    },
  });
}
