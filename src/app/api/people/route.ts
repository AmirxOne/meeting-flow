import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";

export const dynamic = "force-dynamic";

/** People directory — searchable picker source for participants & guests. */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim() ?? "";
    const kind = sp.get("kind"); // INTERNAL | EXTERNAL | undefined (all)

    const people = await prisma.personDirectory.findMany({
      where: {
        ...(kind ? { kind } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { company: { contains: q } },
                { jobTitle: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      take: 50,
    });
    return ok({ people });
  } catch (e) {
    return handleError(e);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2, "نام حداقل ۲ کاراکتر است"),
  kind: z.enum(["INTERNAL", "EXTERNAL"]).default("EXTERNAL"),
  email: z.string().email("ایمیل نامعتبر").optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  company: z.string().trim().max(100).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(); // any user can add contacts they meet
    const input = createSchema.parse(await req.json().catch(() => ({})));

    const dup = await prisma.personDirectory.findFirst({
      where: { name: input.name, company: input.company || null },
    });
    if (dup) {
      return Response.json(
        { ok: false, error: { message: "این فرد قبلاً ثبت شده است", code: "DUPLICATE" } },
        { status: 409 },
      );
    }

    const person = await prisma.personDirectory.create({
      data: {
        name: input.name,
        kind: input.kind,
        email: input.email || null,
        phone: input.phone || null,
        company: input.company || null,
        jobTitle: input.jobTitle || null,
        notes: input.notes || null,
      },
    });
    await audit({
      actorId: actor.id,
      action: "CREATE",
      entity: "PersonDirectory",
      entityId: person.id,
      newValue: { name: person.name, kind: person.kind },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ person }, 201);
  } catch (e) {
    return handleError(e);
  }
}
