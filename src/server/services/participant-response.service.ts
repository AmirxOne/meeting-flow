import type { ResponseStatus } from "@/lib";

export const PARTICIPANT_RESPONSES = ["ACCEPTED", "DECLINED", "TENTATIVE"] as const;
export type ParticipantResponse = (typeof PARTICIPANT_RESPONSES)[number];

const CLOSED_MEETING_STATUSES = new Set(["COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW"]);

export function isParticipantResponse(value: string): value is ParticipantResponse {
  return (PARTICIPANT_RESPONSES as readonly string[]).includes(value);
}

/** Meeting must still be open for RSVP updates. */
export function canRespondToMeeting(meetingStatus: string): boolean {
  return !CLOSED_MEETING_STATUSES.has(meetingStatus);
}

/** Self always; organizer may respond on behalf of invited participants. */
export function canActorSetResponse(
  actorId: string,
  targetUserId: string,
  organizerId: string,
): boolean {
  if (actorId === targetUserId) return true;
  return actorId === organizerId;
}

export function responseStatusLabel(status: ResponseStatus | string): string {
  const labels: Record<string, string> = {
    PENDING: "در انتظار پاسخ",
    ACCEPTED: "قبول",
    DECLINED: "رد",
    TENTATIVE: "مرددد",
  };
  return labels[status] ?? status;
}
