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
  isPrivate: z.boolean().default(false),
  recReq: z
    .object({
      freq: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
      count: z.coerce.number().int().min(1).max(52).optional(),
    })
    .optional(),
  venue: z.enum(["ONSITE", "OFFSITE"]).default("ONSITE"),
  offsiteOrg: z.string().trim().min(2).max(120).optional(),
  offsiteNote: z.string().trim().max(300).optional(),
  prefFrom: z.string().datetime().optional(),
  prefTo: z.string().datetime().optional(),
  // بازه‌های پیشنهادی چندگانه: [{from,to}] — درخواست‌دهنده می‌تواند چند گزینه بدهد
  prefSlots: z
    .array(z.object({ from: z.string().datetime(), to: z.string().datetime() }))
    .max(10)
    .optional(),
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
        : { requesterId: user.id }; // guests only appear in the admin queue
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
          // guest fields are scalar on the model — returned automatically
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
        isPrivate: input.isPrivate,
        recReq: input.recReq ? JSON.parse(JSON.stringify(input.recReq)) : null,
        venue: input.venue,
        offsiteOrg: input.venue === "OFFSITE" ? (input.offsiteOrg ?? null) : null,
        offsiteNote: input.venue === "OFFSITE" ? (input.offsiteNote ?? null) : null,
        prefFrom: input.prefFrom ? new Date(input.prefFrom) : null,
        prefTo: input.prefTo ? new Date(input.prefTo) : null,
        prefSlots: input.prefSlots?.length
          ? (JSON.parse(JSON.stringify({ slots: input.prefSlots })) as object)
          : undefined,
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
    // اعلان به ادمین/اپراتورها: درخواست جدید در صف هماهنگی
    try {
      const operators = await prisma.user.findMany({
        where: {
          isActive: true,
          orgId: item.orgId,
          roles: { some: { role: { key: { in: ["ADMIN", "MEETING_OPERATOR"] } } } },
        },
        select: { id: true },
      });
      if (operators.length > 0) {
        const requesterName = user.fullName ?? "کاربر";
        const urg = input.urgency === "URGENT" ? " · فوری" : input.urgency === "FLEXIBLE" ? " · منعطف" : "";
        await prisma.notification.createMany({
          data: operators.map((o) => ({
            userId: o.id,
            orgId: item.orgId,
            type: "MEETING_REQUEST_CREATED",
            title: `درخواست جلسه «${item.title}» ثبت شد`,
            body: `${requesterName} — در انتظار هماهنگی${urg}`,
            data: { requestId: item.id, queue: true } as object,
          })),
        });
      }
    } catch {
      /* نوتیفیکیشن هرگز نباید ثبت درخواست را بشکند */
    }
    return ok({ request: item }, 201);
  } catch (e) {
    return handleError(e);
  }
}
