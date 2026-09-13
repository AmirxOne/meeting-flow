import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, fail, handleError, audit } from "@/server/http";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  urgency: z.enum(["URGENT", "NORMAL", "FLEXIBLE"]).default("NORMAL"),
  prefFrom: z.string().datetime().optional(),
  prefTo: z.string().datetime().optional(),
  participantIds: z.array(z.string()).max(50).default([]),
  guests: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        company: z.string().trim().optional(),
        phone: z.string().trim().optional(),
      }),
    )
    .max(20)
    .optional(),
  durationMin: z.number().int().min(15).max(480).default(60),
});

/** GET /api/meeting-requests — my requests (employee) or the org queue (admin/operator) */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const scope = sp.get("scope") ?? "mine";
    const status = sp.get("status");

    const isQueueViewer =
      !!user.isSuperAdmin ||
      user.roleKeys.some((r) => ["SUPER_ADMIN", "ADMIN", "MEETING_OPERATOR"].includes(r));

    const where =
      scope === "all" && isQueueViewer
        ? { orgId: user.orgId }
        : { requesterId: user.id };
    const filter = {
      ...where,
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.meetingRequest.findMany({
        where: filter,
        include: {
          requester: { select: { id: true, fullName: true, avatarUrl: true } },
          meeting: { select: { id: true, title: true, startAt: true, roomId: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 100,
      }),
      prisma.meetingRequest.count({ where: filter }),
    ]);
    return ok({ items, total, canSchedule: isQueueViewer });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/meeting-requests — employee files a request */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = requestSchema.parse(await req.json().catch(() => ({})));

    const item = await prisma.meetingRequest.create({
      data: {
        orgId: user.orgId,
        requesterId: user.id,
        title: input.title,
        description: input.description,
        urgency: input.urgency,
        prefFrom: input.prefFrom ? new Date(input.prefFrom) : null,
        prefTo: input.prefTo ? new Date(input.prefTo) : null,
        participantIds: input.participantIds,
        guests: input.guests ?? undefined,
        durationMin: input.durationMin,
        status: "OPEN",
      },
    });
    await audit({
      actorId: user.id,
      action: "meeting-request.create",
      entity: "MeetingRequest",
      entityId: item.id,
      newValue: { title: item.title, urgency: item.urgency },
    });
    return ok({ request: item }, 201);
  } catch (e) {
    return handleError(e);
  }
}
