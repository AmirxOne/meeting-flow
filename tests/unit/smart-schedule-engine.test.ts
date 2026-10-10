import { describe, it, expect } from "vitest";
import { scheduleRequests, validatePlan, priorityScore, type SchedRequest, type SchedConstraints } from "@/server/services/ai/smart-schedule-engine";

// پنجره: شنبه ۲ مهر…؟ نه — تاریخ ثابت: 2026-10-12 (دوشنبه) تا 2026-10-14 (چهارشنبه)
// ساعت کاری 08:00-18:00، شنبه تا چهارشنبه (6,0,1,2,3)
const WIN_FROM = new Date("2026-10-12T00:00:00");
const WIN_TO = new Date("2026-10-14T23:59:59");
const HOLIDAY = "2026-10-13"; // سه‌شنبه تعطیل

const C = (over: Partial<SchedConstraints> = {}): SchedConstraints => ({
  windowFrom: WIN_FROM,
  windowTo: WIN_TO,
  workStartMin: 8 * 60,
  workEndMin: 18 * 60,
  workDays: [6, 0, 1, 2, 3],
  holidaysIso: new Set([HOLIDAY]),
  rooms: [
    { id: "r1", branchId: "b1", capacity: 4, active: true, name: "کوچک" },
    { id: "r2", branchId: "b1", capacity: 12, active: true, name: "بزرگ" },
    { id: "r3", branchId: "b1", capacity: 8, active: false, name: "غیرفعال" },
  ],
  busy: [],
  ...over,
});

const REQ = (over: Partial<SchedRequest> = {}): SchedRequest => ({
  id: "req-1",
  title: "جلسه",
  urgency: "NORMAL",
  durationMin: 60,
  prefFrom: null,
  prefTo: null,
  prefSlots: null,
  participantIds: ["u1", "u2"],
  attendeeCount: null,
  venue: "ONSITE",
  ...over,
});

describe("priorityScore", () => {
  it("URGENT بالاتر از NORMAL بالاتر از FLEXIBLE", () => {
    const u = priorityScore(REQ({ urgency: "URGENT" }));
    const n = priorityScore(REQ({ urgency: "NORMAL" }));
    const f = priorityScore(REQ({ urgency: "FLEXIBLE" }));
    expect(u > n && n > f).toBe(true);
  });
  it("پنجره‌ی ترجیحی نزدیک امتیاز می‌آورد", () => {
    const soon = priorityScore(REQ({ prefFrom: new Date(Date.now() + 12 * 3600e3) }));
    const far = priorityScore(REQ({ prefFrom: new Date(Date.now() + 20 * 86400e3) }));
    expect(soon > far).toBe(true);
  });
});

describe("scheduleRequests — قوانین اجباری", () => {
  it("جلسه در ساعات کاری و روز کاری قرار می‌گیرد", () => {
    const r = scheduleRequests([REQ()], C());
    expect(r.assignments).toHaveLength(1);
    const a = r.assignments[0];
    expect(a.start.getHours()).toBeGreaterThanOrEqual(8);
    expect(a.end.getHours()).toBeLessThanOrEqual(18);
    expect([6, 0, 1, 2, 3]).toContain(a.start.getDay());
  });

  it("تعطیلی رعایت می‌شود (سه‌شنبه 13 اکتبر تعطیل)", () => {
    // پنجره فقط همان روز تعطیل
    const c = C({ windowFrom: new Date("2026-10-13T00:00:00"), windowTo: new Date("2026-10-13T23:59:59") });
    const r = scheduleRequests([REQ()], c);
    expect(r.assignments).toHaveLength(0);
    expect(r.unscheduled[0]?.reason).toContain("تعطیل");
  });

  it("دو جلسه با شرکت‌کننده مشترک هم‌زمان نمی‌شوند", () => {
    const r = scheduleRequests(
      [REQ({ id: "a", title: "الف" }), REQ({ id: "b", title: "ب", participantIds: ["u2", "u3"] })], // u2 مشترک
      C(),
    );
    expect(r.assignments).toHaveLength(2);
    const [a, b] = r.assignments;
    const overlap = a.start < b.end && b.start < a.end;
    expect(overlap).toBe(false);
  });

  it("تداخل با جلسه‌ی ثبت‌شده‌ی شرکت‌کننده — جلسه بعدی می‌رود", () => {
    const busy = [{ userId: "u1", from: new Date("2026-10-12T08:00:00"), to: new Date("2026-10-12T17:00:00") }];
    const r = scheduleRequests([REQ()], C({ busy }));
    expect(r.assignments).toHaveLength(1);
    // باید بعد از 17:00 شروع شود (یا روز بعد)
    expect(r.assignments[0].start.getTime()).toBeGreaterThanOrEqual(new Date("2026-10-12T17:00:00").getTime());
  });

  it("پنجره‌ی ترجیحی درخواست اجباری است", () => {
    const r = scheduleRequests(
      [REQ({ prefFrom: new Date("2026-10-12T14:00:00"), prefTo: new Date("2026-10-12T16:00:00") })],
      C(),
    );
    expect(r.assignments[0].start.getHours()).toBeGreaterThanOrEqual(14);
    expect(r.assignments[0].end.getHours()).toBeLessThanOrEqual(16);
  });

  it("ظرفیت اتاق رعایت می‌شود — جلسه بزرگ در اتاق بزرگ", () => {
    const r = scheduleRequests([REQ({ participantIds: ["u1","u2","u3","u4","u5","u6","u7","u8","u9","u10"] })], C());
    expect(r.assignments[0].roomId).toBe("r2"); // بزرگ (12) نه کوچک (4)
  });

  it("اتاق غیرفعال استفاده نمی‌شود", () => {
    const r = scheduleRequests([REQ()], C({ rooms: [{ id: "r3", branchId: "b1", capacity: 8, active: false, name: "غیرفعال" }] }));
    expect(r.unscheduled[0]?.reason).toContain("اتاق");
  });

  it("جس نشدن → گزارش با علت، بدون زمان جعلی", () => {
    const c = C({ windowFrom: new Date("2026-10-13T00:00:00"), windowTo: new Date("2026-10-13T23:59:59") });
    const r = scheduleRequests([REQ()], c);
    expect(r.unscheduled).toHaveLength(1);
    expect(r.unscheduled[0].reason).toBeTruthy();
  });

  it("دو جلسه در یک اتاق هم‌زمان نمی‌شوند (بدون شرکت‌کننده مشترک)", () => {
    const r = scheduleRequests(
      [REQ({ id: "a", title: "الف", participantIds: ["u1", "u2"] }), REQ({ id: "b", title: "ب", participantIds: ["u3", "u4"] })],
      C(),
    );
    // هر دو ONSITE — اگر اتاق کوچک فقط یکی باشد، دومی اتاق بزرگ یا بعد از آن
    const rooms = r.assignments.map((a) => a.roomId);
    const [a, b] = r.assignments;
    const sameRoomSameTime = a.roomId === b.roomId && a.start < b.end && b.start < a.end;
    expect(sameRoomSameTime).toBe(false);
    expect(rooms.every(Boolean)).toBe(true);
  });

  it("۱۰۰ درخواست بدون خطا و سریع", () => {
    const reqs = Array.from({ length: 100 }, (_, i) => REQ({ id: `r${i}`, title: `جلسه ${i}`, participantIds: [`u${i % 20}`, `u${(i + 5) % 20}`] }));
    const t0 = Date.now();
    const r = scheduleRequests(reqs, C());
    expect(r.stats.total).toBe(100);
    expect(r.stats.scheduled + r.stats.unscheduled).toBe(100);
    expect(r.stats.elapsedMs).toBeLessThan(5000);
  });
});

describe("validatePlan — ویرایش دستی", () => {
  it("برنامه‌ی سالم معتبر است", () => {
    const r = scheduleRequests([REQ()], C());
    const v = validatePlan(r.assignments, C(), [REQ()]);
    expect(v.ok).toBe(true);
  });

  it("ویرایش به خارج از ساعات کاری رد می‌شود", () => {
    const v = validatePlan(
      [{ requestId: "req-1", start: new Date("2026-10-12T20:00:00"), end: new Date("2026-10-12T21:00:00"), roomId: "r1" }],
      C(),
      [REQ()],
    );
    expect(v.ok).toBe(false);
    expect(v.errors[0]?.message).toContain("ساعات کاری");
  });

  it("هم‌پوشانی شرکت‌کننده بعد از ویرایش رد می‌شود", () => {
    const base = [
      { requestId: "a", start: new Date("2026-10-12T08:00:00"), end: new Date("2026-10-12T09:00:00"), roomId: "r1" },
      { requestId: "b", start: new Date("2026-10-12T08:30:00"), end: new Date("2026-10-12T09:30:00"), roomId: "r2" },
    ];
    const v = validatePlan(base, C(), [REQ({ id: "a", participantIds: ["u1"] }), REQ({ id: "b", participantIds: ["u1"] })]);
    expect(v.ok).toBe(false);
  });
});
