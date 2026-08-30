import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { BLOCKING_STATUSES, intervalsOverlap } from "./conflict.service";

export interface ExclusionInput {
  roomId: string;
  reason: string;
  startAt: Date;
  endAt: Date;
}

/** Validate window and ensure no meeting / exclusion overlap when scheduling downtime. */
export async function assertExclusionWindowValid(
  input: ExclusionInput,
  excludeExclusionId?: string,
) {
  if (input.endAt <= input.startAt) {
    throw new HttpError(400, "پایان باید بعد از شروع باشد", "INVALID_RANGE");
  }

  const room = await prisma.meetingRoom.findUnique({ where: { id: input.roomId } });
  if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");

  const meetingCount = await prisma.meeting.count({
    where: {
      roomId: input.roomId,
      status: { in: BLOCKING_STATUSES as unknown as string[] },
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
    },
  });
  if (meetingCount > 0) {
    throw new HttpError(409, "در این بازه جلسه رزرو شده است", "MEETING_CONFLICT");
  }

  const exclusionCount = await prisma.roomExclusion.count({
    where: {
      roomId: input.roomId,
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
      ...(excludeExclusionId ? { id: { not: excludeExclusionId } } : {}),
    },
  });
  if (exclusionCount > 0) {
    throw new HttpError(409, "تداخل با غیرفعال‌سازی دیگر", "EXCLUSION_OVERLAP");
  }
}

/** Block booking when room is under maintenance / temporary closure. */
export async function assertRoomNotExcluded(
  tx: Prisma.TransactionClient,
  roomId: string,
  start: Date,
  end: Date,
) {
  const hit = await tx.roomExclusion.findFirst({
    where: { roomId, startAt: { lt: end }, endAt: { gt: start } },
    orderBy: { startAt: "asc" },
  });
  if (hit) {
    throw new HttpError(
      409,
      `اتاق در این بازه غیرفعال است (${hit.reason})`,
      "ROOM_EXCLUDED",
    );
  }
}

export async function assertRoomNotExcludedOutsideTx(
  roomId: string,
  start: Date,
  end: Date,
) {
  const hit = await prisma.roomExclusion.findFirst({
    where: { roomId, startAt: { lt: end }, endAt: { gt: start } },
    orderBy: { startAt: "asc" },
  });
  if (hit) {
    throw new HttpError(
      409,
      `اتاق در این بازه غیرفعال است (${hit.reason})`,
      "ROOM_EXCLUDED",
    );
  }
}

export function exclusionOverlapsBooking(
  exclusionStart: Date,
  exclusionEnd: Date,
  bookingStart: Date,
  bookingEnd: Date,
): boolean {
  return intervalsOverlap(exclusionStart, exclusionEnd, bookingStart, bookingEnd);
}
