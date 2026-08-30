import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireUser, requirePermission, can } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { userCreateSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireUser();
    const manage = can(actor, "user:update");
    const q = req.nextUrl.searchParams.get("q");

    const users = await prisma.user.findMany({
      where: {
        ...(manage ? {} : { isActive: true }),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q } },
                ...(manage ? [{ email: { contains: q } }] : []),
              ],
            }
          : {}),
      },
      select: manage
        ? {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            jobTitle: true,
            department: true,
            isActive: true,
            branchId: true,
            branch: { select: { id: true, name: true } },
            roles: { include: { role: { select: { key: true, name: true } } } },
          }
        : {
            id: true,
            fullName: true,
            branch: { select: { id: true, name: true } },
            roles: { include: { role: { select: { key: true, name: true } } } },
          },
      orderBy: { fullName: "asc" },
      take: 200,
    });
    return ok({ users });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("user:create");
    const input = userCreateSchema.parse(await req.json().catch(() => ({})));
    const exists = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (exists) {
      return Response.json(
        { ok: false, error: { message: "این ایمیل قبلاً ثبت شده است", code: "DUPLICATE" } },
        { status: 409 },
      );
    }
    const roles = await prisma.role.findMany({ where: { key: { in: input.roleKeys } } });
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        phone: input.phone || null,
        passwordHash,
        jobTitle: input.jobTitle || null,
        department: input.department || null,
        branchId: input.branchId || null,
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
    });
    await audit({
      actorId: actor.id, action: "CREATE", entity: "User", entityId: user.id,
      newValue: { email: user.email, roles: input.roleKeys },
      ip: req.headers.get("x-forwarded-for"),
    });
    // mirror into the shared people directory (internal member)
    await prisma.personDirectory.upsert({
      where: { userId: user.id },
      update: { name: user.fullName, email: user.email, jobTitle: user.jobTitle, kind: "INTERNAL" },
      create: {
        name: user.fullName,
        kind: "INTERNAL",
        email: user.email,
        phone: user.phone,
        jobTitle: user.jobTitle,
        userId: user.id,
      },
    }).catch(() => {});
    return ok({ user: { id: user.id, email: user.email } }, 201);
  } catch (e) {
    return handleError(e);
  }
}
