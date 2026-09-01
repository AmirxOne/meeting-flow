import { describe, expect, it } from "vitest";
import {
  buildReminderEmailBody,
  formatAgendaPlain,
  mergeDescriptionWithAgenda,
} from "@/lib/agenda";
import { buildVEvent } from "@/lib/ics";
import { HttpError } from "@/server/auth/session";
import { assertCanEditAgenda, assertCanViewMeeting } from "@/server/services/agenda.service";
import type { AuthUser } from "@/server/auth/session";

describe("formatAgendaPlain", () => {
  it("returns empty string when there are no items", () => {
    expect(formatAgendaPlain([])).toBe("");
  });

  it("numbers items with duration and owner in Persian", () => {
    const text = formatAgendaPlain([
      { title: "مرور KPI", durationMin: 15, ownerName: "علی رضایی" },
      { title: "سؤالات باز", durationMin: null, ownerName: null },
    ]);
    expect(text.startsWith("دستور جلسه:")).toBe(true);
    expect(text).toContain("مرور KPI");
    expect(text).toContain("۱۵ دقیقه");
    expect(text).toContain("علی رضایی");
    expect(text).toContain("سؤالات باز");
    expect(text).toMatch(/۱\./);
  });
});

describe("mergeDescriptionWithAgenda", () => {
  it("keeps description when agenda is empty", () => {
    expect(mergeDescriptionWithAgenda("توضیح", "")).toBe("توضیح");
  });

  it("uses only agenda when description is missing", () => {
    expect(mergeDescriptionWithAgenda(null, "دستور جلسه:\n۱. الف")).toBe("دستور جلسه:\n۱. الف");
  });

  it("joins description and agenda", () => {
    expect(mergeDescriptionWithAgenda("توضیح", "دستور جلسه:\n۱. الف")).toBe(
      "توضیح\n\nدستور جلسه:\n۱. الف",
    );
  });
});

describe("buildReminderEmailBody", () => {
  it("includes agenda in reminder email", () => {
    const body = buildReminderEmailBody("استندآپ", "دستور جلسه:\n۱. مرور");
    expect(body).toContain("یادآوری جلسه «استندآپ»");
    expect(body).toContain("دستور جلسه");
    expect(body).toContain("مرور");
  });

  it("falls back to title-only when agenda is empty", () => {
    expect(buildReminderEmailBody("استندآپ", "")).toBe("یادآوری جلسه «استندآپ»");
  });
});

describe("ICS description with agenda", () => {
  it("puts agenda text into DESCRIPTION", () => {
    const desc = mergeDescriptionWithAgenda("خلاصه", formatAgendaPlain([{ title: "تصمیم‌گیری", durationMin: 10, ownerName: null }]));
    const vevent = buildVEvent({
      uid: "a@mehrsa",
      title: "جلسه",
      description: desc,
      startAt: new Date("2030-06-01T06:30:00.000Z"),
      endAt: new Date("2030-06-01T07:30:00.000Z"),
      createdAt: new Date("2030-05-01T08:00:00.000Z"),
      updatedAt: new Date("2030-05-02T08:00:00.000Z"),
      status: "CONFIRMED",
    });
    expect(vevent).toContain("DESCRIPTION:");
    expect(vevent).toContain("دستور جلسه");
    expect(vevent).toContain("تصمیم‌گیری");
  });
});

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
  participants: [{ userId: "ali" }, { userId: "amir" }],
};

describe("agenda access", () => {
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

  it("lets invitees view but only the organizer edit", () => {
    expect(() => assertCanViewMeeting(amir, meeting)).not.toThrow();
    expect(() => assertCanEditAgenda(ali, meeting)).not.toThrow();
    expect(() => assertCanEditAgenda(amir, meeting)).toThrow(HttpError);
    expect(() => assertCanEditAgenda(sara, meeting)).toThrow(HttpError);
  });

  it("hides private agenda from outsiders", () => {
    const priv = { ...meeting, isPrivate: true };
    expect(() => assertCanViewMeeting(sara, priv)).toThrow(HttpError);
    expect(() => assertCanViewMeeting(amir, priv)).not.toThrow();
  });
});
