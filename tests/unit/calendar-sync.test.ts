import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Meeting } from "@prisma/client";
import {
  buildCalendarPayload,
  syncMeetingCalendarCreate,
  syncMeetingCalendarUpdate,
  syncMeetingCalendarCancel,
  calendarSyncBestEffort,
} from "@/server/services/calendar-sync.service";
import type { CalendarProvider } from "@/server/services/calendar-provider";

const meeting: Meeting = {
  id: "meet-1",
  title: "جلسه تست",
  description: "توضیح",
  organizerId: "org-1",
  branchId: "br-1",
  roomId: "room-1",
  startAt: new Date("2030-06-01T10:00:00Z"),
  endAt: new Date("2030-06-01T11:00:00Z"),
  status: "CONFIRMED",
  meetingType: "INTERNAL",
  priority: "NORMAL",
  cancelReason: null,
  cancelNote: null,
  meetingCode: "code-1",
  isPrivate: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock("@/server/db", () => ({
  prisma: {
    meetingRoom: { findUnique: vi.fn() },
    meetingParticipant: { findMany: vi.fn() },
    meetingGuest: { findMany: vi.fn() },
    meetingCalendarSync: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/server/services/calendar-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/calendar-provider")>();
  return {
    ...actual,
    createCalendarProvider: vi.fn(() => mockProvider),
  };
});

const mockProvider: CalendarProvider = {
  name: "mock",
  createEvent: vi.fn(async () => ({ externalEventId: "mock-meet-1" })),
  updateEvent: vi.fn(async () => {}),
  cancelEvent: vi.fn(async () => {}),
};

import { prisma } from "@/server/db";

describe("buildCalendarPayload", () => {
  beforeEach(() => {
    vi.mocked(prisma.meetingRoom.findUnique).mockResolvedValue({
      id: "room-1",
      name: "اتاق A",
      branch: { name: "ونک" },
    } as never);
    vi.mocked(prisma.meetingParticipant.findMany).mockResolvedValue([
      { user: { email: "a@test.com" } },
    ] as never);
    vi.mocked(prisma.meetingGuest.findMany).mockResolvedValue([
      { email: "guest@test.com" },
    ] as never);
  });

  it("includes room location and attendee emails", async () => {
    const payload = await buildCalendarPayload(meeting);
    expect(payload.title).toBe("جلسه تست");
    expect(payload.location).toContain("اتاق A");
    expect(payload.attendeeEmails).toEqual(
      expect.arrayContaining(["a@test.com", "guest@test.com"]),
    );
    expect(payload.status).toBe("confirmed");
  });

  it("marks pending approval as tentative", async () => {
    const payload = await buildCalendarPayload({
      ...meeting,
      status: "PENDING_APPROVAL",
    });
    expect(payload.status).toBe("tentative");
  });
});

describe("sync hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.meetingCalendarSync.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.meetingCalendarSync.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.meetingCalendarSync.update).mockResolvedValue({} as never);
    vi.mocked(prisma.meetingRoom.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.meetingParticipant.findMany).mockResolvedValue([]);
    vi.mocked(prisma.meetingGuest.findMany).mockResolvedValue([]);
  });

  it("syncMeetingCalendarCreate calls provider and upserts link", async () => {
    await syncMeetingCalendarCreate(meeting, mockProvider);
    expect(mockProvider.createEvent).toHaveBeenCalled();
    expect(prisma.meetingCalendarSync.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          meetingId: "meet-1",
          provider: "mock",
          externalEventId: "mock-meet-1",
        }),
      }),
    );
  });

  it("syncMeetingCalendarUpdate creates when no prior link", async () => {
    await syncMeetingCalendarUpdate(meeting, mockProvider);
    expect(mockProvider.createEvent).toHaveBeenCalled();
  });

  it("syncMeetingCalendarUpdate patches existing external event", async () => {
    vi.mocked(prisma.meetingCalendarSync.findUnique).mockResolvedValue({
      externalEventId: "ext-1",
    } as never);

    await syncMeetingCalendarUpdate(meeting, mockProvider);
    expect(mockProvider.updateEvent).toHaveBeenCalledWith("ext-1", expect.any(Object));
  });

  it("syncMeetingCalendarCancel deletes external event", async () => {
    vi.mocked(prisma.meetingCalendarSync.findUnique).mockResolvedValue({
      externalEventId: "ext-1",
    } as never);

    await syncMeetingCalendarCancel(meeting, mockProvider);
    expect(mockProvider.cancelEvent).toHaveBeenCalledWith("ext-1");
  });

  it("calendarSyncBestEffort swallows provider errors", async () => {
    vi.mocked(mockProvider.createEvent).mockRejectedValueOnce(new Error("network"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(calendarSyncBestEffort("create", meeting)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
