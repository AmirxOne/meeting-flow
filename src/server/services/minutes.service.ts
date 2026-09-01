import type { Meeting } from "@prisma/client";
import { prisma } from "@/server/db";
import { HttpError, type AuthUser } from "@/server/auth/session";
import type { MinutesUpsertInput } from "@/lib/validations";
import { startOfDayUtcFromIso } from "@/lib";
import { assertCanViewMeeting } from "@/server/services/agenda.service";
import { notificationService } from "@/server/services/notification.service";

export { assertCanViewMeeting };

const WRITABLE_STATUSES = new Set(["IN_PROGRESS", "COMPLETED"]);

const MINUTES_PUBLIC = {
  id: true,
  body: true,
  publishedAt: true,
  updatedAt: true,
  publishedBy: { select: { id: true, fullName: true } },
  decisions: {
    select: {
      id: true,
      sortOrder: true,
      text: true,
      ownerId: true,
      dueAt: true,
      owner: { select: { id: true, fullName: true } },
    },
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

export type PublicMinutes = {
  id: string;
  body: string;
  publishedAt: Date;
  updatedAt: Date;
  publishedBy: { id: string; fullName: string };
  decisions: {
    id: string;
    sortOrder: number;
    text: string;
    ownerId: string | null;
    dueAt: Date | null;
    owner: { id: string; fullName: string } | null;
  }[];
};

type MeetingForMinutes = Pick<Meeting, "id" | "organizerId" | "isPrivate" | "status" | "title"> & {
  participants: { userId: string }[];
};

export function assertCanEditMinutes(user: AuthUser, meeting: MeetingForMinutes): void {
  assertCanViewMeeting(user, meeting);
  if (meeting.organizerId !== user.id) {
    throw new HttpError(403, "فقط برگزارکننده می‌تواند صورتجلسه را ثبت کند", "FORBIDDEN");
  }
}

export function assertMinutesWritable(status: string): void {
  if (!WRITABLE_STATUSES.has(status)) {
    throw new HttpError(
      400,
      "صورتجلسه فقط هنگام برگزاری یا پس از پایان جلسه ثبت می‌شود",
      "BAD_STATE",
    );
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDueAt(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  if (DATE_ONLY.test(raw)) return startOfDayUtcFromIso(raw);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new HttpError(400, "مهلت نامعتبر است", "BAD_DUE");
  }
  return d;
}

export async function loadMeetingForMinutes(meetingId: string, orgId: string): Promise<MeetingForMinutes> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, orgId },
    select: {
      id: true,
      organizerId: true,
      isPrivate: true,
      status: true,
      title: true,
      participants: { select: { userId: true } },
    },
  });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
  return meeting;
}

export async function getMinutes(meetingId: string): Promise<PublicMinutes | null> {
  return prisma.meetingMinutes.findUnique({
    where: { meetingId },
    select: MINUTES_PUBLIC,
  });
}

export async function upsertMinutes(
  meetingId: string,
  user: AuthUser,
  input: MinutesUpsertInput,
): Promise<PublicMinutes> {
  const meeting = await loadMeetingForMinutes(meetingId, user.orgId);
  assertCanEditMinutes(user, meeting);
  assertMinutesWritable(meeting.status);

  const allowedOwners = new Set([
    meeting.organizerId,
    ...meeting.participants.map((p) => p.userId),
  ]);

  const decisions = input.decisions.map((d, i) => {
    const ownerId = d.ownerId ?? null;
    if (ownerId && !allowedOwners.has(ownerId)) {
      throw new HttpError(400, "مسئول باید برگزارکننده یا دعوت‌شده باشد", "BAD_OWNER");
    }
    return {
      sortOrder: i,
      text: d.text,
      ownerId,
      dueAt: parseDueAt(d.dueAt),
    };
  });

  await prisma.$transaction(async (tx) => {
    const existing = await tx.meetingMinutes.findUnique({
      where: { meetingId },
      select: { id: true },
    });

    const minutes = existing
      ? await tx.meetingMinutes.update({
          where: { meetingId },
          data: {
            body: input.body,
            publishedAt: new Date(),
            publishedById: user.id,
          },
        })
      : await tx.meetingMinutes.create({
          data: {
            meetingId,
            body: input.body,
            publishedById: user.id,
          },
        });

    await tx.meetingDecision.deleteMany({ where: { minutesId: minutes.id } });
    if (decisions.length > 0) {
      await tx.meetingDecision.createMany({
        data: decisions.map((d) => ({ ...d, minutesId: minutes.id })),
      });
    }

    await tx.meeting.update({
      where: { id: meetingId },
      data: { updatedAt: new Date() },
    });
    await tx.meetingEvent.create({
      data: {
        meetingId,
        type: "MINUTES_PUBLISHED",
        actorId: user.id,
        data: { decisionCount: decisions.length },
      },
    });
  });

  const saved = await getMinutes(meetingId);
  if (!saved) throw new HttpError(500, "ذخیره صورتجلسه ناموفق بود", "SAVE_FAILED");

  await notificationService.minutesPublished(
    { id: meeting.id, title: meeting.title },
    user.id,
  );

  return saved;
}
