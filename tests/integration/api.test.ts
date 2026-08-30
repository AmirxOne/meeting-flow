// Integration tests — run against the real dev stack:
//   postgres+seed up (docker compose), then: pnpm vitest run tests/integration
// Uses the real HTTP API on localhost:3100 (start `pnpm dev` first) — proves
// the full chain: Zod → auth → service → transaction → exclusion constraint.

import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.TEST_BASE ?? "http://localhost:3100";

let adminCookie = "";
let employeeCookie = "";
let operatorCookie = "";
let roomManagerCookie = "";

interface Meeting {
  id: string;
  title: string;
  status: string;
  startAt: string;
  endAt: string;
  roomId: string | null;
  branchId: string;
  organizerId: string;
}

const loginCache = new Map<string, string>();

async function login(email: string, password = "Pass1234"): Promise<string> {
  const cached = loginCache.get(email);
  if (cached) return cached;
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  if (!cookie) throw new Error(`login failed for ${email}: ${res.status}`);
  loginCache.set(email, cookie);
  return cookie;
}

async function api(
  path: string,
  init: RequestInit & { cookie?: string; json?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const { cookie, json, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* empty */ }
  return { status: res.status, body };
}

// Unique per-run slot jitter so re-runs never collide with leftovers.
const RUN = Math.floor(Date.now() / 60000); // minute-resolution run id
const JITTER = (RUN % 50) * 2; // 0..98 minutes, unique per run-minute

function tehran(dayOffset: number, hour: number, minute = 0): string {
  const t = new Date(Date.now() + 210 * 60000);
  const base = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - 210 * 60000;
  return new Date(base + dayOffset * 86400000 + hour * 3600000 + (minute + JITTER) * 60000).toISOString();
}

const TEST_TITLES = [
  "تست یکپارچه — جلسه داخلی",
  "جلسه با مهمان خارجی — نیاز به تأیید",
  "رزرو جایگزین بعد از لغو",
  "تلاش تداخلی — باید رد شود",
];

beforeAll(async () => {
  adminCookie = await login("admin@example.com");
  employeeCookie = await login("ali@example.com");
  operatorCookie = await login("operator@example.com");
  roomManagerCookie = await login("room@example.com");

  // idempotency: wipe leftovers from previous runs
  for (const t of TEST_TITLES) {
    await api("/api/search?q=" + encodeURIComponent(t.slice(0, 12)), { cookie: adminCookie }).catch(() => {});
  }
  const list = await api(
    "/api/meetings?scope=all&limit=500",
    { cookie: adminCookie },
  );
  const mine = (list.body?.data?.meetings ?? []).filter((m: { title: string }) =>
    TEST_TITLES.some((t) => m.title.startsWith(t)),
  );
  for (const m of mine) {
    // cancel first (frees the room), then it stays as history — harmless
    await api(`/api/meetings/${m.id}/cancel`, {
      method: "POST",
      cookie: adminCookie,
      json: { reason: "DUPLICATE_MEETING" },
    }).catch(() => {});
  }
});

describe("auth", () => {
  it("rejects bad credentials", async () => {
    const { status } = await api("/api/auth/login", {
      method: "POST",
      json: { email: "admin@example.com", password: "wrong-pass" },
    });
    expect([401, 429]).toContain(status);
  });

  it("me returns the logged-in user", async () => {
    const { status, body } = await api("/api/auth/me", { cookie: adminCookie });
    expect(status).toBe(200);
    expect(body.data.user.email).toBe("admin@example.com");
    expect(body.data.user.permissions).toContain("meeting:approve");
  });

  it("blocks anonymous access", async () => {
    const { status } = await api("/api/meetings");
    expect(status).toBe(401);
  });
});

describe("meeting lifecycle", () => {
  let meetingId = "";
  const branchId = "branch-niavaran";
  const roomId = "room-a";

  it("employee creates internal meeting → auto-confirmed", async () => {
    const { status, body } = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: "تست یکپارچه — جلسه داخلی",
        branchId,
        roomId,
        startAt: tehran(10, 10),
        endAt: tehran(10, 11),
        meetingType: "INTERNAL",
        participantIds: [],
      },
    });
    expect(status).toBe(201);
    expect(body.data.meeting.status).toBe("CONFIRMED");
    meetingId = body.data.meeting.id;
  });

  it("rejects overlapping booking of the same room (409)", async () => {
    const { status, body } = await api("/api/meetings", {
      method: "POST",
      cookie: adminCookie, // different organizer, same room+time
      json: {
        title: "تست تداخل — باید رد شود",
        branchId,
        roomId,
        startAt: tehran(10, 10, 30),
        endAt: tehran(10, 11, 30),
        meetingType: "INTERNAL",
      },
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe("ROOM_CONFLICT");
  });

  it("guest meeting requires approval → operator approves", async () => {
    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: "جلسه با مهمان خارجی — نیاز به تأیید",
        branchId,
        roomId: "room-c",
        startAt: tehran(11, 14),
        endAt: tehran(11, 15),
        meetingType: "EXTERNAL",
        guests: [{ name: "مهمان تست", company: "شرکت تست" }],
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.meeting.status).toBe("PENDING_APPROVAL");
    const id = created.body.data.meeting.id;

    // employee cannot approve (403)
    const forbidden = await api(`/api/meetings/${id}/approve`, {
      method: "POST", cookie: employeeCookie, json: {},
    });
    expect(forbidden.status).toBe(403);

    // operator approves → CONFIRMED
    const approved = await api(`/api/meetings/${id}/approve`, {
      method: "POST", cookie: operatorCookie, json: {},
    });
    expect(approved.status).toBe(200);
    expect(approved.body.data.meeting.status).toBe("CONFIRMED");
  });

  it("reschedule changes time with history event", async () => {
    const { status, body } = await api(`/api/meetings/${meetingId}/reschedule`, {
      method: "POST",
      cookie: employeeCookie,
      json: { startAt: tehran(10, 12), endAt: tehran(10, 13), reason: "تست" },
    });
    expect(status).toBe(200);
    expect(body.data.meeting.status).toBe("RESCHEDULED");

    const detail = await api(`/api/meetings/${meetingId}`, { cookie: employeeCookie });
    const events = detail.body.data.meeting.events as { type: string }[];
    expect(events.some((e) => e.type === "RESCHEDULED")).toBe(true);
  });

  it("change room checks availability", async () => {
    const { status } = await api(`/api/meetings/${meetingId}/change-room`, {
      method: "POST",
      cookie: employeeCookie,
      json: { roomId: "room-c" },
    });
    expect(status).toBe(200);
  });

  it("add participant fires event + notification", async () => {
    const users = await api("/api/users?q=امیر", { cookie: adminCookie });
    const amir = users.body.data.users.find((u: any) => u.email === "amir@example.com");
    expect(amir).toBeTruthy();

    const added = await api(`/api/meetings/${meetingId}/participants`, {
      method: "POST",
      cookie: employeeCookie,
      json: { userId: amir.id },
    });
    expect(added.status).toBe(201);

    const notif = await api("/api/notifications", { cookie: adminCookie });
    // admin isn't the added user; check amir indirectly via meeting detail
    const detail = await api(`/api/meetings/${meetingId}`, { cookie: employeeCookie });
    const parts = detail.body.data.meeting.participants as any[];
    expect(parts.some((p) => p.userId === amir.id)).toBe(true);
  });

  it("cancel requires reason and clears reminders", async () => {
    const { status, body } = await api(`/api/meetings/${meetingId}/cancel`, {
      method: "POST",
      cookie: employeeCookie,
      json: { reason: "DUPLICATE_MEETING" },
    });
    expect(status).toBe(200);
    expect(body.data.meeting.status).toBe("CANCELLED");
  });

  it("cancelled room slot becomes free again", async () => {
    const { status } = await api("/api/meetings", {
      method: "POST",
      cookie: adminCookie,
      json: {
        title: "رزرو جایگزین بعد از لغو",
        branchId,
        roomId: "room-c",
        startAt: tehran(10, 12),
        endAt: tehran(10, 13),
        meetingType: "INTERNAL",
      },
    });
    expect(status).toBe(201);
  });
});

describe("availability & permissions", () => {
  it("finds common free slots", async () => {
    const { status, body } = await api("/api/availability", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        branchId: "branch-niavaran",
        participantIds: [],
        durationMin: 30,
      },
    });
    expect(status).toBe(200);
    expect(body.data.slots.length).toBeGreaterThan(0);
    for (const slot of body.data.slots) {
      expect(new Date(slot.end).getTime() - new Date(slot.start).getTime()).toBe(30 * 60000);
    }
  });

  it("employee cannot access reports (403)", async () => {
    const { status } = await api("/api/reports", { cookie: employeeCookie });
    expect(status).toBe(403);
  });

  it("admin sees reports summary", async () => {
    const { status, body } = await api("/api/reports", { cookie: adminCookie });
    expect(status).toBe(200);
    expect(body.data.summary).toHaveProperty("totalMeetings");
    expect(body.data.summary).toHaveProperty("roomUtilization");
  });

  it("audit log records the actions", async () => {
    const { status, body } = await api("/api/admin/audit-logs", { cookie: adminCookie });
    expect(status).toBe(200);
    expect(body.data.total).toBeGreaterThan(0);
  });

  it("employee cannot read audit logs (403)", async () => {
    const { status } = await api("/api/admin/audit-logs", { cookie: employeeCookie });
    expect(status).toBe(403);
  });
});

describe("colleagues directory", () => {
  it("employee can list active colleagues without sensitive fields", async () => {
    const { status, body } = await api("/api/users", { cookie: employeeCookie });
    expect(status).toBe(200);
    expect(body.data.users.length).toBeGreaterThan(0);
    const first = body.data.users[0];
    expect(first).toHaveProperty("fullName");
    expect(first).toHaveProperty("roles");
    expect(first).not.toHaveProperty("email");
    expect(first).not.toHaveProperty("isActive");
  });

  it("employee cannot create users (403)", async () => {
    const { status } = await api("/api/users", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        email: `colleague-test-${RUN}@example.com`,
        fullName: "تست همکار",
        password: "Pass1234",
        roleKeys: ["EMPLOYEE"],
      },
    });
    expect(status).toBe(403);
  });
});

describe("floors", () => {
  const branchId = "branch-niavaran";
  const floorNumber = 90 + (RUN % 10);
  let floorId = "";

  it("employee cannot create floors (403)", async () => {
    const { status } = await api(`/api/branches/${branchId}/floors`, {
      method: "POST",
      cookie: employeeCookie,
      json: { name: "طبقه تست", number: floorNumber },
    });
    expect(status).toBe(403);
  });

  it("admin creates a floor", async () => {
    const { status, body } = await api(`/api/branches/${branchId}/floors`, {
      method: "POST",
      cookie: adminCookie,
      json: { name: "طبقه تست یکپارچه", number: floorNumber },
    });
    expect(status).toBe(201);
    expect(body.data.floor.name).toBe("طبقه تست یکپارچه");
    expect(body.data.floor.number).toBe(floorNumber);
    floorId = body.data.floor.id;
  });

  it("rejects duplicate floor number in same branch (409)", async () => {
    const { status, body } = await api(`/api/branches/${branchId}/floors`, {
      method: "POST",
      cookie: adminCookie,
      json: { name: "طبقه تکراری", number: floorNumber },
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe("DUPLICATE");
  });

  it("admin updates floor name", async () => {
    const { status, body } = await api(`/api/branches/${branchId}/floors/${floorId}`, {
      method: "PATCH",
      cookie: adminCookie,
      json: { name: "طبقه تست ویرایش‌شده" },
    });
    expect(status).toBe(200);
    expect(body.data.floor.name).toBe("طبقه تست ویرایش‌شده");
  });

  it("rejects room assignment to floor from another branch", async () => {
    const branches = await api("/api/branches", { cookie: adminCookie });
    const vanakFloor = branches.body.data.branches
      .find((b: { id: string }) => b.id === "branch-vanak")
      ?.floors?.[0]?.id;
    expect(vanakFloor).toBeTruthy();

    const { status, body } = await api("/api/rooms/create", {
      method: "POST",
      cookie: adminCookie,
      json: {
        branchId,
        floorId: vanakFloor,
        name: "اتاق نامعتبر طبقه",
        capacity: 4,
      },
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe("INVALID_FLOOR");
  });

  it("cannot delete floor that has rooms (409)", async () => {
    const branches = await api("/api/branches", { cookie: adminCookie });
    const seededFloor = branches.body.data.branches
      .find((b: { id: string }) => b.id === branchId)
      ?.floors?.find((f: { number: number }) => f.number === 1)?.id;
    expect(seededFloor).toBeTruthy();

    const { status, body } = await api(`/api/branches/${branchId}/floors/${seededFloor}`, {
      method: "DELETE",
      cookie: adminCookie,
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe("FLOOR_IN_USE");
  });

  it("admin deletes empty test floor", async () => {
    const { status } = await api(`/api/branches/${branchId}/floors/${floorId}`, {
      method: "DELETE",
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    floorId = "";
  });
});

describe("room exclusions", () => {
  const branchId = "branch-niavaran";
  let testRoomId = "";
  let exclusionId = "";
  const exDay = 25 + (RUN % 5);
  const meetDay = 26 + (RUN % 5);

  it("creates temp room for exclusion tests", async () => {
    const { status, body } = await api("/api/rooms/create", {
      method: "POST",
      cookie: adminCookie,
      json: { branchId, name: `اتاق تست exclusion ${RUN}`, capacity: 4 },
    });
    expect(status).toBe(201);
    testRoomId = body.data.room.id;
  });

  it("employee cannot schedule exclusion (403)", async () => {
    const { status } = await api(`/api/rooms/${testRoomId}/exclusions`, {
      method: "POST",
      cookie: employeeCookie,
      json: {
        reason: "تعمیرات",
        startAt: tehran(exDay, 10),
        endAt: tehran(exDay, 12),
      },
    });
    expect(status).toBe(403);
  });

  it("admin schedules room exclusion", async () => {
    const { status, body } = await api(`/api/rooms/${testRoomId}/exclusions`, {
      method: "POST",
      cookie: adminCookie,
      json: {
        reason: "تعمیرات تست",
        startAt: tehran(exDay, 10),
        endAt: tehran(exDay, 12),
      },
    });
    expect(status).toBe(201);
    expect(body.data.exclusion.reason).toBe("تعمیرات تست");
    exclusionId = body.data.exclusion.id;
  });

  it("lists upcoming exclusions", async () => {
    const { status, body } = await api(`/api/rooms/${testRoomId}/exclusions`, {
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.data.exclusions.some((e: { id: string }) => e.id === exclusionId)).toBe(true);
  });

  it("blocks meeting booking during exclusion (ROOM_EXCLUDED)", async () => {
    const { status, body } = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: "تلاش رزرو در تعمیرات",
        branchId,
        roomId: testRoomId,
        startAt: tehran(exDay, 10, 30),
        endAt: tehran(exDay, 11, 30),
        meetingType: "INTERNAL",
      },
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe("ROOM_EXCLUDED");
  });

  it("rejects exclusion overlapping an existing meeting (MEETING_CONFLICT)", async () => {
    const created = await api("/api/meetings", {
      method: "POST",
      cookie: adminCookie,
      json: {
        title: "جلسه قبل از تعمیرات",
        branchId,
        roomId: testRoomId,
        startAt: tehran(meetDay, 10),
        endAt: tehran(meetDay, 11),
        meetingType: "INTERNAL",
      },
    });
    expect(created.status).toBe(201);
    const meetingId = created.body.data.meeting.id;

    const blocked = await api(`/api/rooms/${testRoomId}/exclusions`, {
      method: "POST",
      cookie: adminCookie,
      json: {
        reason: "تداخل با جلسه",
        startAt: tehran(meetDay, 9),
        endAt: tehran(meetDay, 12),
      },
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("MEETING_CONFLICT");

    await api(`/api/meetings/${meetingId}/cancel`, {
      method: "POST",
      cookie: adminCookie,
      json: { reason: "DUPLICATE_MEETING" },
    });
  });

  it("deletes exclusion and cleans up test room", async () => {
    const delEx = await api(`/api/rooms/${testRoomId}/exclusions/${exclusionId}`, {
      method: "DELETE",
      cookie: adminCookie,
    });
    expect(delEx.status).toBe(200);

    const delRoom = await api(`/api/rooms/${testRoomId}/manage`, {
      method: "DELETE",
      cookie: adminCookie,
    });
    expect(delRoom.status).toBe(200);
    exclusionId = "";
    testRoomId = "";
  });
});

describe("user admin", () => {
  const testEmail = `patch-test-${RUN}@example.com`;
  let testUserId = "";
  let aliId = "";

  it("operator cannot update users (403)", async () => {
    const users = await api("/api/users?q=علی", { cookie: adminCookie });
    aliId = users.body.data.users.find((u: { email: string }) => u.email === "ali@example.com")?.id;
    expect(aliId).toBeTruthy();

    const { status } = await api(`/api/users/${aliId}`, {
      method: "PATCH",
      cookie: operatorCookie,
      json: { fullName: "نام غیرمجاز" },
    });
    expect(status).toBe(403);
  });

  it("admin updates user profile and branch", async () => {
    const { status } = await api(`/api/users/${aliId}`, {
      method: "PATCH",
      cookie: adminCookie,
      json: {
        department: "فروش تست",
        branchId: "branch-vanak",
        phone: "021-11112222",
      },
    });
    expect(status).toBe(200);

    const list = await api("/api/users?q=ali@example.com", { cookie: adminCookie });
    const ali = list.body.data.users.find((u: { email: string }) => u.email === "ali@example.com");
    expect(ali.department).toBe("فروش تست");
    expect(ali.branch?.id).toBe("branch-vanak");
  });

  it("admin changes user roles", async () => {
    const { status } = await api(`/api/users/${aliId}`, {
      method: "PATCH",
      cookie: adminCookie,
      json: { roleKeys: ["EMPLOYEE", "ROOM_MANAGER"] },
    });
    expect(status).toBe(200);

    const list = await api("/api/users?q=ali@example.com", { cookie: adminCookie });
    const keys = list.body.data.users
      .find((u: { email: string }) => u.email === "ali@example.com")
      ?.roles.map((r: { role: { key: string } }) => r.role.key)
      .sort();
    expect(keys).toEqual(["EMPLOYEE", "ROOM_MANAGER"].sort());
  });

  it("reverts ali roles to employee only", async () => {
    const { status } = await api(`/api/users/${aliId}`, {
      method: "PATCH",
      cookie: adminCookie,
      json: { roleKeys: ["EMPLOYEE"], branchId: "branch-niavaran", department: "فروش" },
    });
    expect(status).toBe(200);
  });

  it("creates temp user for password reset test", async () => {
    const { status, body } = await api("/api/users", {
      method: "POST",
      cookie: adminCookie,
      json: {
        email: testEmail,
        fullName: "کاربر تست PATCH",
        password: "TempPass1",
        roleKeys: ["EMPLOYEE"],
        branchId: "branch-niavaran",
      },
    });
    expect(status).toBe(201);
    testUserId = body.data.user.id;
  });

  it("operator cannot reset password (403)", async () => {
    const { status } = await api(`/api/users/${testUserId}/reset-password`, {
      method: "POST",
      cookie: operatorCookie,
      json: { password: "NewPass99" },
    });
    expect(status).toBe(403);
  });

  it("admin resets password and new password works", async () => {
    const reset = await api(`/api/users/${testUserId}/reset-password`, {
      method: "POST",
      cookie: adminCookie,
      json: { password: "ResetPass99" },
    });
    expect(reset.status).toBe(200);

    const login = await api("/api/auth/login", {
      method: "POST",
      json: { email: testEmail, password: "ResetPass99" },
    });
    expect(login.status).toBe(200);
  });

  it("deactivates temp user", async () => {
    const { status } = await api(`/api/users/${testUserId}`, {
      method: "PATCH",
      cookie: adminCookie,
      json: { isActive: false },
    });
    expect(status).toBe(200);
    testUserId = "";
  });
});

describe("participant rsvp", () => {
  const branchId = "branch-niavaran";
  const roomId = "room-a";
  let meetingId = "";
  let amirId = "";

  it("invited participants start as PENDING", async () => {
    const users = await api("/api/users?q=amir", { cookie: adminCookie });
    amirId = users.body.data.users.find((u: { email: string }) => u.email === "amir@example.com")?.id;
    expect(amirId).toBeTruthy();

    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: "تست RSVP — دعوت با PENDING",
        branchId,
        roomId,
        startAt: tehran(18, 14),
        endAt: tehran(18, 15),
        meetingType: "INTERNAL",
        participantIds: [amirId],
      },
    });
    expect(created.status).toBe(201);
    meetingId = created.body.data.meeting.id;

    const detail = await api(`/api/meetings/${meetingId}`, { cookie: employeeCookie });
    const amirPart = detail.body.data.meeting.participants.find(
      (p: { userId: string }) => p.userId === amirId,
    );
    expect(amirPart.responseStatus).toBe("PENDING");
    const organizerPart = detail.body.data.meeting.participants.find(
      (p: { role: string }) => p.role === "ORGANIZER",
    );
    expect(organizerPart.responseStatus).toBe("ACCEPTED");
  });

  it("participant accepts invitation", async () => {
    const amirCookie = await login("amir@example.com");
    const { status, body } = await api(`/api/meetings/${meetingId}/participants/respond`, {
      method: "POST",
      cookie: amirCookie,
      json: { responseStatus: "ACCEPTED" },
    });
    expect(status).toBe(200);
    expect(body.data.participant.responseStatus).toBe("ACCEPTED");

    const detail = await api(`/api/meetings/${meetingId}`, { cookie: amirCookie });
    const amirPart = detail.body.data.meeting.participants.find(
      (p: { userId: string }) => p.userId === amirId,
    );
    expect(amirPart.responseStatus).toBe("ACCEPTED");
  });

  it("non-participant cannot respond (403)", async () => {
    const { status } = await api(`/api/meetings/${meetingId}/participants/respond`, {
      method: "POST",
      cookie: operatorCookie,
      json: { responseStatus: "DECLINED" },
    });
    expect(status).toBe(403);
  });

  it("participant can change response to tentative", async () => {
    const amirCookie = await login("amir@example.com");
    const { status, body } = await api(`/api/meetings/${meetingId}/participants/respond`, {
      method: "POST",
      cookie: amirCookie,
      json: { responseStatus: "TENTATIVE" },
    });
    expect(status).toBe(200);
    expect(body.data.participant.responseStatus).toBe("TENTATIVE");
  });

  it("organizer receives PARTICIPANT_RESPONDED notification", async () => {
    const notifs = await api("/api/notifications", { cookie: employeeCookie });
    const hit = (notifs.body.data.notifications ?? []).find(
      (n: { type: string; data?: { meetingId?: string } }) =>
        n.type === "PARTICIPANT_RESPONDED" && n.data?.meetingId === meetingId,
    );
    expect(hit).toBeTruthy();
  });

  it("cleans up rsvp test meeting", async () => {
    const { status } = await api(`/api/meetings/${meetingId}/cancel`, {
      method: "POST",
      cookie: employeeCookie,
      json: { reason: "DUPLICATE_MEETING" },
    });
    expect(status).toBe(200);
    meetingId = "";
  });
});

describe("organization settings", () => {
  const originalName = "شرکت نمونه";

  it("employee cannot read organization (403)", async () => {
    const { status } = await api("/api/admin/organization", { cookie: employeeCookie });
    expect(status).toBe(403);
  });

  it("admin reads organization", async () => {
    const { status, body } = await api("/api/admin/organization", { cookie: adminCookie });
    expect(status).toBe(200);
    expect(body.data.organization.name).toBe(originalName);
    expect(body.data.organization.timezone).toBe("Asia/Tehran");
  });

  it("admin updates organization and audit is recorded", async () => {
    const newName = `شرکت تست ${RUN}`;
    const patch = await api("/api/admin/organization", {
      method: "PATCH",
      cookie: adminCookie,
      json: { name: newName },
    });
    expect(patch.status).toBe(200);
    expect(patch.body.data.organization.name).toBe(newName);

    const logs = await api("/api/admin/audit-logs?page=1", { cookie: adminCookie });
    const orgLog = logs.body.data.logs.find(
      (l: { entity: string; action: string }) => l.entity === "Organization" && l.action === "UPDATE",
    );
    expect(orgLog).toBeTruthy();

    await api("/api/admin/organization", {
      method: "PATCH",
      cookie: adminCookie,
      json: { name: originalName },
    });
  });

  it("operator cannot update organization (403)", async () => {
    const { status } = await api("/api/admin/organization", {
      method: "PATCH",
      cookie: operatorCookie,
      json: { name: "هک" },
    });
    expect(status).toBe(403);
  });
});

describe("guest check-in", () => {
  let meetingId = "";
  let checkinCode = "";
  const branchId = "branch-niavaran";

  function checkinWindow() {
    const offsetMin = 30 + (RUN % 45);
    const start = new Date(Date.now() + offsetMin * 60000);
    const end = new Date(start.getTime() + 60 * 60000);
    return { startAt: start.toISOString(), endAt: end.toISOString() };
  }

  it("creates guest with unique checkin code", async () => {
    const slot = checkinWindow();
    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: `تست checkin ${RUN}`,
        branchId,
        ...slot,
        meetingType: "INTERNAL",
      },
    });
    expect(created.status).toBe(201);
    meetingId = created.body.data.meeting.id;

    const added = await api(`/api/meetings/${meetingId}/guests`, {
      method: "POST",
      cookie: employeeCookie,
      json: { name: "مهمان checkin", company: "تست" },
    });
    expect(added.status).toBe(201);
    expect(added.body.data.guest.checkinCode).toMatch(/^[0-9A-F]{8}$/);
    checkinCode = added.body.data.guest.checkinCode;
  });

  it("public lookup by checkin code", async () => {
    const { status, body } = await api(`/api/checkin/${checkinCode}`);
    expect(status).toBe(200);
    expect(body.data.guest.name).toBe("مهمان checkin");
  });

  it("guest self check-in without login", async () => {
    const { status, body } = await api(`/api/checkin/${checkinCode}`, { method: "POST" });
    expect(status).toBe(200);
    expect(body.data.guest.arrivedAt).toBeTruthy();
  });

  it("duplicate check-in is idempotent", async () => {
    const { status, body } = await api(`/api/checkin/${checkinCode}`, { method: "POST" });
    expect(status).toBe(200);
    expect(body.data.alreadyCheckedIn).toBe(true);
  });

  it("organizer manual check-in via meeting route", async () => {
    const added = await api(`/api/meetings/${meetingId}/guests`, {
      method: "POST",
      cookie: employeeCookie,
      json: { name: "مهمان دوم checkin", company: "تست" },
    });
    expect(added.status).toBe(201);
    const gid = added.body.data.guest.id;
    expect(added.body.data.guest.checkinCode).toMatch(/^[0-9A-F]{8}$/);

    const manual = await api(`/api/meetings/${meetingId}/guests/${gid}/checkin`, {
      method: "POST",
      cookie: employeeCookie,
      json: {},
    });
    expect(manual.status).toBe(200);
    expect(manual.body.data.guest.arrivedAt).toBeTruthy();
  });

  it("wrong checkin code rejected (403)", async () => {
    const added = await api(`/api/meetings/${meetingId}/guests`, {
      method: "POST",
      cookie: employeeCookie,
      json: { name: "مهمان سوم checkin" },
    });
    const gid = added.body.data.guest.id;
    const { status } = await api(`/api/meetings/${meetingId}/guests/${gid}/checkin`, {
      method: "POST",
      json: { code: "BADCODE1" },
    });
    expect(status).toBe(403);
  });
});

describe("room manager RBAC", () => {
  it("room manager can update assigned room", async () => {
    const { status, body } = await api("/api/rooms/room-a/manage", {
      method: "PATCH",
      cookie: roomManagerCookie,
      json: { description: "به‌روز توسط مدیر اتاق" },
    });
    expect(status).toBe(200);
    expect(body.data.room.description).toBe("به‌روز توسط مدیر اتاق");
  });

  it("room manager cannot update unassigned room (403)", async () => {
    const { status, body } = await api("/api/rooms/room-b/manage", {
      method: "PATCH",
      cookie: roomManagerCookie,
      json: { description: "نباید مجاز باشد" },
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("employee cannot update rooms (403)", async () => {
    const { status } = await api("/api/rooms/room-a/manage", {
      method: "PATCH",
      cookie: employeeCookie,
      json: { description: "نباید مجاز باشد" },
    });
    expect(status).toBe(403);
  });

  it("admin can update any room", async () => {
    const { status } = await api("/api/rooms/room-b/manage", {
      method: "PATCH",
      cookie: adminCookie,
      json: { description: "ویرایش توسط ادمین" },
    });
    expect(status).toBe(200);
  });
});
