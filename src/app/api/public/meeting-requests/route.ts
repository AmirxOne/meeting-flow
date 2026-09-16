import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { ok, handleError, audit } from "@/server/http";

export const dynamic = "force-dynamic";

/** Simple in-memory rate limit for the public endpoint (per IP). */
const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX = 10;
function limited(ip: string): boolean {
  const now = Date.now();
  const prev = (hits.get(ip) ?? []).filter((t) => t > now - WINDOW_MS);
  if (prev.length >= MAX) {
    hits.set(ip, prev);
    return true;
  }
  prev.push(now);
  hits.set(ip, prev);
  return false;
}

const guestSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  guestName: z.string().trim().min(2).max(80),
  guestPhone: z.string().trim().regex(/^[0-9+\s-]{7,20}$/),
  guestCompany: z.string().trim().max(120).optional(),
  urgency: z.enum(["URGENT", "NORMAL", "FLEXIBLE"]).default("NORMAL"),
  durationMin: z.number().int().min(15).max(480).default(60),
  isPrivate: z.boolean().default(false),
  /// total head-count the requester expects (excluding themselves)
  attendeeCount: z.number().int().min(1).max(50).optional(),
  /// ids from the PUBLIC directory (name/jobTitle only) the guest picked
  requestedPersonIds: z.array(z.string().trim().min(1)).max(15).optional(),
});

/**
 * POST /api/public/meeting-requests — NO AUTH.
 * Guests (not logged in) can ask for a meeting; it lands in the admin queue
 * flagged as a guest request. Rate limited to 10/hour per IP.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    if (limited(ip)) {
      return Response.json(
        { ok: false, error: { message: "تعداد درخواست‌ها زیاد است — بعداً تلاش کنید", code: "RATE_LIMITED" } },
        { status: 429 },
      );
    }

    const input = guestSchema.parse(await req.json().catch(() => ({})));
    const org = await prisma.organization.findFirst({
      where: { slug: "sample" },
      select: { id: true },
    });
    if (!org) {
      return Response.json(
        { ok: false, error: { message: "سازمان یافت نشد", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    const item = await prisma.meetingRequest.create({
      data: {
        orgId: org.id,
        requesterId: null,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        guestCompany: input.guestCompany,
        title: input.title,
        description: input.description,
        urgency: input.urgency,
        durationMin: input.durationMin,
        isPrivate: input.isPrivate,
        status: "OPEN",
        attendeeCount: input.attendeeCount,
        participantIds: input.requestedPersonIds ?? [],
      },
    });
    await audit({
      action: "meeting-request.guest-create",
      entity: "MeetingRequest",
      entityId: item.id,
      newValue: { title: item.title, guest: input.guestName },
      ip,
    });
    return ok({ request: { id: item.id, status: item.status, attendeeCount: item.attendeeCount, participantIds: item.participantIds, isPrivate: item.isPrivate } }, 201);
  } catch (e) {
    return handleError(e);
  }
}
