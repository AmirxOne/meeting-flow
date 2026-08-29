import type { Meeting } from "@prisma/client";

export interface PrivacyViewer {
  id: string;
  isSuperAdmin?: boolean;
}

/**
 * Mask a private meeting for viewers who are not the organizer,
 * a participant, or a meeting:view-all holder. The time/room block
 * stays visible (rooms are shared resources); the CONTENT is hidden.
 */
export function maskPrivateMeeting<T extends { isPrivate?: boolean; organizerId?: string; participants?: { userId: string }[] }>(
  m: T,
  viewer: PrivacyViewer,
): T & { isMasked?: boolean } {
  const involved =
    (m.organizerId && m.organizerId === viewer.id) ||
    (m.participants ?? []).some((p) => p.userId === viewer.id);
  // ONLY the super admin can see through confidentiality — everyone else
  // (even view-all holders) gets the masked block.
  if (!m.isPrivate || viewer.isSuperAdmin || involved) return m;
  return {
    ...m,
    isMasked: true,
    title: "جلسه محرمانه",
    description: undefined,
    meetingType: undefined,
    priority: undefined,
  } as T & { isMasked: boolean };
}
