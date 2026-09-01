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
import { listInvolvedCalendarConnections } from "@/server/services/calendar-connection.service";
import { createCalendarProviderForConnection } from "@/server/services/calendar-provider";

const meeting: Meeting = {
  id: "meet-1",
  orgId: "org-main",
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
  seriesId: null,
  originalStartAt: null,
  isException: false,
  videoProvider: null,
  videoUrl: null,
  createdById: null,
  waitlistQueuedAt: null,
  waitlistOfferedAt: null,
  waitlistOfferExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock("@/server/db", () => ({
  prisma: {
    meetingRoom: { findUnique: vi.fn() },
    meetingParticipant: { findMany: vi.fn() },
    meetingGuest: { findMany: vi.fn() },
    meetingAgendaItem: { findMany: vi.fn() },
    meetingCalendarSync: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/server/services/calendar-connection.service", () => ({
  listInvolvedCalendarConnections: vi.fn(),
}));

vi.mock("@/server/services/calendar-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/calendar-provider")>();
  return {
    ...actual,
    createCalendarProviderForConnection: vi.fn(),
  };
});

const mockProvider: CalendarProvider = {
  name: "mock",
  createEvent: vi.fn(async () => ({ externalEventId: "mock-meet-1" })),
  updateEvent: vi.fn(async () => {}),
  cancelEvent: vi.fn(async () => {}),
};

import { prisma } from "@/server/db";

function mockRoomAndPeople() {
  vi.mocked(prisma.meetingRoom.findUnique).mockResolvedValue({
    id: "room-1",
    name: "اتاق A",
    branch: { name: "ونک" },
  } as never);
  vi.mocked(prisma.meetingParticipant.findMany).mockResolvedValue([
    { userId: "p1", user: { email: "a@test.com" } },
  ] as never);
  vi.mocked(prisma.meetingGuest.findMany).mockResolvedValue([
    { email: "guest@test.com" },
  ] as never);
  vi.mocked(prisma.meetingAgendaItem.findMany).mockResolvedValue([] as never);
}

describe("buildCalendarPayload", () => {
  beforeEach(() => {
    mockRoomAndPeople();
  });

  it("includes room location and attendee emails", async () => {
    const payload = await buildCalendarPayload(meeting);
    expect(payload?.title).toBe("جلسه تست");
    expect(payload?.location).toContain("اتاق A");
    expect(payload?.attendeeEmails).toEqual(
      expect.arrayContaining(["a@test.com", "guest@test.com"]),
    );
    expect(payload?.status).toBe("confirmed");
  });

  it("appends agenda items to the calendar description", async () => {
    vi.mocked(prisma.meetingAgendaItem.findMany).mockResolvedValue([
      { title: "مرور بودجه", durationMin: 15, owner: { fullName: "علی رضایی" } },
    ] as never);
    const payload = await buildCalendarPayload(meeting);
    expect(payload?.description).toContain("توضیح");
    expect(payload?.description).toContain("دستور جلسه");
    expect(payload?.description).toContain("مرور بودجه");
    expect(payload?.description).toContain("علی رضایی");
  });

  it("marks pending approval as tentative", async () => {
    const payload = await buildCalendarPayload({
      ...meeting,
      status: "PENDING_APPROVAL",
    });
    expect(payload?.status).toBe("tentative");
  });

  it("keeps the real title for the organizer of a private meeting", async () => {
    const payload = await buildCalendarPayload(
      { ...meeting, isPrivate: true },
      { id: "org-1" },
    );
    expect(payload?.title).toBe("جلسه تست");
    expect(payload?.attendeeEmails).toEqual([]);
  });

  it("keeps the real title for an invited participant of a private meeting", async () => {
    const payload = await buildCalendarPayload(
      { ...meeting, isPrivate: true },
      { id: "p1" },
    );
    expect(payload?.title).toBe("جلسه تست");
  });

  it("does not sync a private meeting to an outsider (null payload)", async () => {
    const payload = await buildCalendarPayload(
      { ...meeting, isPrivate: true },
      { id: "stranger" },
    );
    expect(payload).toBeNull();
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
    vi.mocked(prisma.meetingAgendaItem.findMany).mockResolvedValue([]);
    vi.mocked(createCalendarProviderForConnection).mockReturnValue(mockProvider);
    vi.mocked(listInvolvedCalendarConnections).mockResolvedValue([]);
    vi.mocked(mockProvider.createEvent).mockResolvedValue({ externalEventId: "mock-meet-1" });
  });

  it("syncMeetingCalendarCreate calls provider and upserts per-user link", async () => {
    await syncMeetingCalendarCreate(meeting, mockProvider);
    expect(mockProvider.createEvent).toHaveBeenCalled();
    expect(prisma.meetingCalendarSync.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          meetingId_userId_provider: {
            meetingId: "meet-1",
            userId: "org-1",
            provider: "mock",
          },
        },
        create: expect.objectContaining({
          meetingId: "meet-1",
          userId: "org-1",
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

  it("calendarSyncBestEffort no-ops when nobody is connected", async () => {
    vi.mocked(listInvolvedCalendarConnections).mockResolvedValue([]);
    await expect(calendarSyncBestEffort("create", meeting)).resolves.toBeUndefined();
    expect(mockProvider.createEvent).not.toHaveBeenCalled();
  });

  it("calendarSyncBestEffort swallows provider errors", async () => {
    vi.mocked(listInvolvedCalendarConnections).mockResolvedValue([
      {
        id: "c1",
        userId: "org-1",
        provider: "mock",
        refreshTokenEnc: "x",
        calendarId: "primary",
        accountEmail: "org@test.com",
        connectedAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);
    vi.mocked(mockProvider.createEvent).mockRejectedValueOnce(new Error("network"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(calendarSyncBestEffort("create", meeting)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("does not create an event when the viewer would only see a masked private meeting", async () => {
    vi.mocked(prisma.meetingParticipant.findMany).mockResolvedValue([]);
    await syncMeetingCalendarCreate(
      { ...meeting, isPrivate: true },
      mockProvider,
      "stranger",
    );
    expect(mockProvider.createEvent).not.toHaveBeenCalled();
  });
});
