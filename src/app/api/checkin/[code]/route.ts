import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/server/http";
import { getGuestByCheckinCode, checkInGuest, wayfindingFromGuest } from "@/server/services/guest-checkin.service";
import { getLoginRateLimiter } from "@/server/rate-limit/login-rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/checkin/:code — public lookup for guest check-in page (rate-limited). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    // brute-force guard: codes are 8-hex, so throttle per IP like login
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const limiter = getLoginRateLimiter();
    if (await limiter.isLimited(`checkin:${ip}`)) {
      return fail(429, "تلاش‌های بیش از حد — کمی بعد دوباره امتحان کنید", "RATE_LIMITED");
    }
    const { code } = await params;
    let guest;
    try {
      guest = await getGuestByCheckinCode(code);
    } catch (e) {
      await limiter.recordFailure(`checkin:${ip}`).catch(() => {});
      throw e;
    }
    return ok({
      guest: {
        id: guest.id,
        name: guest.name,
        company: guest.company,
        arrivedAt: guest.arrivedAt,
        checkinCode: guest.checkinCode,
      },
      meeting: {
        id: guest.meeting.id,
        title: guest.meeting.title,
        startAt: guest.meeting.startAt,
        endAt: guest.meeting.endAt,
        status: guest.meeting.status,
        branchName: guest.meeting.branch?.name ?? "بیرون از شرکت",
        roomName: guest.meeting.room?.name ?? null,
      },
      wayfinding: wayfindingFromGuest(guest),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/checkin/:code — public self check-in by code (no login). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const guest = await getGuestByCheckinCode(code);
    const result = await checkInGuest({
      meetingId: guest.meetingId,
      guestId: guest.id,
      checkinCode: code,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({
      guest: {
        id: result.guest.id,
        name: guest.name,
        arrivedAt: result.guest.arrivedAt,
      },
      alreadyCheckedIn: result.alreadyCheckedIn,
    });
  } catch (e) {
    return handleError(e);
  }
}
