import { describe, it, expect } from "vitest";
import {
  parseReminderChannels,
  buildReminderRows,
} from "@/server/services/reminder.service";

describe("scheduleReminders channel rows", () => {
  const startAt = new Date("2030-06-01T10:00:00.000Z");
  const now = new Date("2030-06-01T08:00:00.000Z");
  const users = [
    { id: "u1", phone: "09121234567", email: "a@example.com" },
    { id: "u2", phone: null, email: "b@example.com" },
    { id: "u3", phone: "09129876543", email: "c@example.com" },
  ];

  it("parseReminderChannels defaults to IN_APP when unset", () => {
    const prev = process.env.REMINDER_CHANNELS;
    delete process.env.REMINDER_CHANNELS;
    try {
      expect(parseReminderChannels("")).toEqual(["IN_APP"]);
      expect(parseReminderChannels(undefined)).toEqual(["IN_APP"]);
    } finally {
      if (prev !== undefined) process.env.REMINDER_CHANNELS = prev;
    }
  });

  it("parseReminderChannels reads comma-separated env value", () => {
    expect(parseReminderChannels("IN_APP,SMS,EMAIL")).toEqual(["IN_APP", "SMS", "EMAIL"]);
    expect(parseReminderChannels("sms, email")).toEqual(["SMS", "EMAIL"]);
    expect(parseReminderChannels("IN_APP,PUSH")).toEqual(["IN_APP", "PUSH"]);
  });

  it("buildReminderRows creates IN_APP rows only by default channels", () => {
    const rows = buildReminderRows({
      meetingId: "m1",
      startAt,
      offsets: [30, 10],
      userIds: ["u1", "u2"],
      users,
      channels: ["IN_APP"],
      now,
    });
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.channel === "IN_APP")).toBe(true);
  });

  it("buildReminderRows creates SMS/EMAIL rows when user has contact info", () => {
    const rows = buildReminderRows({
      meetingId: "m1",
      startAt,
      offsets: [30],
      userIds: ["u1", "u2", "u3"],
      users,
      channels: ["IN_APP", "SMS", "EMAIL"],
      now,
    });
    const byChannel = (ch: string) => rows.filter((r) => r.channel === ch);
    expect(byChannel("IN_APP")).toHaveLength(3);
    expect(byChannel("SMS")).toHaveLength(2);
    expect(byChannel("SMS").map((r) => r.userId).sort()).toEqual(["u1", "u3"]);
    expect(byChannel("EMAIL")).toHaveLength(3);
    expect(rows.find((r) => r.userId === "u2" && r.channel === "SMS")).toBeUndefined();
  });

  it("buildReminderRows creates PUSH rows without needing phone or email", () => {
    const rows = buildReminderRows({
      meetingId: "m1",
      startAt,
      offsets: [30],
      userIds: ["u1", "u2"],
      users,
      channels: ["PUSH"],
      now,
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.channel === "PUSH")).toBe(true);
    expect(rows.map((r) => r.userId).sort()).toEqual(["u1", "u2"]);
  });

  it("buildReminderRows skips offsets whose remindAt is in the past", () => {
    const rows = buildReminderRows({
      meetingId: "m1",
      startAt,
      offsets: [30, 150],
      userIds: ["u1"],
      users,
      channels: ["IN_APP"],
      now,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].offsetMin).toBe(30);
  });
});
