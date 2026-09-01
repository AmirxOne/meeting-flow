import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, can, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { checkConflicts } from "@/server/services/meeting.service";
import { resolveOrganizerId } from "@/server/services/delegate.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  roomId: z.string().optional().nullable(),
  participantIds: z.array(z.string()).default([]),
  organizerId: z.string().optional(),
  startAt: z.string(),
  endAt: z.string(),
  excludeMeetingId: z.string().optional(),
});

/** Soft/hard conflict pre-check for UI. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = schema.parse(await req.json().catch(() => ({})));

    const organizerId = await resolveOrganizerId(user.orgId, user.id, input.organizerId);

    const result = await checkConflicts({
      roomId: input.roomId ?? undefined,
      participantIds: input.participantIds,
      organizerId,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      excludeMeetingId: input.excludeMeetingId ?? id,
      orgId: user.orgId,
      viewer: { id: user.id, isSuperAdmin: !!user.isSuperAdmin || user.roleKeys.includes("SUPER_ADMIN") },
    });
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
