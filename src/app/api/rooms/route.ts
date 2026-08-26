import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const includeInactive = req.nextUrl.searchParams.get("all") === "1";
    const branchId = req.nextUrl.searchParams.get("branchId");

    const rooms = await prisma.meetingRoom.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: { select: { id: true, name: true } },
        floor: { select: { id: true, name: true, number: true } },
        equipment: true,
        manager: { select: { id: true, fullName: true } },
      },
      orderBy: { name: "asc" },
    });
    return ok({ rooms });
  } catch (e) {
    return handleError(e);
  }
}
