import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { claimWaitlistMeeting } from "@/server/services/meeting.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await claimWaitlistMeeting(id, { actorId: user.id, orgId: user.orgId });
    await audit({
      actorId: user.id,
      action: "WAITLIST_CLAIM",
      entity: "Meeting",
      entityId: id,
      newValue: { status: meeting.status, roomId: meeting.roomId },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ meeting });
  } catch (e) {
    return handleError(e);
  }
}
