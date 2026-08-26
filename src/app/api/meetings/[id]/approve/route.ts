import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { approveSchema } from "@/lib/validations";
import { approveMeeting } from "@/server/services/meeting.service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("meeting:approve");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = approveSchema.parse(body);
    const meeting = await approveMeeting(id, { actorId: user.id, reason: input.reason });
    await audit({
      actorId: user.id, action: "MEETING_APPROVE", entity: "Meeting", entityId: id,
      newValue: { status: meeting.status }, ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ meeting });
  } catch (e) {
    return handleError(e);
  }
}
