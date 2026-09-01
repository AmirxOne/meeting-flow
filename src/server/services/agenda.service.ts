import type { Meeting } from "@prisma/client";
import { prisma } from "@/server/db";
import { HttpError, type AuthUser } from "@/server/auth/session";
import type { AgendaReplaceInput } from "@/lib/validations";
import { formatAgendaPlain, type AgendaPlainItem } from "@/lib/agenda";

const AGENDA_PUBLIC = {
  id: true,
  sortOrder: true,
  title: true,
  durationMin: true,
  ownerId: true,
  owner: { select: { id: true, fullName: true } },
} as const;

export type PublicAgendaItem = {
  id: string;
  sortOrder: number;
  title: string;
  durationMin: number | null;
  ownerId: string | null;
  owner: { id: string; fullName: string } | null;
};

type MeetingAccess = Pick<Meeting, "id" | "organizerId" | "isPrivate"> & {
  participants: { userId: string }[];
};

function isSuper(user: AuthUser): boolean {
  return user.isSuperAdmin || user.roleKeys.includes("SUPER_ADMIN");
}

function isInvolved(user: AuthUser, meeting: MeetingAccess): boolean {
  return (
    meeting.organizerId === user.id ||
    meeting.participants.some((p) => p.userId === user.id)
  );
}

export function assertCanViewMeeting(user: AuthUser, meeting: MeetingAccess): void {
  if (!meeting.isPrivate) return;
  if (isInvolved(user, meeting) || isSuper(user)) return;
  throw new HttpError(403, "دسترسی به این جلسه ندارید", "FORBIDDEN");
}

export function assertCanEditAgenda(user: AuthUser, meeting: MeetingAccess): void {
  assertCanViewMeeting(user, meeting);
  if (meeting.organizerId !== user.id) {
    throw new HttpError(403, "فقط برگزارکننده می‌تواند دستور جلسه را ویرایش کند", "FORBIDDEN");
  }
}

export async function loadMeetingForAgenda(meetingId: string, orgId: string): Promise<MeetingAccess> {
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

export async function listAgendaItems(meetingId: string): Promise<PublicAgendaItem[]> {
  return prisma.meetingAgendaItem.findMany({
    where: { meetingId },
    select: AGENDA_PUBLIC,
    orderBy: { sortOrder: "asc" },
  });
}

export async function loadAgendaPlain(meetingId: string): Promise<string> {
  const rows = await prisma.meetingAgendaItem.findMany({
    where: { meetingId },
    select: {
      title: true,
      durationMin: true,
      owner: { select: { fullName: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
  const items: AgendaPlainItem[] = rows.map((r) => ({
    title: r.title,
    durationMin: r.durationMin,
    ownerName: r.owner?.fullName ?? null,
  }));
  return formatAgendaPlain(items);
}

export async function replaceAgenda(
  meetingId: string,
  user: AuthUser,
  input: AgendaReplaceInput,
): Promise<PublicAgendaItem[]> {
  const meeting = await loadMeetingForAgenda(meetingId, user.orgId);
  assertCanEditAgenda(user, meeting);

  const allowedOwners = new Set([
    meeting.organizerId,
    ...meeting.participants.map((p) => p.userId),
  ]);

  const rows = input.items.map((it, i) => {
    const ownerId = it.ownerId ?? null;
    if (ownerId && !allowedOwners.has(ownerId)) {
      throw new HttpError(400, "مسئول باید برگزارکننده یا دعوت‌شده باشد", "BAD_OWNER");
    }
    return {
      meetingId,
      sortOrder: i,
      title: it.title,
      durationMin: it.durationMin ?? null,
      ownerId,
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.meetingAgendaItem.deleteMany({ where: { meetingId } });
    if (rows.length > 0) {
      await tx.meetingAgendaItem.createMany({ data: rows });
    }
    await tx.meeting.update({
      where: { id: meetingId },
      data: { updatedAt: new Date() },
    });
    await tx.meetingEvent.create({
      data: {
        meetingId,
        type: "AGENDA_UPDATED",
        actorId: user.id,
        data: { count: rows.length },
      },
    });
  });

  return listAgendaItems(meetingId);
}
