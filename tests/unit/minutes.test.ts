import { describe, expect, it } from "vitest";
import { HttpError } from "@/server/auth/session";
import type { AuthUser } from "@/server/auth/session";
import {
  assertCanEditMinutes,
  assertMinutesWritable,
  parseDueAt,
} from "@/server/services/minutes.service";
import { assertCanViewMeeting } from "@/server/services/agenda.service";

function user(partial: Partial<AuthUser> & Pick<AuthUser, "id" | "permissions" | "roleKeys">): AuthUser {
  return {
    email: `${partial.id}@example.com`,
    fullName: partial.id,
    phone: null,
    avatarUrl: null,
    jobTitle: null,
    department: null,
    isSuperAdmin: false,
    isPlatformAdmin: false,
    orgId: "org-main",
    orgSlug: "sample",
    branchId: null,
    ...partial,
  };
}

const meeting = {
  id: "m1",
  organizerId: "ali",
  isPrivate: false,
  status: "COMPLETED",
  title: "جلسه",
  participants: [{ userId: "ali" }, { userId: "amir" }],
};

const ali = user({
  id: "ali",
  roleKeys: ["EMPLOYEE"],
  permissions: new Set(["meeting:view", "meeting:create", "meeting:update"]),
});
const amir = user({
  id: "amir",
  roleKeys: ["EMPLOYEE"],
  permissions: new Set(["meeting:view", "meeting:create", "meeting:update"]),
});
const sara = user({
  id: "sara",
  roleKeys: ["BRANCH_MANAGER"],
  permissions: new Set(["meeting:view", "meeting:view-all", "meeting:update"]),
});

describe("minutes access", () => {
  it("lets only the organizer write", () => {
    expect(() => assertCanEditMinutes(ali, meeting)).not.toThrow();
    expect(() => assertCanEditMinutes(amir, meeting)).toThrow(HttpError);
    expect(() => assertCanEditMinutes(sara, meeting)).toThrow(HttpError);
  });

  it("hides private minutes from outsiders", () => {
    const priv = { ...meeting, isPrivate: true };
    expect(() => assertCanViewMeeting(sara, priv)).toThrow(HttpError);
    expect(() => assertCanViewMeeting(amir, priv)).not.toThrow();
    expect(() => assertCanEditMinutes(ali, priv)).not.toThrow();
  });
});

describe("assertMinutesWritable", () => {
  it("allows IN_PROGRESS and COMPLETED", () => {
    expect(() => assertMinutesWritable("IN_PROGRESS")).not.toThrow();
    expect(() => assertMinutesWritable("COMPLETED")).not.toThrow();
  });

  it("rejects other statuses", () => {
    expect(() => assertMinutesWritable("CONFIRMED")).toThrow(HttpError);
    expect(() => assertMinutesWritable("NO_SHOW")).toThrow(HttpError);
    expect(() => assertMinutesWritable("CANCELLED")).toThrow(HttpError);
  });
});

describe("parseDueAt", () => {
  it("parses YYYY-MM-DD as Tehran start of day", () => {
    const d = parseDueAt("2030-06-01");
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe("2030-05-31T20:30:00.000Z");
  });

  it("returns null for empty", () => {
    expect(parseDueAt(null)).toBeNull();
    expect(parseDueAt(undefined)).toBeNull();
  });
});
