import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { rejectSchema } from "@/lib/validations";
import { rejectMeeting } from "@/server/services/meeting.service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("meeting:reject");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = rejectSchema.parse(body);
    const meeting = await rejectMeeting(id, { actorId: user.id, reason: input.reason });
    await audit({
      actorId: user.id, action: "MEETING_REJECT", entity: "Meeting", entityId: id,
      newValue: { status: meeting.status, reason: input.reason }, ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ meeting });
  } catch (e) {
    return handleError(e);
  }
}
