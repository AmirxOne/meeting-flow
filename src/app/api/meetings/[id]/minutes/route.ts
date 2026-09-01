import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { minutesUpsertSchema } from "@/lib/validations";
import {
  assertCanViewMeeting,
  getMinutes,
  loadMeetingForMinutes,
  upsertMinutes,
} from "@/server/services/minutes.service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await loadMeetingForMinutes(id, user.orgId);
    assertCanViewMeeting(user, meeting);
    const minutes = await getMinutes(id);
    return ok({ minutes });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = minutesUpsertSchema.parse(await req.json().catch(() => ({})));
    const minutes = await upsertMinutes(id, user, input);
    await audit({
      actorId: user.id,
      action: "MINUTES_PUBLISH",
      entity: "Meeting",
      entityId: id,
      newValue: {
        bodyLength: minutes.body.length,
        decisionCount: minutes.decisions.length,
      },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ minutes });
  } catch (e) {
    return handleError(e);
  }
}
