import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { hashToken, HttpError, type AuthUser } from "@/server/auth/session";
import { BLOCKING_STATUSES } from "@/server/services/conflict.service";
import { getOrgTimezone } from "@/server/services/org-timezone.service";
import { assertRoomManageAccess } from "@/server/services/room-access.service";
import {
  occupancyForRoom,
  pickCurrentAndNext,
  toPublicDisplaySlot,
  normalizeDisplayCode,
  type DisplayMeetingInput,
} from "@/lib/room-display";

export function newRoomDisplayToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashRoomDisplayToken(token: string): string {
  return hashToken(token);
}

async function uniqueDisplayCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    const taken = await prisma.meetingRoom.findFirst({
      where: { displayCode: code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  throw new HttpError(500, "خطا در تولید کد نمایشگر", "INTERNAL");
}

export async function getRoomDisplayTokenStatus(orgId: string, roomId: string) {
  const room = await prisma.meetingRoom.findFirst({
    where: { id: roomId, orgId },
    select: {
      id: true,
      name: true,
      displayCode: true,
      displayTokenHash: true,
      displayTokenCreatedAt: true,
    },
  });
  if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");
  return {
    enabled: Boolean(room.displayTokenHash),
    displayCode: room.displayCode,
    createdAt: room.displayTokenCreatedAt,
  };
}

export async function rotateRoomDisplayAccess(
  actor: AuthUser,
  roomId: string,
): Promise<{ token: string; displayCode: string; createdAt: Date }> {
  const room = await prisma.meetingRoom.findFirst({
    where: { id: roomId, orgId: actor.orgId },
    select: { id: true, managerId: true },
  });
  if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");
  assertRoomManageAccess(actor, room);

  const token = newRoomDisplayToken();
  const displayCode = await uniqueDisplayCode();
  const createdAt = new Date();
  await prisma.meetingRoom.update({
    where: { id: roomId },
    data: {
      displayTokenHash: hashRoomDisplayToken(token),
      displayCode,
      displayTokenCreatedAt: createdAt,
    },
  });
  return { token, displayCode, createdAt };
}

export async function revokeRoomDisplayAccess(actor: AuthUser, roomId: string): Promise<void> {
  const room = await prisma.meetingRoom.findFirst({
    where: { id: roomId, orgId: actor.orgId },
    select: { id: true, managerId: true },
  });
  if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");
  assertRoomManageAccess(actor, room);
  await prisma.meetingRoom.update({
    where: { id: roomId },
    data: {
      displayTokenHash: null,
      displayCode: null,
      displayTokenCreatedAt: null,
    },
  });
}

export async function authorizeRoomDisplay(
  roomId: string,
  creds: { token?: string | null; code?: string | null; user?: AuthUser | null },
) {
  const room = await prisma.meetingRoom.findUnique({
    where: { id: roomId },
    include: {
      branch: { select: { id: true, name: true } },
      floor: { select: { name: true, number: true } },
    },
  });
  if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");

  const token = creds.token?.trim() ?? "";
  if (token && room.displayTokenHash && room.displayTokenHash === hashRoomDisplayToken(token)) {
    return room;
  }

  const code = creds.code ? normalizeDisplayCode(creds.code) : "";
  if (code.length === 8 && room.displayCode && room.displayCode === code) {
    return room;
  }

  if (creds.user && creds.user.orgId === room.orgId) {
    return room;
  }

  throw new HttpError(401, "توکن یا کد نمایشگر نامعتبر است", "UNAUTHENTICATED");
}

export async function getRoomDisplayBoard(room: {
  id: string;
  orgId: string;
  name: string;
  isActive: boolean;
  branch: { id: string; name: string };
  floor: { name: string; number: number } | null;
}) {
  const now = new Date();
  const horizon = new Date(now.getTime() + 36 * 3600000);
  const lookback = new Date(now.getTime() - 12 * 3600000);

  const meetings = await prisma.meeting.findMany({
    where: {
      orgId: room.orgId,
      roomId: room.id,
      status: { in: [...BLOCKING_STATUSES] },
      startAt: { lt: horizon },
      endAt: { gt: lookback },
    },
    select: {
      id: true,
      title: true,
      isPrivate: true,
      startAt: true,
      endAt: true,
      status: true,
      organizer: { select: { fullName: true } },
    },
    orderBy: { startAt: "asc" },
  });

  const inputs: DisplayMeetingInput[] = meetings.map((m) => ({
    id: m.id,
    title: m.title,
    isPrivate: m.isPrivate,
    startAt: m.startAt,
    endAt: m.endAt,
    status: m.status,
    organizerName: m.organizer.fullName,
  }));

  const picked = pickCurrentAndNext(inputs, now);
  const occupancy = occupancyForRoom({ isActive: room.isActive, occupancy: picked.occupancy });
  const timezone = await getOrgTimezone(room.orgId);

  return {
    room: {
      id: room.id,
      name: room.name,
      isActive: room.isActive,
      branchName: room.branch.name,
      floorName: room.floor?.name ?? null,
    },
    timezone,
    occupancy,
    current: toPublicDisplaySlot(picked.current),
    next: toPublicDisplaySlot(picked.next),
    serverNow: now.toISOString(),
  };
}
