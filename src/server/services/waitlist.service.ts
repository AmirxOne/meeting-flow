import type { Meeting } from "@prisma/client";
import { prisma } from "@/server/db";
import { BLOCKING_STATUSES, findRoomConflicts } from "./conflict.service";
import { notificationService } from "./notification.service";

export const WAITLIST_WAITING = "WAITLISTED";
export const WAITLIST_OFFERED = "WAITLIST_OFFERED";
export const WAITLIST_STATUSES = [WAITLIST_WAITING, WAITLIST_OFFERED] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

/** Short window for the first waiter to lock the freed slot. */
export const WAITLIST_OFFER_TTL_MS = 15 * 60 * 1000;

export function isWaitlistStatus(status: string): boolean {
  return status === WAITLIST_WAITING || status === WAITLIST_OFFERED;
}

/** Waitlisted rows must never occupy the room. */
export function waitlistLocksRoom(): boolean {
  return (
    (BLOCKING_STATUSES as readonly string[]).includes(WAITLIST_WAITING) ||
    (BLOCKING_STATUSES as readonly string[]).includes(WAITLIST_OFFERED)
  );
}

export interface WaitlistQueueItem {
  id: string;
  status: string;
  startAt: Date;
  endAt: Date;
  waitlistQueuedAt: Date;
  waitlistOfferExpiresAt: Date | null;
}

export function isOfferExpired(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}

export function isOfferActive(entry: WaitlistQueueItem, now: Date): boolean {
  return entry.status === WAITLIST_OFFERED && !isOfferExpired(entry.waitlistOfferExpiresAt, now);
}

export function sortWaitlistQueue<T extends { waitlistQueuedAt: Date; id: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const d = a.waitlistQueuedAt.getTime() - b.waitlistQueuedAt.getTime();
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });
}

export function queuePosition(sortedIds: string[], meetingId: string): number {
  const i = sortedIds.indexOf(meetingId);
  return i < 0 ? 0 : i + 1;
}

function overlaps(a: { startAt: Date; endAt: Date }, b: { startAt: Date; endAt: Date }): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

/**
 * First WAITLISTED entry whose own slot is free and that does not overlap
 * an already-active offer on the same room cluster.
 */
export function pickNextWaitlistOffer(
  entries: WaitlistQueueItem[],
  now: Date,
  isSlotFree: (start: Date, end: Date) => boolean,
): WaitlistQueueItem | null {
  const waiting = sortWaitlistQueue(entries.filter((e) => e.status === WAITLIST_WAITING));
  const activeOffers = entries.filter((e) => isOfferActive(e, now));
  for (const entry of waiting) {
    if (activeOffers.some((o) => overlaps(o, entry))) continue;
    if (!isSlotFree(entry.startAt, entry.endAt)) continue;
    return entry;
  }
  return null;
}

export async function pickNextWaitlistOfferAsync(
  entries: WaitlistQueueItem[],
  now: Date,
  isSlotFree: (entry: WaitlistQueueItem) => Promise<boolean>,
): Promise<WaitlistQueueItem | null> {
  const waiting = sortWaitlistQueue(entries.filter((e) => e.status === WAITLIST_WAITING));
  const activeOffers = entries.filter((e) => isOfferActive(e, now));
  for (const entry of waiting) {
    if (activeOffers.some((o) => overlaps(o, entry))) continue;
    if (!(await isSlotFree(entry))) continue;
    return entry;
  }
  return null;
}

export function bumpExpiredToBack(queuedAt: Date, now: Date): Date {
  return now.getTime() <= queuedAt.getTime() ? new Date(now.getTime() + 1) : now;
}

const QUEUE_SELECT = {
  id: true,
  status: true,
  startAt: true,
  endAt: true,
  waitlistQueuedAt: true,
  waitlistOfferExpiresAt: true,
  organizerId: true,
  title: true,
  roomId: true,
  orgId: true,
} as const;

function toQueueItem(m: {
  id: string;
  status: string;
  startAt: Date;
  endAt: Date;
  waitlistQueuedAt: Date | null;
  waitlistOfferExpiresAt: Date | null;
}): WaitlistQueueItem {
  return {
    id: m.id,
    status: m.status,
    startAt: m.startAt,
    endAt: m.endAt,
    waitlistQueuedAt: m.waitlistQueuedAt ?? m.startAt,
    waitlistOfferExpiresAt: m.waitlistOfferExpiresAt,
  };
}

export async function loadRoomWaitlist(
  orgId: string,
  roomId: string,
  startAt: Date,
  endAt: Date,
): Promise<WaitlistQueueItem[]> {
  const rows = await prisma.meeting.findMany({
    where: {
      orgId,
      roomId,
      status: { in: [...WAITLIST_STATUSES] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: QUEUE_SELECT,
  });
  return rows.map(toQueueItem);
}

export async function waitlistMeta(meeting: {
  id: string;
  orgId: string;
  roomId: string | null;
  status: string;
  startAt: Date;
  endAt: Date;
  waitlistOfferExpiresAt: Date | null;
}) {
  if (!isWaitlistStatus(meeting.status) || !meeting.roomId) return null;
  const queue = sortWaitlistQueue(
    await loadRoomWaitlist(meeting.orgId, meeting.roomId, meeting.startAt, meeting.endAt),
  );
  return {
    position: queuePosition(queue.map((q) => q.id), meeting.id),
    total: queue.length,
    offerExpiresAt: meeting.waitlistOfferExpiresAt?.toISOString() ?? null,
    offered: meeting.status === WAITLIST_OFFERED,
  };
}

export async function countOverlappingWaitlist(
  orgId: string,
  roomId: string,
  startAt: Date,
  endAt: Date,
): Promise<number> {
  return prisma.meeting.count({
    where: {
      orgId,
      roomId,
      status: { in: [...WAITLIST_STATUSES] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
}

async function slotIsFree(roomId: string, start: Date, end: Date, excludeId?: string): Promise<boolean> {
  const conflicts = await findRoomConflicts(roomId, start, end, excludeId);
  return conflicts.length === 0;
}

async function applyOffer(meetingId: string, now: Date) {
  const expiresAt = new Date(now.getTime() + WAITLIST_OFFER_TTL_MS);
  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: WAITLIST_OFFERED,
      waitlistOfferedAt: now,
      waitlistOfferExpiresAt: expiresAt,
    },
  });
  await prisma.meetingEvent.create({
    data: {
      meetingId,
      type: "WAITLIST_OFFERED",
      data: { offerExpiresAt: expiresAt.toISOString() },
    },
  });
  await notificationService.waitlistOffered(updated, expiresAt);
  return updated;
}

/** When a blocking booking vacates a slot, offer it to the first waiter. */
export async function offerWaitlistAfterVacate(input: {
  orgId: string;
  roomId: string | null;
  startAt: Date;
  endAt: Date;
}): Promise<Meeting | null> {
  if (!input.roomId) return null;
  const now = new Date();
  const rows = await prisma.meeting.findMany({
    where: {
      orgId: input.orgId,
      roomId: input.roomId,
      status: { in: [...WAITLIST_STATUSES] },
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
    },
    select: QUEUE_SELECT,
  });
  const picked = await pickNextWaitlistOfferAsync(rows.map(toQueueItem), now, async (entry) =>
    slotIsFree(input.roomId!, entry.startAt, entry.endAt, entry.id),
  );
  if (!picked) return null;
  return applyOffer(picked.id, now);
}

/** Expire overdue offers and pass the chance to the next person. */
export async function processWaitlistOffers(now = new Date()): Promise<number> {
  const expired = await prisma.meeting.findMany({
    where: {
      status: WAITLIST_OFFERED,
      waitlistOfferExpiresAt: { lte: now },
    },
    select: QUEUE_SELECT,
    take: 50,
  });
  let processed = 0;
  for (const row of expired) {
    const queuedAt = bumpExpiredToBack(row.waitlistQueuedAt ?? now, now);
    await prisma.meeting.update({
      where: { id: row.id },
      data: {
        status: WAITLIST_WAITING,
        waitlistQueuedAt: queuedAt,
        waitlistOfferedAt: null,
        waitlistOfferExpiresAt: null,
      },
    });
    await prisma.meetingEvent.create({
      data: { meetingId: row.id, type: "WAITLIST_EXPIRED", data: { bumped: true } },
    });
    await notificationService.waitlistExpired(row);
    processed += 1;
    if (row.roomId) {
      await offerWaitlistAfterVacate({
        orgId: row.orgId,
        roomId: row.roomId,
        startAt: row.startAt,
        endAt: row.endAt,
      });
    }
  }

  // Recover: free slots with waiters but no active offer (e.g. worker was down)
  const waiting = await prisma.meeting.findMany({
    where: { status: WAITLIST_WAITING, roomId: { not: null }, startAt: { gt: now } },
    select: QUEUE_SELECT,
    take: 40,
  });
  const seen = new Set<string>();
  for (const row of waiting) {
    if (!row.roomId) continue;
    const key = `${row.roomId}:${row.startAt.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (await slotIsFree(row.roomId, row.startAt, row.endAt, row.id)) {
      await offerWaitlistAfterVacate({
        orgId: row.orgId,
        roomId: row.roomId,
        startAt: row.startAt,
        endAt: row.endAt,
      });
    }
  }
  return processed;
}

