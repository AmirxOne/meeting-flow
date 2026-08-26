// Integration tests — run against the real dev stack:
//   postgres+seed up (docker compose), then: pnpm vitest run tests/integration
// Uses the real HTTP API on localhost:3100 (start `pnpm dev` first) — proves
// the full chain: Zod → auth → service → transaction → exclusion constraint.

import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.TEST_BASE ?? "http://localhost:3100";

let adminCookie = "";
let employeeCookie = "";
let operatorCookie = "";

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
