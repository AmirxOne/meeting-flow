import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { agendaReplaceSchema } from "@/lib/validations";
import {
  assertCanViewMeeting,
  listAgendaItems,
  loadMeetingForAgenda,
  replaceAgenda,
} from "@/server/services/agenda.service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await loadMeetingForAgenda(id, user.orgId);
    assertCanViewMeeting(user, meeting);
    const items = await listAgendaItems(id);
    return ok({ items });
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
    const input = agendaReplaceSchema.parse(await req.json().catch(() => ({})));
    const items = await replaceAgenda(id, user, input);
    await audit({
      actorId: user.id,
      action: "AGENDA_UPDATE",
      entity: "Meeting",
      entityId: id,
      newValue: { count: items.length, titles: items.map((i) => i.title) },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ items });
  } catch (e) {
    return handleError(e);
  }
}
