import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";

const DELEGATE_USER_SELECT = {
  id: true,
  fullName: true,
  jobTitle: true,
  department: true,
} as const;

export type BookAsDecision =
  | { allowed: true }
  | { allowed: false; status: 403; code: "FORBIDDEN" | "NOT_DELEGATE"; message: string };

export type AddDelegateDecision =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string };

/** Pure RBAC gate: create permission is still required; a delegate row does not grant it. */
export function evaluateBookAs(input: {
  actorId: string;
  organizerId: string;
  actorHasCreate: boolean;
  delegateRowExists: boolean;
}): BookAsDecision {
  if (!input.actorHasCreate) {
    return {
      allowed: false,
      status: 403,
      code: "FORBIDDEN",
      message: "دسترسی لازم را ندارید",
    };
  }
  if (input.actorId === input.organizerId) return { allowed: true };
  if (!input.delegateRowExists) {
    return {
      allowed: false,
      status: 403,
      code: "NOT_DELEGATE",
      message: "شما نمایندهٔ این کاربر نیستید",
    };
  }
  return { allowed: true };
}

export function evaluateAddDelegate(input: {
  managerId: string;
  delegateId: string;
  delegateExists: boolean;
  sameOrg: boolean;
  delegateActive: boolean;
  alreadyExists: boolean;
}): AddDelegateDecision {
  if (input.managerId === input.delegateId) {
    return {
      ok: false,
      status: 400,
      code: "SELF_DELEGATE",
      message: "نمی‌توانید خودتان را نماینده کنید",
    };
  }
  if (!input.delegateExists || !input.sameOrg) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "کاربر یافت نشد" };
  }
  if (!input.delegateActive) {
    return { ok: false, status: 400, code: "INACTIVE", message: "کاربر غیرفعال است" };
  }
  if (input.alreadyExists) {
    return {
      ok: false,
      status: 409,
      code: "ALREADY_DELEGATE",
      message: "این کاربر از قبل نماینده است",
    };
  }
  return { ok: true };
}

export async function isDelegateOf(
  orgId: string,
  managerId: string,
  delegateId: string,
): Promise<boolean> {
  if (managerId === delegateId) return true;
  const row = await prisma.delegate.findFirst({
    where: { orgId, managerId, delegateId },
    select: { id: true },
  });
  return !!row;
}

/** Throws 403 unless actor is organizer or an appointed delegate in this org. */
export async function assertCanBookAs(
  orgId: string,
  actorId: string,
  organizerId: string,
): Promise<void> {
  if (actorId === organizerId) return;
  const ok = await isDelegateOf(orgId, organizerId, actorId);
  if (!ok) {
    throw new HttpError(403, "شما نمایندهٔ این کاربر نیستید", "NOT_DELEGATE");
  }
}

export async function resolveOrganizerId(
  orgId: string,
  actorId: string,
  requested?: string | null,
): Promise<string> {
  const organizerId = requested?.trim() || actorId;
  await assertCanBookAs(orgId, actorId, organizerId);
  return organizerId;
}

export async function listDelegatesForUser(orgId: string, userId: string) {
  const [appointed, asAssistant] = await Promise.all([
    prisma.delegate.findMany({
      where: { orgId, managerId: userId },
      include: { delegate: { select: DELEGATE_USER_SELECT } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.delegate.findMany({
      where: { orgId, delegateId: userId },
      include: { manager: { select: DELEGATE_USER_SELECT } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    delegates: appointed.map((d) => ({
      id: d.id,
      createdAt: d.createdAt,
      user: d.delegate,
    })),
    principals: asAssistant.map((d) => ({
      id: d.id,
      createdAt: d.createdAt,
      user: d.manager,
    })),
  };
}

export async function addDelegate(orgId: string, managerId: string, delegateId: string) {
  const target = await prisma.user.findFirst({
    where: { id: delegateId },
    select: { id: true, orgId: true, isActive: true },
  });
  const existing = await prisma.delegate.findFirst({
    where: { managerId, delegateId },
    select: { id: true },
  });
  const decision = evaluateAddDelegate({
    managerId,
    delegateId,
    delegateExists: !!target,
    sameOrg: !!target && target.orgId === orgId,
    delegateActive: !!target?.isActive,
    alreadyExists: !!existing,
  });
  if (!decision.ok) {
    throw new HttpError(decision.status, decision.message, decision.code);
  }

  try {
    return await prisma.delegate.create({
      data: { orgId, managerId, delegateId },
      include: { delegate: { select: DELEGATE_USER_SELECT } },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError(409, "این کاربر از قبل نماینده است", "ALREADY_DELEGATE");
    }
    throw e;
  }
}

export async function removeDelegate(orgId: string, managerId: string, id: string) {
  const row = await prisma.delegate.findFirst({
    where: { id, orgId },
  });
  if (!row) throw new HttpError(404, "نماینده یافت نشد", "NOT_FOUND");
  if (row.managerId !== managerId) {
    throw new HttpError(403, "فقط خود مدیر می‌تواند نماینده را حذف کند", "FORBIDDEN");
  }
  await prisma.delegate.delete({ where: { id } });
  return row;
}
