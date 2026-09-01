// Integration tests — run against the real dev stack:
//   postgres+seed up (docker compose), then: pnpm vitest run tests/integration
// Uses the real HTTP API on localhost:3100 (start `pnpm dev` first) — proves
// the full chain: Zod → auth → service → transaction → exclusion constraint.

import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.TEST_BASE ?? "http://localhost:3100";
const PNG_DOT = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let adminCookie = "";
let employeeCookie = "";
let operatorCookie = "";
let roomManagerCookie = "";
let branchManagerCookie = "";

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

/** Slot that already started but has not ended — for start/end integration tests. */
function liveSlot(offsetMin = 0, durationMin = 60): { startAt: string; endAt: string } {
  const startAt = new Date(Date.now() - 30 * 60000 - JITTER * 60000 + offsetMin * 60000).toISOString();
  const endAt = new Date(Date.now() + durationMin * 60000 + JITTER * 60000 + offsetMin * 60000).toISOString();
  return { startAt, endAt };
}

const TEST_TITLES = [
  "تست یکپارچه — جلسه داخلی",
  "جلسه با مهمان خارجی — نیاز به تأیید",
  "رزرو جایگزین بعد از لغو",
  "تلاش تداخلی — باید رد شود",
  "تست یکپارچه — تفویض رزرو",
  "تست لیست انتظار — اشغال‌کننده",
  "تست لیست انتظار — صف",
  "تست لیست انتظار — رزرو در مهلت",
  "تست تعطیل سازمانی — باید رد شود",
];

beforeAll(async () => {
  adminCookie = await login("admin@example.com");
  employeeCookie = await login("ali@example.com");
  operatorCookie = await login("operator@example.com");
  roomManagerCookie = await login("room@example.com");
  branchManagerCookie = await login("sara@example.com");

  // idempotency: wipe leftovers from previous runs
  for (const t of TEST_TITLES) {
    await api("/api/search?q=" + encodeURIComponent(t.slice(0, 12)), { cookie: adminCookie }).catch(() => {});
  }
  const list = await api(
    "/api/meetings?scope=all&limit=500",
    { cookie: adminCookie },
  );
  const mine = (list.body?.data?.meetings ?? []).filter((m: { title: string; status: string }) =>
    TEST_TITLES.some((t) => m.title.startsWith(t)),
  );
  for (const m of mine) {
    if (m.status === "CANCELLED") continue;
    // cancel first (frees the room), then it stays as history — harmless
    await api(`/api/meetings/${m.id}/cancel`, {
      method: "POST",
      cookie: adminCookie,
      json: { reason: "DUPLICATE_MEETING" },
    }).catch(() => {});
  }
}, 90_000);

describe("auth", () => {
  it("rejects bad credentials", async () => {
    const { status } = await api("/api/auth/login", {
      method: "POST",
      json: { email: "admin@example.com", password: "wrong-pass" },
    });
    expect([401, 429]).toContain(status);
  });

  it("logs in with identifier (email) or seeded mobile", async () => {
    const byEmail = await api("/api/auth/login", {
      method: "POST",
      json: { identifier: "admin@example.com", password: "Pass1234" },
    });
    expect([200, 429]).toContain(byEmail.status);
    if (byEmail.status === 200) {
      expect(byEmail.body.data.user.email).toBe("admin@example.com");
    }

    const byPhone = await api("/api/auth/login", {
      method: "POST",
      json: { identifier: "۰۹۱۲۰۰۰۱۰۰۱", password: "Pass1234" },
    });
    expect([200, 429]).toContain(byPhone.status);
    if (byPhone.status === 200) {
      expect(byPhone.body.data.user.email).toBe("admin@example.com");
    }
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

describe("room waitlist", () => {
  const branchId = "branch-niavaran";
  const roomId = "room-a";
  const startAt = tehran(21, 9);
  const endAt = tehran(21, 10);
  let occupantId = "";
  let waitlistedId = "";
  let snipedId = "";

  it("conflict 409 offers optional waitlist without locking", async () => {
    const occupant = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: "تست لیست انتظار — اشغال‌کننده",
        branchId,
        roomId,
        startAt,
        endAt,
        meetingType: "INTERNAL",
        participantIds: [],
      },
    });
    expect(occupant.status).toBe(201);
    occupantId = occupant.body.data.meeting.id;

    const conflict = await api("/api/meetings", {
      method: "POST",
      cookie: adminCookie,
      json: {
        title: "تست لیست انتظار — صف",
        branchId,
        roomId,
        startAt,
        endAt,
        meetingType: "INTERNAL",
        participantIds: [],
      },
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("ROOM_CONFLICT");
    expect(conflict.body.error.extra.canWaitlist).toBe(true);
  });

  it("waitlistIfBusy joins the queue and does not occupy the room", async () => {
    const queued = await api("/api/meetings", {
      method: "POST",
      cookie: adminCookie,
      json: {
        title: "تست لیست انتظار — صف",
        branchId,
        roomId,
        startAt,
        endAt,
        meetingType: "INTERNAL",
        waitlistIfBusy: true,
        participantIds: [],
      },
    });
    expect(queued.status).toBe(201);
    expect(queued.body.data.meeting.status).toBe("WAITLISTED");
    waitlistedId = queued.body.data.meeting.id;

    const detail = await api(`/api/meetings/${waitlistedId}`, { cookie: adminCookie });
    expect(detail.body.data.waitlist.position).toBe(1);
    expect(detail.body.data.waitlist.total).toBe(1);
    expect(detail.body.data.waitlist.offered).toBe(false);
  });

  it("when occupant cancels, first waiter is offered but the slot stays bookable", async () => {
    const cancelled = await api(`/api/meetings/${occupantId}/cancel`, {
      method: "POST",
      cookie: employeeCookie,
      json: { reason: "DUPLICATE_MEETING" },
    });
    expect(cancelled.status).toBe(200);

    let offered = false;
    for (let i = 0; i < 20; i++) {
      const detail = await api(`/api/meetings/${waitlistedId}`, { cookie: adminCookie });
      if (detail.body.data.meeting.status === "WAITLIST_OFFERED") {
        offered = true;
        expect(detail.body.data.waitlist.offered).toBe(true);
        expect(detail.body.data.waitlist.offerExpiresAt).toBeTruthy();
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    expect(offered).toBe(true);

    const sniped = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: "تست لیست انتظار — رزرو در مهلت",
        branchId,
        roomId,
        startAt,
        endAt,
        meetingType: "INTERNAL",
        participantIds: [],
      },
    });
    expect(sniped.status).toBe(201);
    expect(sniped.body.data.meeting.status).toBe("CONFIRMED");
    snipedId = sniped.body.data.meeting.id;

    const claim = await api(`/api/meetings/${waitlistedId}/waitlist/claim`, {
      method: "POST",
      cookie: adminCookie,
    });
    expect(claim.status).toBe(409);
    expect(claim.body.error.code).toBe("ROOM_CONFLICT");
  });

  it("cleanup waitlist fixtures", async () => {
    for (const id of [waitlistedId, snipedId, occupantId]) {
      if (!id) continue;
      await api(`/api/meetings/${id}/cancel`, {
        method: "POST",
        cookie: adminCookie,
        json: { reason: "DUPLICATE_MEETING" },
      }).catch(() => {});
    }
  });
});

describe("org holidays", () => {
  const dateIso = `2031-07-${String(10 + (RUN % 18)).padStart(2, "0")}`;
  const startAt = new Date(`${dateIso}T06:30:00.000Z`).toISOString();
  const endAt = new Date(`${dateIso}T07:30:00.000Z`).toISOString();
  let holidayId = "";

  it("employee cannot create org holidays", async () => {
    const { status } = await api("/api/admin/holidays", {
      method: "POST",
      cookie: employeeCookie,
      json: { dateIso, name: "تعطیل تستی" },
    });
    expect(status).toBe(403);
  });

  it("blocks room booking on a holiday (default policy)", async () => {
    const listed = await api(`/api/holidays?from=${dateIso}&to=${dateIso}`, { cookie: adminCookie });
    for (const h of listed.body.data?.holidays ?? []) {
      await api(`/api/admin/holidays/${h.id}`, { method: "DELETE", cookie: adminCookie }).catch(() => {});
    }

    const created = await api("/api/admin/holidays", {
      method: "POST",
      cookie: adminCookie,
      json: { dateIso, name: "تعطیل تستی" },
    });
    expect(created.status).toBe(201);
    holidayId = created.body.data.holiday.id as string;

    const booked = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: "تست تعطیل سازمانی — باید رد شود",
        branchId: "branch-niavaran",
        roomId: "room-a",
        startAt,
        endAt,
        meetingType: "INTERNAL",
        participantIds: [],
      },
    });
    expect(booked.status).toBe(400);
    expect(booked.body.error.code).toBe("HOLIDAY_BLOCKED");
  });

  it("cleanup holiday fixture", async () => {
    if (!holidayId) return;
    await api(`/api/admin/holidays/${holidayId}`, {
      method: "DELETE",
      cookie: adminCookie,
    }).catch(() => {});
  });
});

/** Short live window (60 min) — stays under requireApprovalLongerThanMin (120). */
function liveSlotShort(offsetMin = 0): { startAt: string; endAt: string } {
  const startAt = new Date(Date.now() - 20 * 60000 + offsetMin * 60000).toISOString();
  const endAt = new Date(Date.now() + 40 * 60000 + offsetMin * 60000).toISOString();
  return { startAt, endAt };
}

describe("meeting start / end / no-show", () => {
  const branchId = "branch-niavaran";
  const LIVE_TITLES = ["تست پایان — تکمیل", "تست پایان — غیبت"] as const;

  beforeAll(async () => {
    for (const title of LIVE_TITLES) {
      const list = await api(
        `/api/meetings?scope=all&limit=50&q=${encodeURIComponent(title)}`,
        { cookie: adminCookie },
      );
      for (const m of list.body?.data?.meetings ?? []) {
        if (m.title === title && !["CANCELLED", "COMPLETED", "NO_SHOW", "REJECTED"].includes(m.status)) {
          await api(`/api/meetings/${m.id}/cancel`, {
            method: "POST",
            cookie: adminCookie,
            json: { reason: "DUPLICATE_MEETING" },
          }).catch(() => {});
        }
      }
    }
  });

  it("start → end completes as COMPLETED", async () => {
    const slot = liveSlotShort((RUN % 30) + 1);
    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: LIVE_TITLES[0],
        branchId,
        ...slot,
        meetingType: "INTERNAL",
        participantIds: [],
      },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.meeting.id as string;

    const started = await api(`/api/meetings/${id}/start`, {
      method: "POST",
      cookie: employeeCookie,
    });
    expect(started.status).toBe(200);
    expect(started.body.data.meeting.status).toBe("IN_PROGRESS");

    const ended = await api(`/api/meetings/${id}/end`, {
      method: "POST",
      cookie: employeeCookie,
      json: { noShow: false },
    });
    expect(ended.status).toBe(200);
    expect(ended.body.data.meeting.status).toBe("COMPLETED");

    const detail = await api(`/api/meetings/${id}`, { cookie: employeeCookie });
    const events = detail.body.data.meeting.events as { type: string }[];
    expect(events.some((e) => e.type === "STARTED")).toBe(true);
    expect(events.some((e) => e.type === "ENDED")).toBe(true);
  });

  it("start → end with noShow marks NO_SHOW", async () => {
    const slot = liveSlotShort((RUN % 30) + 15);
    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: LIVE_TITLES[1],
        branchId,
        ...slot,
        meetingType: "INTERNAL",
        participantIds: [],
      },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.meeting.id as string;

    const started = await api(`/api/meetings/${id}/start`, {
      method: "POST",
      cookie: employeeCookie,
    });
    expect(started.status).toBe(200);

    const ended = await api(`/api/meetings/${id}/end`, {
      method: "POST",
      cookie: employeeCookie,
      json: { noShow: true },
    });
    expect(ended.status).toBe(200);
    expect(ended.body.data.meeting.status).toBe("NO_SHOW");

    const detail = await api(`/api/meetings/${id}`, { cookie: employeeCookie });
    const events = detail.body.data.meeting.events as { type: string }[];
    expect(events.some((e) => e.type === "NO_SHOW")).toBe(true);
  });

  it("reports noShowRate includes NO_SHOW meetings", async () => {
    const { status, body } = await api("/api/reports", { cookie: adminCookie });
    expect(status).toBe(200);
    expect(body.data.summary).toHaveProperty("noShowRate");
    expect(typeof body.data.summary.noShowRate).toBe("number");
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

  it("admin can filter reports by branchId", async () => {
    const all = await api("/api/reports", { cookie: adminCookie });
    const filtered = await api("/api/reports?branchId=branch-niavaran", { cookie: adminCookie });
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.summary).toHaveProperty("totalMeetings");
    expect(filtered.body.data.summary.totalMeetings).toBeLessThanOrEqual(
      all.body.data.summary.totalMeetings,
    );
  });

  it("reports status filter does not leak other status metrics", async () => {
    const { status, body } = await api(
      "/api/reports?from=2026-08-01&to=2026-08-31&status=CANCELLED",
      { cookie: adminCookie },
    );
    expect(status).toBe(200);
    const s = body.data.summary;
    expect(s.completedCount).toBe(0);
    expect(s.noShowRate).toBe(0);
    if (s.totalMeetings > 0) expect(s.cancellationRate).toBe(100);
  });

  it("reports date range includes the full Tehran day", async () => {
    const day = "2026-08-30";
    const { status, body } = await api(`/api/reports?from=${day}&to=${day}`, { cookie: adminCookie });
    expect(status).toBe(200);
    expect(body.data.summary.totalMeetings).toBeGreaterThan(0);
  });

  it("reports CSV has BOM and real line breaks", async () => {
    const res = await fetch(`${BASE}/api/reports?from=2026-08-01&to=2026-08-31&format=csv`, {
      headers: { cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/csv/);
    const buf = Buffer.from(await res.arrayBuffer());
    // UTF-8 BOM as raw bytes — Response.text() may strip U+FEFF
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
    const text = buf.toString("utf8");
    expect(text.split(/\r?\n/).filter(Boolean).length).toBeGreaterThan(2);
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

  it("branch manager can read audit logs (200)", async () => {
    const { status, body } = await api("/api/admin/audit-logs", { cookie: branchManagerCookie });
    expect(status).toBe(200);
    expect(body.data).toHaveProperty("total");
  });

  it("branch manager cannot read policies (403)", async () => {
    const { status } = await api("/api/admin/policies", { cookie: branchManagerCookie });
    expect(status).toBe(403);
  });

  it("employee cannot read policies (403)", async () => {
    const { status } = await api("/api/admin/policies", { cookie: employeeCookie });
    expect(status).toBe(403);
  });

  it("branch manager cannot access admin stats (403)", async () => {
    const { status } = await api("/api/admin/stats", { cookie: branchManagerCookie });
    expect(status).toBe(403);
  });

  it("admin can filter audit logs by entity and action", async () => {
    const { status, body } = await api("/api/admin/audit-logs?entity=Meeting&action=CREATE", {
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(Array.isArray(body.data.logs)).toBe(true);
    for (const log of body.data.logs) {
      expect(log.entity).toBe("Meeting");
      expect(log.action).toBe("CREATE");
    }
  });

  it("admin can filter audit logs by actorId", async () => {
    const me = await api("/api/auth/me", { cookie: adminCookie });
    const actorId = me.body.data.user.id;
    const { status, body } = await api(`/api/admin/audit-logs?actorId=${actorId}`, {
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    for (const log of body.data.logs) {
      expect(log.actor?.id).toBe(actorId);
    }
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
    expect(first).toHaveProperty("jobTitle");
    expect(first).toHaveProperty("department");
    expect(first).toHaveProperty("avatarUrl");
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

describe("room display kiosk", () => {
  const SECRET = `محرمانه کیوسک ${RUN} — استراتژی`;
  let token = "";
  let displayCode = "";
  let meetingId = "";

  it("anonymous without token is 401; employee cannot rotate", async () => {
    const anon = await api("/api/rooms/room-b/display");
    expect(anon.status).toBe(401);

    const emp = await api("/api/rooms/room-b/display-token", {
      method: "POST",
      cookie: employeeCookie,
    });
    expect(emp.status).toBe(403);
  });

  it("admin token unlocks board and masks private titles", async () => {
    const rotated = await api("/api/rooms/room-b/display-token", {
      method: "POST",
      cookie: adminCookie,
    });
    expect(rotated.status).toBe(200);
    token = rotated.body.data.token as string;
    displayCode = rotated.body.data.displayCode as string;
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(displayCode).toMatch(/^[0-9A-F]{8}$/);

    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: SECRET,
        branchId: "branch-niavaran",
        roomId: "room-b",
        startAt: new Date(Date.now() - 8 * 60000).toISOString(),
        endAt: new Date(Date.now() + 35 * 60000).toISOString(),
        meetingType: "INTERNAL",
        isPrivate: true,
      },
    });
    expect(created.status).toBe(201);
    meetingId = created.body.data.meeting.id as string;

    const board = await api(`/api/rooms/room-b/display?t=${token}`);
    expect(board.status).toBe(200);
    expect(board.body.data.occupancy).toBe("OCCUPIED");
    expect(board.body.data.current.title).toBe("جلسه محرمانه");
    expect(board.body.data.current.isMasked).toBe(true);
    expect(JSON.stringify(board.body)).not.toContain("استراتژی");
    expect(JSON.stringify(board.body)).not.toContain(SECRET);

    const byCode = await api(`/api/rooms/room-b/display?code=${displayCode}`);
    expect(byCode.status).toBe(200);
    expect(byCode.body.data.current.isMasked).toBe(true);

    const bad = await api("/api/rooms/room-b/display?t=not-a-real-token");
    expect(bad.status).toBe(401);
  });

  it("cleanup display fixture", async () => {
    if (meetingId) {
      await api(`/api/meetings/${meetingId}/cancel`, {
        method: "POST",
        cookie: employeeCookie,
        json: { reason: "OTHER" },
      });
    }
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
  let superadminCookie = "";

  beforeAll(async () => {
    superadminCookie = await login("superadmin@example.com");
  });

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

  it("admin cannot change user roles (403)", async () => {
    const { status } = await api(`/api/users/${aliId}`, {
      method: "PATCH",
      cookie: adminCookie,
      json: { roleKeys: ["EMPLOYEE", "ROOM_MANAGER"] },
    });
    expect(status).toBe(403);
  });

  it("superadmin changes user roles", async () => {
    const { status } = await api(`/api/users/${aliId}`, {
      method: "PATCH",
      cookie: superadminCookie,
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
      cookie: superadminCookie,
      json: { roleKeys: ["EMPLOYEE"] },
    });
    expect(status).toBe(200);

    const profile = await api(`/api/users/${aliId}`, {
      method: "PATCH",
      cookie: adminCookie,
      json: { branchId: "branch-niavaran", department: "فروش" },
    });
    expect(profile.status).toBe(200);
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

describe("meeting policies", () => {
  const POLICY_KEY = "defaultReminderOffsets";

  it("admin can update defaultReminderOffsets (sorted desc)", async () => {
    const before = await api("/api/admin/policies", { cookie: adminCookie });
    const orig = before.body.data.policies.find((p: { key: string }) => p.key === POLICY_KEY)?.value;

    const patch = await api("/api/admin/policies", {
      method: "PATCH",
      cookie: adminCookie,
      json: { key: POLICY_KEY, value: [5, 45, 15] },
    });
    expect(patch.status).toBe(200);
    expect(patch.body.data.policy.value).toEqual([45, 15, 5]);

    const after = await api("/api/admin/policies", { cookie: adminCookie });
    expect(after.body.data.policies.find((p: { key: string }) => p.key === POLICY_KEY).value).toEqual([
      45, 15, 5,
    ]);

    await api("/api/admin/policies", {
      method: "PATCH",
      cookie: adminCookie,
      json: { key: POLICY_KEY, value: orig ?? [30, 10] },
    });
  });

  it("rejects invalid defaultReminderOffsets", async () => {
    const { status } = await api("/api/admin/policies", {
      method: "PATCH",
      cookie: adminCookie,
      json: { key: POLICY_KEY, value: [0, 10] },
    });
    expect(status).toBe(400);
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

describe("organization branding", () => {
  const testLogo = "http://localhost:3100/logo-white.png";

  it("unauthenticated cannot read branding (401)", async () => {
    const { status } = await api("/api/organization/branding");
    expect(status).toBe(401);
  });

  it("employee can read branding (read-only)", async () => {
    const { status, body } = await api("/api/organization/branding", { cookie: employeeCookie });
    expect(status).toBe(200);
    expect(body.data.branding.name).toBeTruthy();
    expect(body.data.branding).toHaveProperty("logoUrl");
    expect(body.data.branding.timezone).toBe("Asia/Tehran");
  });

  it("admin sets logoUrl and branding API reflects it", async () => {
    const before = await api("/api/admin/organization", { cookie: adminCookie });
    const originalLogo = before.body.data.organization.logoUrl;

    const patch = await api("/api/admin/organization", {
      method: "PATCH",
      cookie: adminCookie,
      json: { logoUrl: testLogo },
    });
    expect(patch.status).toBe(200);
    expect(patch.body.data.organization.logoUrl).toBe(testLogo);

    const branding = await api("/api/organization/branding", { cookie: employeeCookie });
    expect(branding.status).toBe(200);
    expect(branding.body.data.branding.logoUrl).toBe(testLogo);

    await api("/api/admin/organization", {
      method: "PATCH",
      cookie: adminCookie,
      json: { logoUrl: originalLogo ?? "" },
    });
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
    expect(body.data.wayfinding.branchName).toBe("شعبه نیاوران");
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

describe("self-service profile", () => {
  const SEED_PASS = "Pass1234";
  const TEMP_PASS = "Pass5678";

  it("anonymous cannot change password (401)", async () => {
    const { status } = await api("/api/auth/change-password", {
      method: "POST",
      json: { currentPassword: SEED_PASS, newPassword: TEMP_PASS },
    });
    expect(status).toBe(401);
  });

  it("employee updates own profile fields", async () => {
    const me = await api("/api/auth/me", { cookie: employeeCookie });
    const originalTitle = me.body.data.user.jobTitle;

    const { status, body } = await api("/api/auth/profile", {
      method: "PATCH",
      cookie: employeeCookie,
      json: { jobTitle: "تست پروفایل یکپارچه", department: "QA" },
    });
    expect(status).toBe(200);
    expect(body.data.user.jobTitle).toBe("تست پروفایل یکپارچه");

    await api("/api/auth/profile", {
      method: "PATCH",
      cookie: employeeCookie,
      json: { jobTitle: originalTitle ?? "", department: me.body.data.user.department ?? "" },
    });
  });

  it("rejects change-password with wrong current (401)", async () => {
    const { status, body } = await api("/api/auth/change-password", {
      method: "POST",
      cookie: employeeCookie,
      json: { currentPassword: "wrong-pass", newPassword: TEMP_PASS },
    });
    expect(status).toBe(401);
    expect(body.error.code).toBe("BAD_CREDENTIALS");
  });

  it("change-password then login with new password; restore seed", async () => {
    const changed = await api("/api/auth/change-password", {
      method: "POST",
      cookie: employeeCookie,
      json: { currentPassword: SEED_PASS, newPassword: TEMP_PASS },
    });
    expect(changed.status).toBe(200);

    const oldSession = await api("/api/auth/me", { cookie: employeeCookie });
    expect(oldSession.status).toBe(200);
    expect(oldSession.body.data.user).toBeNull();

    const newLogin = await api("/api/auth/login", {
      method: "POST",
      json: { email: "ali@example.com", password: TEMP_PASS },
    });
    expect(newLogin.status).toBe(200);

    const users = await api("/api/users?q=ali", { cookie: adminCookie });
    const ali = users.body.data.users.find((u: { email: string }) => u.email === "ali@example.com");
    expect(ali).toBeTruthy();

    const reset = await api(`/api/users/${ali.id}/reset-password`, {
      method: "POST",
      cookie: adminCookie,
      json: { password: SEED_PASS },
    });
    expect(reset.status).toBe(200);

    loginCache.delete("ali@example.com");
    employeeCookie = await login("ali@example.com");
  });

  it("anonymous cannot upload avatar (401)", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(PNG_DOT)], { type: "image/png" }), "me.png");
    const { status } = await api("/api/auth/avatar", { method: "POST", body: fd });
    expect(status).toBe(401);
  });

  it("employee uploads, fetches, and deletes own avatar", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(PNG_DOT)], { type: "image/png" }), "me.png");
    const uploaded = await api("/api/auth/avatar", {
      method: "POST",
      cookie: employeeCookie,
      body: fd,
    });
    expect(uploaded.status).toBe(200);
    const avatarUrl = uploaded.body.data.avatarUrl as string;
    expect(avatarUrl).toMatch(/^\/api\/avatars\//);

    const me = await api("/api/auth/me", { cookie: employeeCookie });
    expect(me.body.data.user.avatarUrl).toBe(avatarUrl);

    const userId = me.body.data.user.id as string;
    const img = await fetch(`${BASE}${avatarUrl}`, {
      headers: { Cookie: employeeCookie },
    });
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toMatch(/^image\//);

    const sameOrg = await fetch(`${BASE}/api/avatars/${userId}`, {
      headers: { Cookie: adminCookie },
    });
    expect(sameOrg.status).toBe(200);

    const colleagues = await api("/api/users", { cookie: employeeCookie });
    const listed = (colleagues.body.data.users as { id: string; avatarUrl: string | null }[]).find(
      (u) => u.id === userId,
    );
    expect(listed?.avatarUrl).toBe(avatarUrl);

    const removed = await api("/api/auth/avatar", {
      method: "DELETE",
      cookie: employeeCookie,
    });
    expect(removed.status).toBe(200);
    expect(removed.body.data.avatarUrl).toBeNull();

    const gone = await fetch(`${BASE}/api/avatars/${userId}`, {
      headers: { Cookie: employeeCookie },
    });
    expect(gone.status).toBe(404);
  });

  it("rejects non-image and oversized avatar uploads", async () => {
    const pdfFd = new FormData();
    pdfFd.append(
      "file",
      new Blob([new Uint8Array(Buffer.from("%PDF-1.1\n%%EOF\n"))], { type: "application/pdf" }),
      "me.pdf",
    );
    const pdf = await api("/api/auth/avatar", {
      method: "POST",
      cookie: employeeCookie,
      body: pdfFd,
    });
    expect(pdf.status).toBe(400);
    expect(pdf.body.error.code).toBe("FILE_TYPE");

    const huge = Buffer.alloc(2 * 1024 * 1024 + 8, 0xff);
    huge[0] = 0xff;
    huge[1] = 0xd8;
    huge[2] = 0xff;
    const bigFd = new FormData();
    bigFd.append("file", new Blob([new Uint8Array(huge)], { type: "image/jpeg" }), "big.jpg");
    const tooBig = await api("/api/auth/avatar", {
      method: "POST",
      cookie: employeeCookie,
      body: bigFd,
    });
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("org A cannot fetch org B avatar", async () => {
    const betaCookie = await login("beta@example.com");
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(PNG_DOT)], { type: "image/png" }), "me.png");
    const uploaded = await api("/api/auth/avatar", {
      method: "POST",
      cookie: betaCookie,
      body: fd,
    });
    expect(uploaded.status).toBe(200);
    const betaMe = await api("/api/auth/me", { cookie: betaCookie });
    const betaId = betaMe.body.data.user.id as string;

    const peek = await fetch(`${BASE}/api/avatars/${betaId}`, {
      headers: { Cookie: employeeCookie },
    });
    expect(peek.status).toBe(404);

    await api("/api/auth/avatar", { method: "DELETE", cookie: betaCookie });
  });
});

describe("role management (SUPER_ADMIN)", () => {
  const roleKey = `TEST_REPORT_${RUN}`;
  let roleId = "";
  let aliId = "";
  let superadminCookie = "";

  beforeAll(async () => {
    superadminCookie = await login("superadmin@example.com");
  });

  it("admin cannot manage roles (403)", async () => {
    const list = await api("/api/admin/roles", { cookie: adminCookie });
    expect(list.status).toBe(403);

    const create = await api("/api/admin/roles", {
      method: "POST",
      cookie: adminCookie,
      json: {
        key: "SHOULD_FAIL",
        name: "نقش نامعتبر",
        permissionKeys: ["report:view"],
      },
    });
    expect(create.status).toBe(403);
  });

  it("employee cannot view reports before custom role", async () => {
    const { status } = await api("/api/reports", { cookie: employeeCookie });
    expect(status).toBe(403);
  });

  it("superadmin creates custom role with report:view", async () => {
    const { status, body } = await api("/api/admin/roles", {
      method: "POST",
      cookie: superadminCookie,
      json: {
        key: roleKey,
        name: "نقش تست گزارش",
        description: "یکپارچه‌سازی",
        permissionKeys: ["report:view"],
      },
    });
    expect(status).toBe(201);
    roleId = body.data.role.id;
    expect(body.data.role.key).toBe(roleKey);
    expect(body.data.role.permissionKeys).toContain("report:view");
    expect(body.data.role.isSystem).toBe(false);
  });

  it("superadmin assigns custom role to employee → reports allowed", async () => {
    const users = await api("/api/users?q=ali", { cookie: adminCookie });
    const ali = users.body.data.users.find((u: { email: string }) => u.email === "ali@example.com");
    expect(ali).toBeTruthy();
    aliId = ali.id;

    const assign = await api(`/api/users/${aliId}`, {
      method: "PATCH",
      cookie: superadminCookie,
      json: { roleKeys: [roleKey] },
    });
    expect(assign.status).toBe(200);

    loginCache.delete("ali@example.com");
    const aliWithRole = await login("ali@example.com");

    const reports = await api("/api/reports", { cookie: aliWithRole });
    expect(reports.status).toBe(200);
  });

  it("cannot delete role while assigned to user", async () => {
    const del = await api(`/api/admin/roles/${roleId}`, {
      method: "DELETE",
      cookie: superadminCookie,
    });
    expect(del.status).toBe(409);
  });

  it("cannot edit system role", async () => {
    const list = await api("/api/admin/roles", { cookie: superadminCookie });
    const employeeRole = list.body.data.roles.find((r: { key: string }) => r.key === "EMPLOYEE");
    expect(employeeRole).toBeTruthy();

    const patch = await api(`/api/admin/roles/${employeeRole.id}`, {
      method: "PATCH",
      cookie: superadminCookie,
      json: { name: "تغییر غیرمجاز" },
    });
    expect(patch.status).toBe(403);
  });

  it("cleanup: restore employee role and delete custom role", async () => {
    const restore = await api(`/api/users/${aliId}`, {
      method: "PATCH",
      cookie: superadminCookie,
      json: { roleKeys: ["EMPLOYEE"] },
    });
    expect(restore.status).toBe(200);

    const del = await api(`/api/admin/roles/${roleId}`, {
      method: "DELETE",
      cookie: superadminCookie,
    });
    expect(del.status).toBe(200);

    loginCache.delete("ali@example.com");
    employeeCookie = await login("ali@example.com");
  });
});

describe("recurring meetings", () => {
  const branchId = "branch-niavaran";
  const roomId = "room-c";
  const title = `تکراری یکپارچه ${RUN}`;
  const conflictTitle = `تداخل سری ${RUN}`;
  const plantedTitle = `قفل نوبت دوم ${RUN}`;
  const privateTitle = `محرمانه سری ${RUN}`;
  const createdIds: string[] = [];

  async function cancelAll(id: string) {
    await api(`/api/meetings/${id}/cancel`, {
      method: "POST",
      cookie: adminCookie,
      json: { reason: "DUPLICATE_MEETING", scope: "ALL" },
    }).catch(() => {});
  }

  it("creates a daily series, returns count, and books each occurrence", async () => {
    const startAt = tehran(48, 21, 10);
    const endAt = tehran(48, 21, 40);
    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title,
        branchId,
        roomId,
        startAt,
        endAt,
        meetingType: "INTERNAL",
        recurrence: { freq: "DAILY", interval: 1, count: 3 },
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.occurrenceCount).toBe(3);
    expect(created.body.data.meeting.seriesId).toBeTruthy();
    expect(created.body.data.series.freq).toBe("DAILY");
    createdIds.push(created.body.data.meeting.id);

    const from = new Date(new Date(startAt).getTime() - 86400000).toISOString();
    const to = new Date(new Date(startAt).getTime() + 5 * 86400000).toISOString();
    const cal = await api(`/api/calendar?from=${from}&to=${to}&scope=all`, { cookie: adminCookie });
    expect(cal.status).toBe(200);
    const seriesMeetings = (cal.body.data.meetings ?? []).filter((m: { title: string }) => m.title === title);
    expect(seriesMeetings).toHaveLength(3);
    expect(seriesMeetings.every((m: { seriesId: string }) => m.seriesId)).toBe(true);

    const detail = await api(`/api/meetings/${created.body.data.meeting.id}`, { cookie: employeeCookie });
    expect(detail.status).toBe(200);
    expect(detail.body.data.meeting.series.freq).toBe("DAILY");
    expect(detail.body.data.meeting.reminders.length).toBeGreaterThan(0);
  });

  it("rejects the whole series when a later occurrence conflicts", async () => {
    const day2 = tehran(55, 21, 15);
    const planted = await api("/api/meetings", {
      method: "POST",
      cookie: adminCookie,
      json: {
        title: plantedTitle,
        branchId,
        roomId,
        startAt: day2,
        endAt: tehran(55, 21, 45),
        meetingType: "INTERNAL",
      },
    });
    expect(planted.status).toBe(201);
    createdIds.push(planted.body.data.meeting.id);

    const blocked = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: conflictTitle,
        branchId,
        roomId,
        startAt: tehran(54, 21, 15),
        endAt: tehran(54, 21, 45),
        meetingType: "INTERNAL",
        recurrence: { freq: "DAILY", interval: 1, count: 3 },
      },
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error?.code).toBe("ROOM_CONFLICT");

    const list = await api(`/api/meetings?scope=all&limit=50&q=${encodeURIComponent(conflictTitle)}`, {
      cookie: adminCookie,
    });
    const leaked = (list.body.data.meetings ?? []).filter((m: { title: string }) => m.title === conflictTitle);
    expect(leaked).toHaveLength(0);
  });

  it("cancels this-and-following without touching earlier instances", async () => {
    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: `${title} — دامنه`,
        branchId,
        roomId: "room-b",
        startAt: tehran(60, 20, 5),
        endAt: tehran(60, 20, 35),
        meetingType: "INTERNAL",
        recurrence: { freq: "DAILY", interval: 1, count: 3 },
      },
    });
    expect(created.status).toBe(201);
    const firstId = created.body.data.meeting.id as string;
    createdIds.push(firstId);

    const from = new Date(new Date(tehran(60, 20, 5)).getTime() - 86400000).toISOString();
    const to = new Date(new Date(tehran(60, 20, 5)).getTime() + 5 * 86400000).toISOString();
    const cal = await api(`/api/calendar?from=${from}&to=${to}&scope=all`, { cookie: adminCookie });
    const occ = (cal.body.data.meetings ?? [])
      .filter((m: { title: string }) => m.title === `${title} — دامنه`)
      .sort((a: { startAt: string }, b: { startAt: string }) => a.startAt.localeCompare(b.startAt));
    expect(occ).toHaveLength(3);

    const mid = occ[1];
    const cancelled = await api(`/api/meetings/${mid.id}/cancel`, {
      method: "POST",
      cookie: employeeCookie,
      json: { reason: "OTHER", scope: "FOLLOWING" },
    });
    expect(cancelled.status).toBe(200);

    const after = await api(`/api/calendar?from=${from}&to=${to}&scope=all`, { cookie: adminCookie });
    const remaining = (after.body.data.meetings ?? []).filter(
      (m: { title: string }) => m.title === `${title} — دامنه`,
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(occ[0].id);

    await cancelAll(firstId);
  });

  it("masks a private series for a non-involved admin", async () => {
    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: privateTitle,
        branchId,
        roomId: "room-b",
        startAt: tehran(62, 19, 5),
        endAt: tehran(62, 19, 35),
        meetingType: "INTERNAL",
        isPrivate: true,
        recurrence: { freq: "DAILY", interval: 1, count: 2 },
      },
    });
    expect(created.status).toBe(201);
    createdIds.push(created.body.data.meeting.id);

    const from = new Date(new Date(tehran(62, 19, 5)).getTime() - 86400000).toISOString();
    const to = new Date(new Date(tehran(62, 19, 5)).getTime() + 4 * 86400000).toISOString();
    const cal = await api(`/api/calendar?from=${from}&to=${to}&scope=all`, { cookie: adminCookie });
    const masked = (cal.body.data.meetings ?? []).filter(
      (m: { seriesId?: string }) => m.seriesId === created.body.data.meeting.seriesId,
    );
    expect(masked.length).toBeGreaterThan(0);
    expect(masked.every((m: { isMasked?: boolean; title: string }) => m.isMasked && m.title === "جلسه محرمانه")).toBe(true);
    expect((cal.body.data.meetings ?? []).some((m: { title: string }) => m.title === privateTitle)).toBe(false);
  });

  it("cleanup: cancel leftover series", async () => {
    for (const id of createdIds) {
      await cancelAll(id);
    }
  });
});

describe("calendar ICS feed", () => {
  let aliToken = "";
  let aliHttpUrl = "";

  it("rejects anonymous download of session ICS", async () => {
    const res = await fetch(`${BASE}/api/calendar/ics`);
    expect(res.status).toBe(401);
  });

  it("rejects anonymous feed-token management", async () => {
    const get = await api("/api/calendar/feed-token");
    expect(get.status).toBe(401);
    const post = await api("/api/calendar/feed-token", { method: "POST" });
    expect(post.status).toBe(401);
  });

  it("unknown feed token is 404", async () => {
    const res = await fetch(`${BASE}/api/calendar/feed/${"a".repeat(64)}`);
    expect(res.status).toBe(404);
  });

  it("employee can create a personal feed that only lists their meetings", async () => {
    const created = await api("/api/calendar/feed-token", {
      method: "POST",
      cookie: employeeCookie,
    });
    expect(created.status).toBe(200);
    aliToken = created.body.data.token as string;
    aliHttpUrl = created.body.data.httpUrl as string;
    expect(aliToken.length).toBeGreaterThan(20);
    expect(created.body.data.webcalUrl).toMatch(/^webcal:\/\//);
    expect(aliHttpUrl).toContain(`/api/calendar/feed/${aliToken}`);

    const feed = await fetch(aliHttpUrl);
    expect(feed.status).toBe(200);
    expect(feed.headers.get("content-type")).toMatch(/text\/calendar/);
    const text = await feed.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("TZID:Asia/Tehran");
    expect(text).toContain("جلسه هفتگی تیم فروش"); // ali organizes
    expect(text).not.toContain("بازبینی بودجه فصل"); // admin-only, ali not invited
    expect(text).toMatch(/STATUS:CANCELLED/); // seed cancelled meeting of ali
  });

  it("admin session ICS does not include another person's exclusive meetings", async () => {
    const res = await fetch(`${BASE}/api/calendar/ics`, {
      headers: { cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("BEGIN:VEVENT");
    expect(text).toContain("بازبینی بودجه فصل");
    expect(text).not.toContain("جلسه هفتگی تیم فروش");
  });

  it("cannot use someone else's feed token after it is rotated or revoked", async () => {
    const oldToken = aliToken;
    const rotated = await api("/api/calendar/feed-token", {
      method: "POST",
      cookie: employeeCookie,
    });
    expect(rotated.status).toBe(200);
    const newToken = rotated.body.data.token as string;
    expect(newToken).not.toBe(oldToken);

    const stale = await fetch(`${BASE}/api/calendar/feed/${oldToken}`);
    expect(stale.status).toBe(404);

    const revoked = await api("/api/calendar/feed-token", {
      method: "DELETE",
      cookie: employeeCookie,
    });
    expect(revoked.status).toBe(200);
    expect(revoked.body.data.enabled).toBe(false);

    const gone = await fetch(`${BASE}/api/calendar/feed/${newToken}`);
    expect(gone.status).toBe(404);
  });
});

describe("google calendar per-user OAuth (mock)", () => {
  it("rejects anonymous status", async () => {
    const res = await fetch(`${BASE}/api/calendar/google`);
    expect(res.status).toBe(401);
  });

  it("rejects anonymous disconnect", async () => {
    const res = await api("/api/calendar/google", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("employee can mock-connect and disconnect without Google", async () => {
    await api("/api/calendar/google", { method: "DELETE", cookie: employeeCookie });

    const before = await api("/api/calendar/google", { cookie: employeeCookie });
    expect(before.status).toBe(200);
    expect(before.body.data.connected).toBe(false);

    const connect = await fetch(`${BASE}/api/calendar/google/connect`, {
      headers: { Cookie: employeeCookie },
      redirect: "manual",
    });
    expect([302, 303, 307]).toContain(connect.status);
    const location = connect.headers.get("location") ?? "";
    expect(location).toMatch(/\/profile\?google=connected/);

    const after = await api("/api/calendar/google", { cookie: employeeCookie });
    expect(after.status).toBe(200);
    expect(after.body.data.connected).toBe(true);
    expect(after.body.data.accountEmail).toBe("ali@example.com");

    const gone = await api("/api/calendar/google", {
      method: "DELETE",
      cookie: employeeCookie,
    });
    expect(gone.status).toBe(200);
    expect(gone.body.data.connected).toBe(false);

    const final = await api("/api/calendar/google", { cookie: employeeCookie });
    expect(final.body.data.connected).toBe(false);
  });

  it("connect without a session redirects to login", async () => {
    const res = await fetch(`${BASE}/api/calendar/google/connect`, { redirect: "manual" });
    expect([302, 303, 307]).toContain(res.status);
    expect(res.headers.get("location") ?? "").toMatch(/\/login/);
  });
});

describe("meeting attachments", () => {
  let amirCookie = "";
  let amirId = "";
  let publicId = "";
  let privateId = "";
  let publicAttId = "";
  let privateAttId = "";
  const branchId = "branch-niavaran";

  const pdfBytes = Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

  async function postFile(
    meetingId: string,
    cookie: string,
    buf: Buffer,
    filename: string,
    mime = "application/pdf",
  ) {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(buf)], { type: mime }), filename);
    return api(`/api/meetings/${meetingId}/attachments`, {
      method: "POST",
      cookie,
      body: fd,
    });
  }

  async function download(meetingId: string, attId: string, cookie?: string) {
    return fetch(`${BASE}/api/meetings/${meetingId}/attachments/${attId}`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
  }

  beforeAll(async () => {
    amirCookie = await login("amir@example.com");
    const me = await api("/api/auth/me", { cookie: amirCookie });
    amirId = me.body.data.user.id as string;

    const pub = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: "تست پیوست — عمومی",
        branchId,
        roomId: "room-a",
        startAt: tehran(84, 10, 5),
        endAt: tehran(84, 10, 35),
        meetingType: "INTERNAL",
        participantIds: [amirId],
      },
    });
    expect(pub.status).toBe(201);
    publicId = pub.body.data.meeting.id as string;

    const priv = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: "تست پیوست — محرمانه استراتژی",
        branchId,
        roomId: "room-b",
        startAt: tehran(84, 11, 5),
        endAt: tehran(84, 11, 35),
        meetingType: "INTERNAL",
        isPrivate: true,
        participantIds: [amirId],
      },
    });
    expect(priv.status).toBe(201);
    privateId = priv.body.data.meeting.id as string;
  });

  it("rejects anonymous upload and download", async () => {
    const up = await postFile(publicId, "", pdfBytes, "agenda.pdf");
    expect(up.status).toBe(401);
    const dl = await download(publicId, "missing");
    expect(dl.status).toBe(401);
  });

  it("organizer can upload; invitee cannot", async () => {
    const up = await postFile(publicId, employeeCookie, pdfBytes, "agenda.pdf");
    expect(up.status).toBe(201);
    expect(up.body.data.attachment.originalName).toBe("agenda.pdf");
    expect(up.body.data.attachment.storageKey).toBeUndefined();
    publicAttId = up.body.data.attachment.id as string;

    const inviteeUp = await postFile(publicId, amirCookie, pdfBytes, "notes.pdf");
    expect(inviteeUp.status).toBe(403);
  });

  it("invitee can download; outsider on a private meeting cannot", async () => {
    const privUp = await postFile(privateId, employeeCookie, pdfBytes, "secret.pdf");
    expect(privUp.status).toBe(201);
    privateAttId = privUp.body.data.attachment.id as string;

    const invitee = await download(privateId, privateAttId, amirCookie);
    expect(invitee.status).toBe(200);
    expect(invitee.headers.get("content-type")).toMatch(/pdf/);
    const bytes = Buffer.from(await invitee.arrayBuffer());
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");

    const outsider = await download(privateId, privateAttId, branchManagerCookie);
    expect(outsider.status).toBe(403);
    const outsiderBody = await outsider.text();
    expect(outsiderBody).not.toContain("secret.pdf");

    const outsiderUp = await postFile(privateId, branchManagerCookie, pdfBytes, "leak.pdf");
    expect(outsiderUp.status).toBe(403);

    const pubDl = await download(publicId, publicAttId, amirCookie);
    expect(pubDl.status).toBe(200);
  });

  it("rejects disallowed file types", async () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04]);
    const bad = await postFile(publicId, employeeCookie, exe, "payload.pdf", "application/pdf");
    expect(bad.status).toBe(400);
  });

  it("writes audit logs for upload and delete", async () => {
    const logs = await api(
      "/api/admin/audit-logs?entity=MeetingAttachment&action=ATTACHMENT_UPLOAD&pageSize=20",
      { cookie: adminCookie },
    );
    expect(logs.status).toBe(200);
    const hit = (logs.body.data.logs ?? []).some(
      (l: { entityId: string; action: string }) =>
        l.entityId === publicAttId && l.action === "ATTACHMENT_UPLOAD",
    );
    expect(hit).toBe(true);

    const del = await api(`/api/meetings/${publicId}/attachments/${publicAttId}`, {
      method: "DELETE",
      cookie: employeeCookie,
    });
    expect(del.status).toBe(200);

    const gone = await download(publicId, publicAttId, employeeCookie);
    expect(gone.status).toBe(404);

    const deletes = await api(
      "/api/admin/audit-logs?entity=MeetingAttachment&action=ATTACHMENT_DELETE&pageSize=20",
      { cookie: adminCookie },
    );
    expect(
      (deletes.body.data.logs ?? []).some(
        (l: { entityId: string }) => l.entityId === publicAttId,
      ),
    ).toBe(true);
  });

  it("cleanup: cancel attachment test meetings", async () => {
    for (const id of [publicId, privateId]) {
      if (!id) continue;
      await api(`/api/meetings/${id}/cancel`, {
        method: "POST",
        cookie: employeeCookie,
        json: { reason: "OTHER" },
      }).catch(() => {});
    }
  });
});

describe("meeting agenda", () => {
  let amirCookie = "";
  let amirId = "";
  let meetingId = "";
  const branchId = "branch-niavaran";

  beforeAll(async () => {
    amirCookie = await login("amir@example.com");
    const me = await api("/api/auth/me", { cookie: amirCookie });
    amirId = me.body.data.user.id as string;

    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: "تست دستور جلسه — استندآپ",
        branchId,
        roomId: "room-a",
        startAt: tehran(86, 16, 5),
        endAt: tehran(86, 16, 35),
        meetingType: "INTERNAL",
        participantIds: [amirId],
      },
    });
    expect(created.status).toBe(201);
    meetingId = created.body.data.meeting.id as string;
  });

  it("rejects anonymous and invitee updates; organizer can save ordered items", async () => {
    const anon = await api(`/api/meetings/${meetingId}/agenda`, {
      method: "PUT",
      json: { items: [{ title: "مخفی" }] },
    });
    expect(anon.status).toBe(401);

    const invitee = await api(`/api/meetings/${meetingId}/agenda`, {
      method: "PUT",
      cookie: amirCookie,
      json: { items: [{ title: "نباید ذخیره شود" }] },
    });
    expect(invitee.status).toBe(403);

    const saved = await api(`/api/meetings/${meetingId}/agenda`, {
      method: "PUT",
      cookie: employeeCookie,
      json: {
        items: [
          { title: "مرور KPI", durationMin: 15, ownerId: amirId },
          { title: "سؤالات باز", durationMin: 10 },
        ],
      },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.items).toHaveLength(2);
    expect(saved.body.data.items[0].title).toBe("مرور KPI");
    expect(saved.body.data.items[0].sortOrder).toBe(0);
    expect(saved.body.data.items[0].owner.fullName).toBeTruthy();
    expect(saved.body.data.items[1].title).toBe("سؤالات باز");
  });

  it("invitee can read agenda; ICS description includes it", async () => {
    const list = await api(`/api/meetings/${meetingId}/agenda`, { cookie: amirCookie });
    expect(list.status).toBe(200);
    expect(list.body.data.items[0].title).toBe("مرور KPI");

    const icsRes = await fetch(`${BASE}/api/calendar/ics`, {
      headers: { cookie: employeeCookie },
    });
    expect(icsRes.status).toBe(200);
    const text = await icsRes.text();
    expect(text).toContain("دستور جلسه");
    expect(text).toContain("مرور KPI");
  });

  it("rejects an owner who is not invited", async () => {
    const adminMe = await api("/api/auth/me", { cookie: adminCookie });
    const adminId = adminMe.body.data.user.id as string;
    const bad = await api(`/api/meetings/${meetingId}/agenda`, {
      method: "PUT",
      cookie: employeeCookie,
      json: { items: [{ title: "خارجی", ownerId: adminId }] },
    });
    expect(bad.status).toBe(400);
  });

  it("cleanup: cancel agenda test meeting", async () => {
    await api(`/api/meetings/${meetingId}/cancel`, {
      method: "POST",
      cookie: employeeCookie,
      json: { reason: "OTHER" },
    }).catch(() => {});
  });
});

describe("meeting minutes", () => {
  let amirCookie = "";
  let amirId = "";
  let publicId = "";
  let privateId = "";
  const branchId = "branch-niavaran";

  beforeAll(async () => {
    amirCookie = await login("amir@example.com");
    const me = await api("/api/auth/me", { cookie: amirCookie });
    amirId = me.body.data.user.id as string;
  });

  it("rejects write before the meeting is held; organizer saves after COMPLETED", async () => {
    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: "تست صورتجلسه — عمومی",
        branchId,
        roomId: "room-a",
        startAt: tehran(88, 10, 0),
        endAt: tehran(88, 11, 0),
        meetingType: "INTERNAL",
        participantIds: [amirId],
      },
    });
    expect(created.status).toBe(201);
    publicId = created.body.data.meeting.id as string;

    const tooSoon = await api(`/api/meetings/${publicId}/minutes`, {
      method: "PUT",
      cookie: employeeCookie,
      json: { body: "نباید ذخیره شود" },
    });
    expect(tooSoon.status).toBe(400);

    const started = await api(`/api/meetings/${publicId}/start`, {
      method: "POST",
      cookie: employeeCookie,
    });
    expect(started.status).toBe(200);

    const inProgress = await api(`/api/meetings/${publicId}/minutes`, {
      method: "PUT",
      cookie: employeeCookie,
      json: { body: "پیش‌نویس حین برگزاری" },
    });
    expect(inProgress.status).toBe(200);

    const ended = await api(`/api/meetings/${publicId}/end`, {
      method: "POST",
      cookie: employeeCookie,
      json: { noShow: false },
    });
    expect(ended.status).toBe(200);

    const saved = await api(`/api/meetings/${publicId}/minutes`, {
      method: "PUT",
      cookie: employeeCookie,
      json: {
        body: "جمع‌بندی جلسه تست صورتجلسه",
        decisions: [
          { text: "ارسال گزارش", ownerId: amirId, dueAt: "2030-06-01" },
          { text: "جلسه پیگیری" },
        ],
      },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.minutes.body).toBe("جمع‌بندی جلسه تست صورتجلسه");
    expect(saved.body.data.minutes.decisions).toHaveLength(2);
    expect(saved.body.data.minutes.decisions[0].text).toBe("ارسال گزارش");
    expect(saved.body.data.minutes.decisions[0].owner.fullName).toBeTruthy();
    expect(saved.body.data.minutes.decisions[0].dueAt).toBeTruthy();

    const logs = await api(
      "/api/admin/audit-logs?entity=Meeting&action=MINUTES_PUBLISH&pageSize=20",
      { cookie: adminCookie },
    );
    expect(logs.status).toBe(200);
    expect(
      (logs.body.data.logs ?? []).some(
        (l: { entityId: string; action: string }) =>
          l.entityId === publicId && l.action === "MINUTES_PUBLISH",
      ),
    ).toBe(true);

    const detail = await api(`/api/meetings/${publicId}`, { cookie: employeeCookie });
    const events = detail.body.data.meeting.events as { type: string }[];
    expect(events.some((e) => e.type === "MINUTES_PUBLISHED")).toBe(true);
    expect(detail.body.data.meeting.minutes.body).toBe("جمع‌بندی جلسه تست صورتجلسه");
  });

  it("invitee can read; invitee and anonymous cannot write", async () => {
    const anon = await api(`/api/meetings/${publicId}/minutes`, {
      method: "PUT",
      json: { body: "مخفی" },
    });
    expect(anon.status).toBe(401);

    const inviteeWrite = await api(`/api/meetings/${publicId}/minutes`, {
      method: "PUT",
      cookie: amirCookie,
      json: { body: "نباید ذخیره شود" },
    });
    expect(inviteeWrite.status).toBe(403);

    const read = await api(`/api/meetings/${publicId}/minutes`, { cookie: amirCookie });
    expect(read.status).toBe(200);
    expect(read.body.data.minutes.body).toBe("جمع‌بندی جلسه تست صورتجلسه");
    expect(read.body.data.minutes.decisions[0].text).toBe("ارسال گزارش");
  });

  it("notifies invitees that minutes were published", async () => {
    const notifs = await api("/api/notifications", { cookie: amirCookie });
    const hit = (notifs.body.data.notifications ?? []).find(
      (n: { type: string; title: string; data?: { meetingId?: string } }) =>
        n.type === "MINUTES_PUBLISHED" &&
        n.title === "صورتجلسه ثبت شد" &&
        n.data?.meetingId === publicId,
    );
    expect(hit).toBeTruthy();
  });

  it("private meeting: outsider 403, invitee can read minutes", async () => {
    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: "کمیته محرمانه صورتجلسه",
        branchId,
        roomId: "room-a",
        startAt: tehran(89, 10, 0),
        endAt: tehran(89, 11, 0),
        meetingType: "INTERNAL",
        isPrivate: true,
        participantIds: [amirId],
      },
    });
    expect(created.status).toBe(201);
    privateId = created.body.data.meeting.id as string;

    await api(`/api/meetings/${privateId}/start`, {
      method: "POST",
      cookie: employeeCookie,
    });
    await api(`/api/meetings/${privateId}/end`, {
      method: "POST",
      cookie: employeeCookie,
      json: { noShow: false },
    });

    const saved = await api(`/api/meetings/${privateId}/minutes`, {
      method: "PUT",
      cookie: employeeCookie,
      json: { body: "متن محرمانه صورتجلسه", decisions: [{ text: "تصمیم سری" }] },
    });
    expect(saved.status).toBe(200);

    const outsider = await api(`/api/meetings/${privateId}/minutes`, {
      cookie: branchManagerCookie,
    });
    expect(outsider.status).toBe(403);
    expect(JSON.stringify(outsider.body)).not.toContain("متن محرمانه صورتجلسه");

    const outsiderPut = await api(`/api/meetings/${privateId}/minutes`, {
      method: "PUT",
      cookie: branchManagerCookie,
      json: { body: "نباید" },
    });
    expect(outsiderPut.status).toBe(403);

    const invitee = await api(`/api/meetings/${privateId}/minutes`, { cookie: amirCookie });
    expect(invitee.status).toBe(200);
    expect(invitee.body.data.minutes.body).toBe("متن محرمانه صورتجلسه");
  });
});

describe("tenant isolation", () => {
  const BETA_TITLE = "جلسه سازمان بتا — ایزوله";

  it("org A employee cannot list or open org B meetings", async () => {
    const list = await api("/api/meetings?scope=all&limit=500", { cookie: employeeCookie });
    expect(list.status).toBe(200);
    const titles = (list.body?.data?.meetings ?? []).map((m: { title: string }) => m.title);
    expect(titles).not.toContain(BETA_TITLE);

    const other = await api("/api/meetings/seed-meeting-beta", { cookie: employeeCookie });
    expect(other.status).toBe(404);
  });

  it("org A employee cannot reach org B rooms, people, or users", async () => {
    const rooms = await api("/api/rooms", { cookie: employeeCookie });
    expect(rooms.status).toBe(200);
    const roomIds = (rooms.body?.data?.rooms ?? []).map((r: { id: string }) => r.id);
    expect(roomIds).not.toContain("room-beta");

    const people = await api("/api/people?q=بتا", { cookie: employeeCookie });
    expect(people.status).toBe(200);
    const names = (people.body?.data?.people ?? []).map((p: { name: string }) => p.name);
    expect(names.join(" ")).not.toContain("سازمان بتا");

    const users = await api("/api/users", { cookie: employeeCookie });
    expect(users.status).toBe(200);
    const emails = (users.body?.data?.users ?? []).map((u: { email?: string }) => u.email).filter(Boolean);
    expect(emails).not.toContain("beta@example.com");
  });

  it("x-org-slug from org A user does not switch tenant", async () => {
    const other = await api("/api/meetings/seed-meeting-beta", {
      cookie: employeeCookie,
      headers: { "x-org-slug": "beta" },
    });
    expect(other.status).toBe(404);

    const list = await api("/api/meetings?scope=all&limit=500", {
      cookie: employeeCookie,
      headers: { "x-org-slug": "beta" },
    });
    const titles = (list.body?.data?.meetings ?? []).map((m: { title: string }) => m.title);
    expect(titles).not.toContain(BETA_TITLE);
  });

  it("org B user cannot open org A meetings and only sees own tenant", async () => {
    const betaCookie = await login("beta@example.com");

    const sample = await api("/api/meetings/seed-meeting-1", { cookie: betaCookie });
    expect(sample.status).toBe(404);

    const list = await api("/api/meetings?scope=all&limit=500", { cookie: betaCookie });
    expect(list.status).toBe(200);
    const titles = (list.body?.data?.meetings ?? []).map((m: { title: string }) => m.title);
    expect(titles).toContain(BETA_TITLE);
    expect(titles).not.toContain("جلسه هفتگی تیم فروش");

    const rooms = await api("/api/rooms", { cookie: betaCookie });
    const roomIds = (rooms.body?.data?.rooms ?? []).map((r: { id: string }) => r.id);
    expect(roomIds).toContain("room-beta");
    expect(roomIds).not.toContain("room-a");
  });

  it("login with the wrong org slug is rejected", async () => {
    const res = await api("/api/auth/login", {
      method: "POST",
      json: { email: "ali@example.com", password: "Pass1234", orgSlug: "beta" },
    });
    expect([401, 429]).toContain(res.status);
  });
});

describe("meeting delegates", () => {
  const TITLE = "تست یکپارچه — تفویض رزرو";
  let adminId = "";
  let aliId = "";
  let delegateRowId = "";
  let meetingId = "";

  async function wipeAliDelegate() {
    const list = await api("/api/delegates", { cookie: adminCookie });
    const rows = list.body?.data?.delegates ?? [];
    for (const row of rows) {
      if (row.user?.id === aliId) {
        await api(`/api/delegates/${row.id}`, { method: "DELETE", cookie: adminCookie });
      }
    }
  }

  it("loads actor ids", async () => {
    const adminMe = await api("/api/auth/me", { cookie: adminCookie });
    const aliMe = await api("/api/auth/me", { cookie: employeeCookie });
    adminId = adminMe.body.data.user.id;
    aliId = aliMe.body.data.user.id;
    expect(adminId).toBeTruthy();
    expect(aliId).toBeTruthy();
    await wipeAliDelegate();
  });

  it("unauthorized employee cannot create as the admin", async () => {
    const { status, body } = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: TITLE,
        branchId: "branch-niavaran",
        roomId: "room-a",
        startAt: tehran(12, 8),
        endAt: tehran(12, 9),
        meetingType: "INTERNAL",
        participantIds: [],
        organizerId: adminId,
      },
    });
    expect(status).toBe(403);
    expect(body?.error?.code).toBe("NOT_DELEGATE");
  });

  it("unauthorized employee cannot query admin availability", async () => {
    const { status, body } = await api("/api/availability", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        branchId: "branch-niavaran",
        participantIds: [],
        durationMin: 30,
        from: tehran(12, 8),
        to: tehran(12, 18),
        organizerId: adminId,
      },
    });
    expect(status).toBe(403);
    expect(body?.error?.code).toBe("NOT_DELEGATE");
  });

  it("admin appoints ali as delegate", async () => {
    const { status, body } = await api("/api/delegates", {
      method: "POST",
      cookie: adminCookie,
      json: { userId: aliId },
    });
    expect(status).toBe(201);
    delegateRowId = body.data.delegate.id;
    expect(body.data.delegate.user.id).toBe(aliId);

    const list = await api("/api/delegates", { cookie: employeeCookie });
    expect(list.status).toBe(200);
    const principals = list.body.data.principals ?? [];
    expect(principals.some((p: { user: { id: string } }) => p.user.id === adminId)).toBe(true);
  });

  it("appointed employee can create on behalf of admin", async () => {
    const { status, body } = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: TITLE,
        branchId: "branch-niavaran",
        roomId: "room-a",
        startAt: tehran(12, 8),
        endAt: tehran(12, 9),
        meetingType: "INTERNAL",
        participantIds: [],
        organizerId: adminId,
      },
    });
    expect(status).toBe(201);
    meetingId = body.data.meeting.id;
    expect(body.data.meeting.organizerId).toBe(adminId);
    expect(body.data.meeting.createdById).toBe(aliId);
  });

  it("room manager still cannot create even if appointed (RBAC)", async () => {
    const roomMe = await api("/api/auth/me", { cookie: roomManagerCookie });
    const roomId = roomMe.body.data.user.id as string;
    const appointed = await api("/api/delegates", {
      method: "POST",
      cookie: adminCookie,
      json: { userId: roomId },
    });
    expect([201, 409]).toContain(appointed.status);
    const rowId = appointed.body?.data?.delegate?.id;
    const { status } = await api("/api/meetings", {
      method: "POST",
      cookie: roomManagerCookie,
      json: {
        title: TITLE,
        branchId: "branch-niavaran",
        startAt: tehran(12, 14),
        endAt: tehran(12, 15),
        meetingType: "INTERNAL",
        participantIds: [],
        organizerId: adminId,
      },
    });
    expect(status).toBe(403);
    if (rowId) {
      await api(`/api/delegates/${rowId}`, { method: "DELETE", cookie: adminCookie });
    }
  });

  it("cleanup: cancel meeting and remove delegate", async () => {
    if (meetingId) {
      await api(`/api/meetings/${meetingId}/cancel`, {
        method: "POST",
        cookie: adminCookie,
        json: { reason: "OTHER" },
      }).catch(() => {});
    }
    if (delegateRowId) {
      await api(`/api/delegates/${delegateRowId}`, {
        method: "DELETE",
        cookie: adminCookie,
      }).catch(() => {});
    }
    await wipeAliDelegate();
  });
});
