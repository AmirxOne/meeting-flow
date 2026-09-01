import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { reportError } from "@/server/report-error";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 });
}

export function fail(status: number, message: string, code?: string, extra?: unknown) {
  return NextResponse.json(
    { ok: false, error: { message, code, extra } },
    { status },
  );
}

export function handleError(error: unknown, context?: { source?: string }) {
  if (error instanceof HttpError) {
    return fail(error.status, error.message, error.code, error.extra);
  }
  if (error instanceof ZodError) {
    const first = error.errors[0];
    return fail(
      400,
      `${first?.path.join(".") || "ورودی"}: ${first?.message ?? "نامعتبر"}`,
      "VALIDATION_ERROR",
      error.errors,
    );
  }
  const msg = error instanceof Error ? error.message : "خطای داخلی سرور";
  if (msg.includes("overlap") || msg.includes("exclusion")) {
    return fail(409, "تداخل زمانی: این بازه قبلاً رزرو شده است", "ROOM_CONFLICT");
  }
  console.error("[api]", error);
  reportError(error, { tags: { source: context?.source ?? "api" } });
  return fail(500, "خطای داخلی سرور", "INTERNAL");
}

/** Wrap a route handler with uniform error responses. */
export function route<T>(handler: () => Promise<NextResponse<T> | NextResponse>) {
  return handler().catch(handleError);
}

// ── Audit logging ─────────────────────────────────────────────

export async function audit(opts: {
  actorId?: string | null;
  orgId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    let orgId = opts.orgId ?? null;
    if (!orgId && opts.actorId) {
      const actor = await prisma.user.findUnique({
        where: { id: opts.actorId },
        select: { orgId: true },
      });
      orgId = actor?.orgId ?? null;
    }
    await prisma.auditLog.create({
      data: {
        orgId,
        actorId: opts.actorId ?? null,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId,
        oldValue: opts.oldValue === undefined ? undefined : (opts.oldValue as object),
        newValue: opts.newValue === undefined ? undefined : (opts.newValue as object),
        ip: opts.ip ?? undefined,
        userAgent: opts.userAgent?.slice(0, 250) ?? undefined,
      },
    });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}
