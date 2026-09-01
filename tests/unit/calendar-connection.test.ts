import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listInvolvedCalendarConnections,
  providersForFamily,
} from "@/server/services/calendar-connection.service";

vi.mock("@/server/db", () => ({
  prisma: {
    meetingParticipant: { findMany: vi.fn() },
    userCalendarConnection: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/server/db";

describe("providersForFamily", () => {
  it("keeps google mock in the google family only", () => {
    expect(providersForFamily("google")).toEqual(["google", "mock"]);
    expect(providersForFamily("outlook")).toEqual(["outlook"]);
  });
});

describe("listInvolvedCalendarConnections", () => {
  beforeEach(() => {
    vi.mocked(prisma.meetingParticipant.findMany).mockResolvedValue([
      { userId: "p1" },
    ] as never);
  });

  it("returns google and outlook for the same involved user", async () => {
    vi.mocked(prisma.userCalendarConnection.findMany).mockResolvedValue([
      { userId: "org-1", provider: "google", calendarId: "primary" },
      { userId: "org-1", provider: "outlook", calendarId: "calendar" },
    ] as never);

    const rows = await listInvolvedCalendarConnections({
      id: "m1",
      organizerId: "org-1",
    });
    expect(rows.map((r) => `${r.userId}:${r.provider}`).sort()).toEqual([
      "org-1:google",
      "org-1:outlook",
    ]);
  });

  it("drops mock google when a real google row exists", async () => {
    vi.mocked(prisma.meetingParticipant.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.userCalendarConnection.findMany).mockResolvedValue([
      { userId: "org-1", provider: "mock", calendarId: "primary" },
      { userId: "org-1", provider: "google", calendarId: "primary" },
    ] as never);

    const rows = await listInvolvedCalendarConnections({
      id: "m1",
      organizerId: "org-1",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe("google");
  });
});
