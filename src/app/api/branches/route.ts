import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      include: {
        manager: { select: { id: true, fullName: true } },
        floors: { orderBy: { number: "asc" } },
        _count: { select: { rooms: true, users: true } },
      },
      orderBy: { name: "asc" },
    });
    return ok({ branches });
  } catch (e) {
    return handleError(e);
  }
}
