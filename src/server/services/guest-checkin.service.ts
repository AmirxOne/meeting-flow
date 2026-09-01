import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { audit } from "@/server/http";
import { buildWayfinding, preferFloorMapKey, type WayfindingDto } from "@/lib/wayfinding";
import { readAttachmentBuffer } from "@/server/services/attachment-storage";

const CHECKIN_STATUSES = new Set([
  "APPROVED",
  "CONFIRMED",
  "RESCHEDULED",
  "IN_PROGRESS",
]);

/** Generate a unique 8-char hex check-in code. */
export async function generateCheckinCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    const taken = await prisma.meetingGuest.findFirst({
      where: { checkinCode: code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  throw new HttpError(500, "خطا در تولید کد ورود", "INTERNAL");
}

function assertCheckinWindow(startAt: Date, endAt: Date) {
  const now = Date.now();
  const earliest = startAt.getTime() - 3 * 3600000;
  const latest = endAt.getTime() + 3600000;
  if (now < earliest) {
    throw new HttpError(400, "هنوز زمان ثبت حضور مهمان فرا نرسیده است", "TOO_EARLY");
  }
  if (now > latest) {
    throw new HttpError(400, "مهلت ثبت حضور این جلسه گذشته است", "TOO_LATE");
  }
}

export async function getGuestByCheckinCode(code: string) {
  const normalized = code.trim().toUpperCase();
  const guest = await prisma.meetingGuest.findFirst({
    where: { checkinCode: normalized },
    include: {
      meeting: {
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          status: true,
          meetingCode: true,
          branch: { select: { name: true, wayfindingText: true, mapStorageKey: true, mapMimeType: true } },
          room: {
            select: {
              name: true,
              floor: {
                select: {
                  name: true,
                  number: true,
                  wayfindingText: true,
                  mapStorageKey: true,
                  mapMimeType: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!guest) throw new HttpError(404, "کد ورود نامعتبر است", "NOT_FOUND");
  return guest;
}

type CheckinGuestRow = Awaited<ReturnType<typeof getGuestByCheckinCode>>;

export function wayfindingFromGuest(guest: CheckinGuestRow): WayfindingDto {
  const floor = guest.meeting.room?.floor ?? null;
  return buildWayfinding({
    branchName: guest.meeting.branch.name,
    branchDirections: guest.meeting.branch.wayfindingText,
    branchHasMap: !!guest.meeting.branch.mapStorageKey,
    roomName: guest.meeting.room?.name ?? null,
    floorName: floor?.name ?? null,
    floorNumber: floor?.number ?? null,
    floorDirections: floor?.wayfindingText ?? null,
    floorHasMap: !!floor?.mapStorageKey,
  });
}

export async function readCheckinMap(code: string): Promise<{ body: Buffer; mimeType: string }> {
  const guest = await getGuestByCheckinCode(code);
  const floor = guest.meeting.room?.floor ?? null;
  const picked = preferFloorMapKey({
    floorKey: floor?.mapStorageKey,
    branchKey: guest.meeting.branch.mapStorageKey,
  });
  if (!picked) throw new HttpError(404, "نقشه‌ای برای این جلسه ثبت نشده است", "NO_MAP");
  const mime =
    picked.source === "floor" ? floor?.mapMimeType : guest.meeting.branch.mapMimeType;
  if (!mime) throw new HttpError(404, "نقشه‌ای برای این جلسه ثبت نشده است", "NO_MAP");
  const body = await readAttachmentBuffer(picked.storageKey);
  return { body, mimeType: mime };
}

export interface CheckinGuestOptions {
  meetingId: string;
  guestId: string;
  checkinCode?: string;
  meetingCode?: string;
  manual?: boolean;
  actorId?: string;
  ip?: string | null;
}

export async function checkInGuest(opts: CheckinGuestOptions) {
  const guest = await prisma.meetingGuest.findFirst({
    where: { id: opts.guestId, meetingId: opts.meetingId },
    include: {
      meeting: {
        select: {
          id: true,
          title: true,
          status: true,
          startAt: true,
          endAt: true,
          meetingCode: true,
          organizerId: true,
        },
      },
    },
  });

  if (!guest) throw new HttpError(404, "مهمان یافت نشد", "NOT_FOUND");
  if (!guest.checkinCode) {
    throw new HttpError(400, "کد ورود برای این مهمان تنظیم نشده است", "NO_CODE");
  }

  const meeting = guest.meeting;
  if (["CANCELLED", "REJECTED", "COMPLETED", "NO_SHOW"].includes(meeting.status)) {
    throw new HttpError(400, "ثبت حضور برای این جلسه ممکن نیست", "BAD_STATE");
  }

  if (opts.manual) {
    if (!opts.actorId) throw new HttpError(401, "ابتدا وارد شوید", "UNAUTHENTICATED");
  } else {
    const codeOk =
      opts.checkinCode &&
      opts.checkinCode.trim().toUpperCase() === guest.checkinCode;
    const meetingCodeOk =
      opts.meetingCode && opts.meetingCode === meeting.meetingCode;
    if (!codeOk && !meetingCodeOk) {
      throw new HttpError(403, "کد ورود نامعتبر است", "FORBIDDEN");
    }
  }

  if (!CHECKIN_STATUSES.has(meeting.status)) {
    throw new HttpError(400, "جلسه هنوز برای ثبت حضور مهمان آماده نیست", "BAD_STATE");
  }

  assertCheckinWindow(meeting.startAt, meeting.endAt);

  if (guest.arrivedAt) {
    return {
      guest,
      alreadyCheckedIn: true as const,
    };
  }

  const arrivedAt = new Date();
  const updated = await prisma.meetingGuest.update({
    where: { id: guest.id },
    data: { arrivedAt },
  });

  await prisma.meetingEvent.create({
    data: {
      meetingId: meeting.id,
      type: "GUEST_CHECKED_IN",
      actorId: opts.manual ? opts.actorId : null,
      data: {
        guestId: guest.id,
        guestName: guest.name,
        manual: !!opts.manual,
      },
    },
  });

  await audit({
    actorId: opts.manual ? opts.actorId : null,
    action: opts.manual ? "GUEST_CHECKIN_MANUAL" : "GUEST_CHECKIN",
    entity: "MeetingGuest",
    entityId: guest.id,
    newValue: { arrivedAt: arrivedAt.toISOString(), guestName: guest.name },
    ip: opts.ip,
  });

  return { guest: updated, alreadyCheckedIn: false as const };
}
