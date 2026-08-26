import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/server/auth/session";
import { prisma } from "@/server/db";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 });
}

export function fail(status: number, message: string, code?: string, extra?: unknown) {
  return NextResponse.json(
    { ok: false, error: { message, code, extra } },
    { status },
  );
}

export function handleError(error: unknown) {
  if (error instanceof HttpError) {
    return fail(error.status, error.message, error.code);
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
  return fail(500, "خطای داخلی سرور", "INTERNAL");
}

/** Wrap a route handler with uniform error responses. */
export function route<T>(handler: () => Promise<NextResponse<T> | NextResponse>) {
  return handler().catch(handleError);
}

// ── Audit logging ─────────────────────────────────────────────

export async function audit(opts: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
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
