import { prisma } from "@/server/db";
import { HttpError, type AuthUser } from "@/server/auth/session";
import { ORG_COOKIE, ORG_SLUG_HEADER, requestedOrgSlug } from "@/lib/org-slug";

export {
  ORG_COOKIE,
  ORG_SLUG_HEADER,
  SAMPLE_ORG_ID,
  SAMPLE_ORG_SLUG,
  normalizeOrgSlug,
  requestedOrgSlug,
  slugFromHost,
} from "@/lib/org-slug";

export function requireOrgId(user: AuthUser): string {
  if (!user.orgId) {
    throw new HttpError(403, "حساب به سازمانی وصل نیست", "NO_TENANT");
  }
  return user.orgId;
}

export function orgFilter(user: AuthUser): { orgId: string } {
  return { orgId: requireOrgId(user) };
}

export function orgWhere(orgId: string): { orgId: string } {
  return { orgId };
}

export async function findOrgBySlug(slug: string) {
  return prisma.organization.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { id: true, slug: true, name: true, logoUrl: true, timezone: true, legalName: true },
  });
}

export async function resolveOrgIdBySlug(slug: string | null | undefined): Promise<string | null> {
  const s = slug?.trim().toLowerCase();
  if (!s) return null;
  const org = await prisma.organization.findUnique({
    where: { slug: s },
    select: { id: true },
  });
  return org?.id ?? null;
}

/** Header / query / host / cookie — used by middleware and platform-admin switch. */
export function slugFromRequest(req: {
  headers: { get(name: string): string | null };
  cookies?: { get(name: string): { value: string } | undefined };
  nextUrl?: { searchParams: URLSearchParams };
}): string | null {
  return requestedOrgSlug({
    header: req.headers.get(ORG_SLUG_HEADER),
    query: req.nextUrl?.searchParams.get("org") ?? null,
    host: req.headers.get("host"),
    cookie: req.cookies?.get(ORG_COOKIE)?.value ?? null,
  });
}

export async function loadMeetingInOrg<T extends object>(
  id: string,
  orgId: string,
  extra?: T,
) {
  const meeting = await prisma.meeting.findFirst({
    where: { id, orgId },
    ...(extra ?? {}),
  });
  if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
  return meeting;
}

export async function assertBranchInOrg(branchId: string, orgId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, orgId } });
  if (!branch) throw new HttpError(404, "شعبه یافت نشد", "NOT_FOUND");
  return branch;
}

export async function assertRoomInOrg(roomId: string, orgId: string) {
  const room = await prisma.meetingRoom.findFirst({ where: { id: roomId, orgId } });
  if (!room) throw new HttpError(404, "اتاق یافت نشد", "NOT_FOUND");
  return room;
}

export async function assertUserInOrg(userId: string, orgId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, orgId },
  });
  if (!user) throw new HttpError(404, "کاربر یافت نشد", "NOT_FOUND");
  return user;
}

export async function assertUsersInOrg(userIds: string[], orgId: string) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  const count = await prisma.user.count({ where: { id: { in: ids }, orgId } });
  if (count !== ids.length) {
    throw new HttpError(400, "یکی از کاربران متعلق به این سازمان نیست", "CROSS_TENANT");
  }
}

export async function assertPersonInOrg(personId: string, orgId: string) {
  const person = await prisma.personDirectory.findFirst({ where: { id: personId, orgId } });
  if (!person) throw new HttpError(404, "فرد یافت نشد", "NOT_FOUND");
  return person;
}
