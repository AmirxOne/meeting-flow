import type { Meeting } from "@prisma/client";

export interface PrivacyViewer {
  id: string;
  isSuperAdmin?: boolean;
}

/** Prisma `where` fragment: meetings this user may list without view-all. */
export function meetingAccessOr(userId: string) {
  return {
    OR: [
      { organizerId: userId },
      { createdById: userId },
      { participants: { some: { userId } } },
    ],
  };
}

/** Busy-slot titles: hide private content unless the viewer organized that meeting. */
export function maskPrivateConflictTitle(
  title: string,
  isPrivate: boolean,
  meetingOrganizerId: string,
  viewer: PrivacyViewer,
): string {
  if (!isPrivate || viewer.isSuperAdmin || meetingOrganizerId === viewer.id) return title;
  return "جلسه محرمانه";
}

export function maskPrivateMeeting<T extends {
  isPrivate?: boolean;
  organizerId?: string;
  createdById?: string | null;
  participants?: { userId: string }[];
}>(
  m: T,
  viewer: PrivacyViewer,
): T & { isMasked?: boolean } {
  const involved =
    (m.organizerId && m.organizerId === viewer.id) ||
    (m.createdById && m.createdById === viewer.id) ||
    (m.participants ?? []).some((p) => p.userId === viewer.id);
  // ONLY the super admin can see through confidentiality — everyone else
  // (even view-all holders) gets the masked block.
  if (!m.isPrivate || viewer.isSuperAdmin || involved) return m;
  const extra = m as T & {
    series?: { title?: string } | null;
    minutes?: unknown;
    decisions?: unknown;
  };
  return {
    ...m,
    isMasked: true,
    title: "جلسه محرمانه",
    description: undefined,
    meetingType: undefined,
    priority: undefined,
    minutes: undefined,
    decisions: undefined,
    videoUrl: undefined,
    videoProvider: undefined,
    ...(extra.series
      ? { series: { ...extra.series, title: "جلسه محرمانه" } }
      : {}),
  } as T & { isMasked: boolean };
}
