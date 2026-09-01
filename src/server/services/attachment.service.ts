import { randomUUID } from "node:crypto";
import type { Meeting } from "@prisma/client";
import { prisma } from "@/server/db";
import { can, HttpError, type AuthUser } from "@/server/auth/session";
import { ATTACHMENT_MAX_BYTES_DEFAULT, ATTACHMENT_MAX_PER_MEETING } from "@/lib/attachments";
import { sanitizeOriginalName, sniffAttachment } from "@/server/services/attachment-scan";
import {
  readAttachmentBuffer,
  removeAttachmentFile,
  writeAttachment,
} from "@/server/services/attachment-storage";

const ATTACHMENT_PUBLIC = {
  id: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  uploadedBy: { select: { id: true, fullName: true } },
} as const;

export type PublicAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedBy: { id: string; fullName: string };
};

type MeetingAccess = Pick<Meeting, "id" | "organizerId" | "isPrivate"> & {
  participants: { userId: string }[];
};

function maxBytes(): number {
  const n = Number(process.env.MEETING_ATTACHMENTS_MAX_BYTES);
  return Number.isFinite(n) && n > 0 ? n : ATTACHMENT_MAX_BYTES_DEFAULT;
}

function isSuper(user: AuthUser): boolean {
  return user.isSuperAdmin || user.roleKeys.includes("SUPER_ADMIN");
}

function isInvolved(user: AuthUser, meeting: MeetingAccess): boolean {
  return (
    meeting.organizerId === user.id ||
    meeting.participants.some((p) => p.userId === user.id)
  );
}

/** Same rule as GET /api/meetings/[id]: private → organizer / invitee / SUPER_ADMIN. */
export function assertCanViewMeeting(user: AuthUser, meeting: MeetingAccess): void {
  if (!meeting.isPrivate) return;
  if (isInvolved(user, meeting) || isSuper(user)) return;
  throw new HttpError(403, "دسترسی به این جلسه ندارید", "FORBIDDEN");
}

/**
 * Upload/delete: organizer, or a manager with meeting:update + view-all
 * (EMPLOYEE has update but not view-all — invitees download only).
 */
export function assertCanManageAttachments(user: AuthUser, meeting: MeetingAccess): void {
  assertCanViewMeeting(user, meeting);
  if (meeting.organizerId === user.id) return;
  if (can(user, "meeting:update") && can(user, "meeting:view-all")) return;
  throw new HttpError(403, "فقط برگزارکننده یا مدیر می‌تواند پیوست را تغییر دهد", "FORBIDDEN");
}

export async function loadMeetingForAttachments(meetingId: string, orgId: string): Promise<MeetingAccess> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, orgId },
    select: {
      id: true,
      organizerId: true,
      isPrivate: true,
      participants: { select: { userId: true } },
    },
  });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
  return meeting;
}

export async function listAttachments(meetingId: string): Promise<PublicAttachment[]> {
  return prisma.meetingAttachment.findMany({
    where: { meetingId },
    select: ATTACHMENT_PUBLIC,
    orderBy: { createdAt: "asc" },
  });
}

export async function uploadAttachment(
  meetingId: string,
  user: AuthUser,
  file: { buffer: Buffer; name: string },
): Promise<PublicAttachment> {
  const meeting = await loadMeetingForAttachments(meetingId, user.orgId);
  assertCanManageAttachments(user, meeting);

  const limit = maxBytes();
  if (file.buffer.length > limit) {
    throw new HttpError(400, "حجم فایل بیش از حد مجاز است", "FILE_TOO_LARGE");
  }

  const originalName = sanitizeOriginalName(file.name);
  const sniffed = sniffAttachment(file.buffer, originalName);

  const count = await prisma.meetingAttachment.count({ where: { meetingId } });
  if (count >= ATTACHMENT_MAX_PER_MEETING) {
    throw new HttpError(400, "تعداد پیوست‌های این جلسه به سقف رسیده است", "TOO_MANY_FILES");
  }

  const storageKey = `${meetingId}/${randomUUID()}`;
  await writeAttachment(storageKey, file.buffer);

  try {
    const row = await prisma.meetingAttachment.create({
      data: {
        meetingId,
        originalName,
        mimeType: sniffed.mime,
        sizeBytes: file.buffer.length,
        storageKey,
        uploadedById: user.id,
      },
      select: ATTACHMENT_PUBLIC,
    });
    await prisma.meetingEvent.create({
      data: {
        meetingId,
        type: "ATTACHMENT_ADDED",
        actorId: user.id,
        data: { attachmentId: row.id, originalName, mimeType: sniffed.mime, sizeBytes: file.buffer.length },
      },
    });
    return row;
  } catch (e) {
    await removeAttachmentFile(storageKey);
    throw e;
  }
}

export async function getAttachmentForDownload(
  meetingId: string,
  attachmentId: string,
  user: AuthUser,
): Promise<{ originalName: string; mimeType: string; sizeBytes: number; body: Buffer }> {
  const meeting = await loadMeetingForAttachments(meetingId, user.orgId);
  assertCanViewMeeting(user, meeting);

  const row = await prisma.meetingAttachment.findFirst({
    where: { id: attachmentId, meetingId },
  });
  if (!row) throw new HttpError(404, "پیوست یافت نشد", "NOT_FOUND");

  return {
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    body: await readAttachmentBuffer(row.storageKey),
  };
}

export async function deleteAttachment(
  meetingId: string,
  attachmentId: string,
  user: AuthUser,
): Promise<{ originalName: string }> {
  const meeting = await loadMeetingForAttachments(meetingId, user.orgId);
  assertCanManageAttachments(user, meeting);

  const row = await prisma.meetingAttachment.findFirst({
    where: { id: attachmentId, meetingId },
  });
  if (!row) throw new HttpError(404, "پیوست یافت نشد", "NOT_FOUND");

  await prisma.meetingAttachment.delete({ where: { id: row.id } });
  await removeAttachmentFile(row.storageKey);
  await prisma.meetingEvent.create({
    data: {
      meetingId,
      type: "ATTACHMENT_REMOVED",
      actorId: user.id,
      data: { attachmentId: row.id, originalName: row.originalName },
    },
  });
  return { originalName: row.originalName };
}
