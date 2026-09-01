import { NextRequest } from "next/server";
import { requireUser, can } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { delegateCreateSchema } from "@/lib/validations";
import {
  addDelegate,
  listDelegatesForUser,
} from "@/server/services/delegate.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await listDelegatesForUser(user.orgId, user.id));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!can(user, "meeting:create")) {
      return Response.json(
        { ok: false, error: { message: "دسترسی لازم را ندارید", code: "FORBIDDEN" } },
        { status: 403 },
      );
    }
    const input = delegateCreateSchema.parse(await req.json().catch(() => ({})));
    const row = await addDelegate(user.orgId, user.id, input.userId);
    await audit({
      actorId: user.id,
      action: "CREATE",
      entity: "Delegate",
      entityId: row.id,
      newValue: { managerId: user.id, delegateId: input.userId },
      ip: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });
    return ok(
      {
        delegate: {
          id: row.id,
          createdAt: row.createdAt,
          user: row.delegate,
        },
      },
      201,
    );
  } catch (e) {
    return handleError(e);
  }
}
