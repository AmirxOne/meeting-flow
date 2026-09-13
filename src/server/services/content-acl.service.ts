import { prisma } from "@/server/db";
import { HttpError, type AuthUser } from "@/server/auth/session";

/** Section-level confidentiality for meeting content.
 *  All checks are SERVER-SIDE and re-evaluated on EVERY request. */

export const SECTIONS = ["AGENDA", "TOPICS", "SUMMARY", "BODY"] as const;
export type ContentSection = (typeof SECTIONS)[number];

export const SECTION_FA: Record<ContentSection, string> = {
  AGENDA: "دستور جلسه",
  TOPICS: "موضوعات مطرح‌شده",
  SUMMARY: "خلاصه جلسه",
  BODY: "متن کامل صورت‌جلسه",
};

export type AclLevel = "ALL_PARTICIPANTS" | "RESTRICTED" | "ORGANIZER_ONLY";

export type MeetingForAcl = {
  id: string;
  organizerId: string;
  isPrivate: boolean;
  participants: { userId: string }[];
  secretaries?: { userId: string }[];
};

async function loadAcls(meetingId: string) {
  const rows = await prisma.meetingContentAcl.findMany({ where: { meetingId } });
  return new Map(rows.map((r) => [r.section as ContentSection, r]));
}

/** Who is allowed to see a section? Pure policy — called on every request. */
export async function canViewSection(
  user: AuthUser,
  meeting: MeetingForAcl,
  section: ContentSection,
): Promise<boolean> {
  // platform super admin sees everything (existing convention)
  if (user.isSuperAdmin || user.roleKeys.includes("SUPER_ADMIN")) return true;
  // meeting organizer always sees all sections of their meeting
  if (meeting.organizerId === user.id) return true;

  const acls = await loadAcls(meeting.id);
  const acl = acls.get(section);
  if (!acl || acl.level === "ALL_PARTICIPANTS") {
    // default: any participant of the meeting
    return meeting.participants.some((p) => p.userId === user.id);
  }
  if (acl.level === "ORGANIZER_ONLY") return false; // already excluded organizer above
  // RESTRICTED: explicit allow-list (+ organizer, checked above)
  return acl.allowedUserIds.includes(user.id);
}

/** Assert + throw 403 with a generic message (no content hints). */
export async function assertCanViewSection(
  user: AuthUser,
  meeting: MeetingForAcl,
  section: ContentSection,
): Promise<void> {
  if (!(await canViewSection(user, meeting, section))) {
    throw new HttpError(403, "دسترسی به این بخش محرمانه ندارید", "SECTION_FORBIDDEN");
  }
}

/** Filter topics by per-topic visibility. Hidden topics are REMOVED, not masked. */
export function filterTopicsForUser(
  user: AuthUser,
  meeting: MeetingForAcl,
  topics: {
    id: string;
    visibility: string;
    allowedUserIds: string[];
    [k: string]: unknown;
  }[],
) {
  const isSuper = user.isSuperAdmin || user.roleKeys.includes("SUPER_ADMIN");
  return topics.filter((t) => {
    if (isSuper || meeting.organizerId === user.id) return true;
    if (t.visibility === "OPEN") return true;
    return t.allowedUserIds.includes(user.id);
  });
}

/** Who can edit agenda/topics/minutes: organizer, assigned secretary (with perm), or admin roles. */
export function canEditContent(
  user: AuthUser,
  meeting: MeetingForAcl & { secretaries: { userId: string }[] },
): boolean {
  if (user.isSuperAdmin || user.roleKeys.includes("SUPER_ADMIN")) return true;
  if (user.roleKeys.includes("ADMIN")) return true;
  if (meeting.organizerId === user.id) return true;
  return meeting.secretaries.some((s) => s.userId === user.id);
}

/** Load meeting with everything the ACL needs. */
export async function loadMeetingForAcl(meetingId: string, orgId: string): Promise<MeetingForAcl & { secretaries: { userId: string }[] }> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, orgId },
    select: {
      id: true,
      organizerId: true,
      isPrivate: true,
      participants: { select: { userId: true } },
      secretaries: { select: { userId: true } },
    },
  });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
  return meeting;
}

/** Upsert a section ACL (organizer only) + audit trail of who changed access. */
export async function setSectionAcl(
  actor: AuthUser,
  meetingId: string,
  section: ContentSection,
  level: AclLevel,
  allowedUserIds: string[],
): Promise<void> {
  if (!SECTIONS.includes(section)) throw new HttpError(400, "بخش نامعتبر", "BAD_SECTION");
  await prisma.meetingContentAcl.upsert({
    where: { meetingId_section: { meetingId, section } },
    create: { meetingId, section, level, allowedUserIds, updatedById: actor.id },
    update: { level, allowedUserIds, updatedById: actor.id, updatedAt: new Date() },
  });
}

/** Readable ACL state for the access-management UI (organizer view). */
export async function getAcls(meetingId: string) {
  const rows = await prisma.meetingContentAcl.findMany({ where: { meetingId } });
  return SECTIONS.map((s) => {
    const row = rows.find((r) => r.section === s);
    return {
      section: s,
      sectionFa: SECTION_FA[s],
      level: (row?.level ?? "ALL_PARTICIPANTS") as AclLevel,
      allowedUserIds: row?.allowedUserIds ?? [],
    };
  });
}
