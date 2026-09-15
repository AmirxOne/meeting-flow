import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { handleError } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/people?q= — NO AUTH.
 * Minimal public directory (name / jobTitle / company only) so guests on
 * /request can pick who they want to meet. No phones, no emails.
 */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const where = q
      ? { OR: [{ name: { contains: q } }, { company: { contains: q } }, { jobTitle: { contains: q } }] }
      : {};
    const rows = await prisma.personDirectory.findMany({
      where,
      select: { id: true, name: true, jobTitle: true, company: true },
      take: 8,
      orderBy: { name: "asc" },
    });
    return Response.json({ ok: true, data: { people: rows } });
  } catch (err) {
    return handleError(err);
  }
}
