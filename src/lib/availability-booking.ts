import type { PickedPerson } from "@/components/ui/people-picker";

export const AVAILABILITY_BOOKING_STORAGE_KEY = "meeting-flow:availability-booking";

export interface AvailabilityRoomOption {
  id: string;
  name: string;
  capacity: number;
  equipment?: string[];
}

export interface AvailabilityBookingDraft {
  branchId: string;
  startAt: string;
  endAt: string;
  durationMin: number;
  people: PickedPerson[];
  availableRooms: AvailabilityRoomOption[];
  roomId?: string;
}

export function saveAvailabilityBooking(draft: AvailabilityBookingDraft): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(AVAILABILITY_BOOKING_STORAGE_KEY, JSON.stringify(draft));
}

export function loadAvailabilityBooking(): AvailabilityBookingDraft | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(AVAILABILITY_BOOKING_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AvailabilityBookingDraft;
  } catch {
    return null;
  }
}

export function clearAvailabilityBooking(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(AVAILABILITY_BOOKING_STORAGE_KEY);
}

/** Pick smallest room that fits attendee count (organizer + people). */
export function suggestRoomId(
  rooms: AvailabilityRoomOption[],
  attendeeCount: number,
): string | undefined {
  if (!rooms.length) return undefined;
  const sorted = [...rooms].sort(
    (a, b) => Math.abs(a.capacity - attendeeCount) - Math.abs(b.capacity - attendeeCount),
  );
  return sorted[0]?.id;
}

export function reserveMeetingHref(draft: AvailabilityBookingDraft): string {
  const q = new URLSearchParams({
    from: "availability",
    branchId: draft.branchId,
    startAt: draft.startAt,
    endAt: draft.endAt,
    durationMin: String(draft.durationMin),
  });
  if (draft.roomId) q.set("roomId", draft.roomId);
  return `/meetings/new?${q.toString()}`;
}

/** @deprecated use reserveMeetingHref + saveAvailabilityBooking on click */
export function buildReserveMeetingUrl(draft: AvailabilityBookingDraft): string {
  saveAvailabilityBooking(draft);
  return reserveMeetingHref(draft);
}

/** Validate draft matches URL query (same-origin handoff). */
export function bookingMatchesQuery(
  draft: AvailabilityBookingDraft,
  params: { branchId: string | null; startAt: string | null; endAt: string | null; durationMin: string | null },
): boolean {
  return (
    draft.branchId === params.branchId &&
    draft.startAt === params.startAt &&
    draft.endAt === params.endAt &&
    String(draft.durationMin) === params.durationMin
  );
}
