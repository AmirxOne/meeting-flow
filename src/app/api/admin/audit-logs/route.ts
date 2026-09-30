import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const actor = await requirePermission("audit:view");
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(100, Number(sp.get("pageSize") ?? 50));
    const entity = sp.get("entity");
    const action = sp.get("action");
    const actorId = sp.get("actorId");
    const from = sp.get("from");
    const to = sp.get("to");
    const q = sp.get("q")?.trim();
    const entityId = sp.get("entityId")?.trim();

    const where = {
      orgId: actor.orgId,
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
      ...(actorId ? { actorId } : {}),
      ...(entityId ? { entityId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { entityId: { contains: q, mode: "insensitive" as const } },
              { action: { contains: q.toUpperCase(), mode: "insensitive" as const } },
              { entity: { contains: q, mode: "insensitive" as const } },
              { actor: { is: { fullName: { contains: q, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return ok({ logs, total, page, pageSize });
  } catch (e) {
    return handleError(e);
  }
}
