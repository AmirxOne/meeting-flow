import { describe, it, expect } from "vitest";
import {
  availableNotifChannels,
  filterIdsForChannel,
  isNotifChannelEnabled,
  mergeNotifPrefs,
  parseOrgNotifChannels,
  parseStoredNotifPrefs,
  resolvedNotifMatrix,
} from "@/lib/notification-prefs";

const ORG = ["IN_APP", "SMS", "EMAIL", "PUSH"] as const;
const user = { id: "u1", phone: "09120001006", email: "ali@example.com" };

describe("parseOrgNotifChannels", () => {
  it("defaults to IN_APP when unset", () => {
    expect(parseOrgNotifChannels("")).toEqual(["IN_APP"]);
    expect(parseOrgNotifChannels(undefined)).toEqual(["IN_APP"]);
  });
});

describe("isNotifChannelEnabled", () => {
  it("defaults on when prefs are null and the org offers the channel", () => {
    expect(
      isNotifChannelEnabled({
        prefs: null,
        event: "invite",
        channel: "SMS",
        orgChannels: ORG,
        hasPhone: true,
        hasEmail: true,
      }),
    ).toBe(true);
  });

  it("does not send a channel the user turned off", () => {
    expect(
      isNotifChannelEnabled({
        prefs: { reminder: { SMS: false } },
        event: "reminder",
        channel: "SMS",
        orgChannels: ORG,
        hasPhone: true,
        hasEmail: true,
      }),
    ).toBe(false);
    expect(
      isNotifChannelEnabled({
        prefs: { invite: { IN_APP: false } },
        event: "invite",
        channel: "IN_APP",
        orgChannels: ORG,
      }),
    ).toBe(false);
  });

  it("does not send SMS without a phone even if prefs are on", () => {
    expect(
      isNotifChannelEnabled({
        prefs: { invite: { SMS: true } },
        event: "invite",
        channel: "SMS",
        orgChannels: ORG,
        hasPhone: false,
        hasEmail: true,
      }),
    ).toBe(false);
  });

  it("does not send EMAIL without an email", () => {
    expect(
      isNotifChannelEnabled({
        prefs: null,
        event: "reschedule",
        channel: "EMAIL",
        orgChannels: ORG,
        hasPhone: true,
        hasEmail: false,
      }),
    ).toBe(false);
  });

  it("does not send PUSH when the org does not offer it", () => {
    expect(
      isNotifChannelEnabled({
        prefs: null,
        event: "invite",
        channel: "PUSH",
        orgChannels: ["IN_APP", "SMS"],
        hasPush: true,
      }),
    ).toBe(false);
  });

  it("keeps other events on when only reminder SMS is off", () => {
    expect(
      isNotifChannelEnabled({
        prefs: { reminder: { SMS: false } },
        event: "invite",
        channel: "SMS",
        orgChannels: ORG,
        hasPhone: true,
      }),
    ).toBe(true);
  });
});

describe("filterIdsForChannel — disabled channel is not sent", () => {
  const users = [
    user,
    { id: "u2", phone: null, email: "nophone@example.com" },
  ];

  it("excludes a user who turned SMS off for invite", () => {
    const prefsByUser = new Map([
      ["u1", { invite: { SMS: false as const } }],
      ["u2", {}],
    ]);
    expect(
      filterIdsForChannel(users, {
        prefsByUser,
        event: "invite",
        channel: "SMS",
        orgChannels: ORG,
      }),
    ).toEqual([]);
  });

  it("excludes users without a phone from SMS", () => {
    const prefsByUser = new Map([
      ["u1", {}],
      ["u2", {}],
    ]);
    expect(
      filterIdsForChannel(users, {
        prefsByUser,
        event: "reschedule",
        channel: "SMS",
        orgChannels: ORG,
      }),
    ).toEqual(["u1"]);
  });

  it("still sends IN_APP to a user who only disabled SMS", () => {
    const prefsByUser = new Map([["u1", { reminder: { SMS: false as const } }]]);
    expect(
      filterIdsForChannel([user], {
        prefsByUser,
        event: "reminder",
        channel: "IN_APP",
        orgChannels: ORG,
      }),
    ).toEqual(["u1"]);
  });
});

describe("resolvedNotifMatrix / parse / merge", () => {
  it("always lists IN_APP even if org env omitted it", () => {
    expect(availableNotifChannels(["SMS", "EMAIL"])).toEqual(["IN_APP", "SMS", "EMAIL"]);
  });

  it("parses stored json and ignores junk", () => {
    expect(parseStoredNotifPrefs(null)).toEqual({});
    expect(parseStoredNotifPrefs("nope")).toEqual({});
    expect(parseStoredNotifPrefs({ invite: { SMS: false, NOPE: true } })).toEqual({
      invite: { SMS: false },
    });
  });

  it("merges a single cell into existing prefs", () => {
    expect(
      mergeNotifPrefs({ invite: { SMS: false } }, { reminder: { EMAIL: false } }),
    ).toEqual({
      invite: { SMS: false },
      reminder: { EMAIL: false },
    });
  });

  it("shows SMS off in the UI matrix when the user has no phone", () => {
    const matrix = resolvedNotifMatrix({
      prefs: {},
      orgChannels: ORG,
      hasPhone: false,
      hasEmail: true,
      hasPush: true,
    });
    expect(matrix.invite.SMS).toBe(false);
    expect(matrix.invite.IN_APP).toBe(true);
    expect(matrix.invite.EMAIL).toBe(true);
  });
});
