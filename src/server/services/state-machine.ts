import { isAutoApproveMeetingType } from "@/lib";

// Meeting lifecycle state machine — transitions validated everywhere.

export const STATUS_FLOW: Record<string, string[]> = {
  DRAFT: ["PENDING_APPROVAL", "CONFIRMED", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["CONFIRMED", "CANCELLED", "RESCHEDULED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "RESCHEDULED"],
  REJECTED: ["CANCELLED"],
  RESCHEDULED: ["CONFIRMED", "CANCELLED", "IN_PROGRESS", "RESCHEDULED"],
  IN_PROGRESS: ["COMPLETED", "NO_SHOW"],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
  WAITLISTED: ["WAITLIST_OFFERED", "CANCELLED"],
  WAITLIST_OFFERED: ["CONFIRMED", "PENDING_APPROVAL", "WAITLISTED", "CANCELLED"],
};

/** Auto no-show / complete rules: see meeting-lifecycle.ts (worker processMeetingLifecycle). */

export function canTransition(from: string, to: string): boolean {
  return (STATUS_FLOW[from] ?? []).includes(to);
}

export class TransitionError extends Error {
  constructor(from: string, to: string) {
    super(`تغییر وضعیت از ${from} به ${to} مجاز نیست`);
    this.name = "TransitionError";
  }
}

export function assertTransition(from: string, to: string) {
  if (!canTransition(from, to)) throw new TransitionError(from, to);
}

// Approval policy evaluation (configurable via MeetingPolicy)
export interface PolicyValues {
  requireApprovalExternalGuest: boolean;
  requireApprovalVipRoom: boolean;
  requireApprovalLongerThanMin: number; // 0 = off
  autoApproveInternal: boolean;
  minDurationMin: number;
  maxDurationMin: number;
  defaultReminderOffsets: number[];
  holidayBooking: "BLOCK" | "REQUIRE_APPROVAL";
}

export const DEFAULT_POLICIES: PolicyValues = {
  requireApprovalExternalGuest: true,
  requireApprovalVipRoom: true,
  requireApprovalLongerThanMin: 120,
  autoApproveInternal: true,
  minDurationMin: 15,
  maxDurationMin: 480,
  defaultReminderOffsets: [30, 10],
  holidayBooking: "BLOCK",
};

export function evaluateApprovalNeed(
  p: PolicyValues,
  input: {
    hasExternalGuest: boolean;
    isVipRoom: boolean;
    durationMin: number;
    meetingType: string;
    isOrgHoliday?: boolean;
  },
): boolean {
  if (input.isOrgHoliday && p.holidayBooking === "REQUIRE_APPROVAL") return true;
  if (input.hasExternalGuest && p.requireApprovalExternalGuest) return true;
  if (input.isVipRoom && p.requireApprovalVipRoom) return true;
  if (
    p.requireApprovalLongerThanMin > 0 &&
    input.durationMin > p.requireApprovalLongerThanMin
  )
    return true;
  if (isAutoApproveMeetingType(input.meetingType) && p.autoApproveInternal) return false;
  return true;
}
