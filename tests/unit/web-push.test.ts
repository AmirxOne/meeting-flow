import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseVapidConfig,
  reminderPushPayload,
  sendWebPushToUser,
  sendWebPushToUsers,
} from "@/server/services/web-push.service";

vi.mock("@/server/db", () => ({
  prisma: {
    pushSubscription: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/server/db";

const findMany = vi.mocked(prisma.pushSubscription.findMany);
const deleteMany = vi.mocked(prisma.pushSubscription.deleteMany);

const vapid = {
  publicKey: "B".repeat(80),
  privateKey: "x".repeat(40),
  subject: "mailto:test@example.com",
};

describe("parseVapidConfig", () => {
  it("returns null when keys are missing", () => {
    expect(parseVapidConfig({})).toBeNull();
    expect(parseVapidConfig({ VAPID_PUBLIC_KEY: "short", VAPID_PRIVATE_KEY: "short" })).toBeNull();
  });

  it("reads public/private keys from env", () => {
    const cfg = parseVapidConfig({
      VAPID_PUBLIC_KEY: vapid.publicKey,
      VAPID_PRIVATE_KEY: vapid.privateKey,
      VAPID_SUBJECT: "mailto:ops@example.com",
    });
    expect(cfg).toEqual({
      publicKey: vapid.publicKey,
      privateKey: vapid.privateKey,
      subject: "mailto:ops@example.com",
    });
  });
});

describe("sendWebPushToUser", () => {
  beforeEach(() => {
    findMany.mockReset();
    deleteMany.mockReset();
  });

  it("does not crash without a user id", async () => {
    await expect(sendWebPushToUser(null, { title: "t", body: "b" })).resolves.toEqual({
      sent: 0,
      skipped: "no-user",
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("does not crash when VAPID is unset", async () => {
    await expect(
      sendWebPushToUser("u1", { title: "t", body: "b" }, { vapid: null }),
    ).resolves.toEqual({ sent: 0, skipped: "no-vapid" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("does not crash when the user has no subscription", async () => {
    findMany.mockResolvedValue([]);
    const sender = vi.fn();
    await expect(
      sendWebPushToUser("u1", { title: "یادآوری", body: "۱۰ دقیقه دیگر" }, { vapid, sender }),
    ).resolves.toEqual({ sent: 0, skipped: "no-subscription" });
    expect(sender).not.toHaveBeenCalled();
  });

  it("does not crash if subscription lookup throws", async () => {
    findMany.mockRejectedValue(new Error("db down"));
    await expect(
      sendWebPushToUser("u1", { title: "t", body: "b" }, { vapid, sender: vi.fn() }),
    ).resolves.toEqual({ sent: 0, skipped: "lookup-failed" });
  });

  it("sends to each stored subscription", async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const result = await sendWebPushToUser(
      "u1",
      { title: "دعوت", body: "جلسه", url: "/meetings/m1" },
      {
        vapid,
        sender,
        subscriptions: [
          { id: "s1", endpoint: "https://push.example/1", p256dh: "pk", auth: "ak" },
        ],
      },
    );
    expect(result).toEqual({ sent: 1, skipped: null });
    expect(sender).toHaveBeenCalledOnce();
    const [sub, payload] = sender.mock.calls[0] as [
      { endpoint: string; keys: { p256dh: string; auth: string } },
      string,
    ];
    expect(sub.endpoint).toBe("https://push.example/1");
    expect(JSON.parse(payload)).toMatchObject({ title: "دعوت", url: "/meetings/m1" });
  });

  it("drops gone subscriptions without throwing", async () => {
    const sender = vi.fn().mockRejectedValue({ statusCode: 410 });
    deleteMany.mockResolvedValue({ count: 1 });
    await expect(
      sendWebPushToUser("u1", { title: "t", body: "b" }, {
        vapid,
        sender,
        subscriptions: [
          { id: "gone", endpoint: "https://push.example/old", p256dh: "pk", auth: "ak" },
        ],
      }),
    ).resolves.toEqual({ sent: 0, skipped: "send-failed" });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "gone" } });
  });
});

describe("sendWebPushToUsers", () => {
  it("skips empty lists without crashing", async () => {
    await expect(
      sendWebPushToUsers([], { title: "t", body: "b" }, { vapid: null }),
    ).resolves.toEqual({ sent: 0 });
  });
});

describe("reminderPushPayload", () => {
  it("uses Persian digits for the offset", () => {
    expect(reminderPushPayload("هماهنگی", 15, "m1")).toEqual({
      title: "یادآوری: جلسه «هماهنگی»",
      body: "۱۵ دقیقه دیگر آغاز می‌شود",
      url: "/meetings/m1",
    });
  });
});
