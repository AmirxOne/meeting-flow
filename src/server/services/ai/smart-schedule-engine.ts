/**
 * ═══════════════════════════════════════════════════════════════
 *  Smart Scheduling Engine — زمان‌بندی هوشمند درخواست‌های جلسه
 * ═══════════════════════════════════════════════════════════════
 * مسئله = Constraint Scheduling؛ تخصیص زمان توسط «کد» انجام می‌شود
 * (نه LLM). AI فقط نقش تحلیلی دارد: اولویت‌بندی/توضیح (در سرویس
 * بالاتر). این فایل موتور خالص و تست‌پذیر است.
 *
 * ورودی: درخواست‌های OPEN + بازه + قوانین (ساعات کاری، تعطیلات،
 * جلسات موجود شرکت‌کنندگان، ظرفیت اتاق‌ها).
 * خروجی: تخصیص‌ها + درخواست‌های زمان‌بندی‌نشده با علت.
 *
 * قوانین اجباری (هرگز نقض نمی‌شوند):
 *  ۱. هم‌پوشانی شرکت‌کننده ممنوع
 *  ۲. خارج از ساعات کاری/تعطیلات ممنوع
 *  ۳. خارج از بازه‌ی انتخابی ادمین ممنوع
 *  ۴. مدت دقیق رعایت شود
 *  ۵. بدون اتاقِ خالی جلسه ONSITE رزرو نمی‌شود
 *  ۶. زمان جعلی تولید نمی‌شود — جا نشد = «زمان‌بندی‌نشده» + علت
 */

/** بازه‌ی ۱۵ دقیقه‌ای — واحد گرید زمان‌بندی */
const STEP_MIN = 15;

export interface SchedRequest {
  id: string;
  title: string;
  urgency: string; // URGENT | NORMAL | FLEXIBLE
  durationMin: number;
  prefFrom: Date | null;
  prefTo: Date | null;
  prefSlots: { from: string; to: string }[] | null;
  participantIds: string[];
  attendeeCount: number | null;
  venue: string; // ONSITE | OFFSITE
}

export interface SchedBusy {
  /** بازه‌های اشغال شرکت‌کنندگان از جلسات ثبت‌شده */
  userId: string;
  from: Date;
  to: Date;
}

export interface SchedRoom {
  id: string;
  branchId: string | null;
  capacity: number;
  active: boolean;
  name?: string;
}

export interface SchedConstraints {
  windowFrom: Date;
  windowTo: Date;
  /** ساعات کاری به دقیقه‌ی از نیمه‌شب (زمان محلی) */
  workStartMin: number;
  workEndMin: number;
  /** روزهای هفته‌ی کاری 0=یکشنبه…6=شنبه (بر اساس getDay) */
  workDays: number[];
  /** ISO تاریخ‌های تعطیل */
  holidaysIso: Set<string>;
  /** وضعیت فعال/غیرفعال اتاق */
  rooms: SchedRoom[];
  busy: SchedBusy[];
}

export interface SchedAssignment {
  requestId: string;
  start: Date;
  end: Date;
  roomId: string | null; // null = OFFSITE یا بدون اتاق
  /** امتیاز اولویت برای شفافیت */
  priorityScore: number;
  /** توضیح کوتاه چرا این زمان */
  reason: string;
}

export interface SchedResult {
  assignments: SchedAssignment[];
  unscheduled: { requestId: string; title: string; reason: string; alternatives?: { start: Date; end: Date }[] }[];
  stats: { total: number; scheduled: number; unscheduled: number; elapsedMs: number };
}

/** امتیاز اولویت — شفاف و قابل‌تست؛ بالاتر = زودتر زمان‌بندی می‌شود */
export function priorityScore(r: SchedRequest): number {
  let s = 0;
  if (r.urgency === "URGENT") s += 100;
  else if (r.urgency === "NORMAL") s += 50;
  // پنجره‌ی ترجیحی نزدیک‌تر = فوریت بیشتر
  if (r.prefFrom) {
    const daysLeft = (r.prefFrom.getTime() - Date.now()) / 86400000;
    if (daysLeft < 1) s += 40;
    else if (daysLeft < 3) s += 25;
    else if (daysLeft < 7) s += 10;
  }
  // شرکت‌کننده بیشتر = هماهنگی سخت‌تر = زودتر قفل شود
  s += Math.min(r.participantIds.length, 8) * 3;
  return s;
}

function fmtLocal(d: Date): string {
  // YYYY-MM-DD در زمان محلی برای چک تعطیلات
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayStartMin(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function overlaps(aS: number, aE: number, bS: number, bE: number): boolean {
  return aS < bE && bS < aE;
}

/** آیا بازه [start,end) در قوانین اجباری می‌گنجد؟ (ساعت کاری/روز کاری/تعطیلی/پنجره) */
function withinRules(start: Date, end: Date, c: SchedConstraints, r: SchedRequest): string | null {
  if (start < c.windowFrom || end > c.windowTo) return "خارج از بازه‌ی انتخابی";
  const day = start.getDay();
  if (!c.workDays.includes(day)) return "روز غیرکاری";
  if (c.holidaysIso.has(fmtLocal(start))) return "تعطیل رسمی";
  const s = dayStartMin(start);
  const e = s + (end.getTime() - start.getTime()) / 60000;
  if (s < c.workStartMin || e > c.workEndMin) return "خارج از ساعات کاری";
  // پنجره‌ی ترجیحی — اجباری اگر requester پنجره داده باشد
  if (r.prefFrom && r.prefTo) {
    if (start < r.prefFrom || end > r.prefTo) return "خارج از پنجره‌ی ترجیحی درخواست";
  }
  if (r.prefSlots?.length) {
    const ok = r.prefSlots.some((sl) => {
      const f = new Date(sl.from);
      const t = new Date(sl.to);
      return start >= f && end <= t;
    });
    if (!ok) return "خارج از اسلات‌های ترجیحی درخواست";
  }
  return null;
}

/** تداخل شرکت‌کننده با جلسات موجود یا تخصیص‌های همین دور */
function participantConflict(start: Date, end: Date, participantIds: string[], busy: SchedBusy[], assigned: { requestId: string; start: Date; end: Date }[], allReqs: Map<string, SchedRequest>): string | null {
  for (const uid of participantIds) {
    for (const b of busy) {
      if (b.userId !== uid) continue;
      if (overlaps(start.getTime(), end.getTime(), b.from.getTime(), b.to.getTime())) return "تداخل با جلسه‌ی ثبت‌شده‌ی شرکت‌کننده";
    }
  }
  for (const a of assigned) {
    const other = allReqs.get(a.requestId);
    if (!other) continue;
    const shared = other.participantIds.some((u) => participantIds.includes(u));
    if (shared && overlaps(start.getTime(), end.getTime(), a.start.getTime(), a.end.getTime())) return "تداخل با تخصیص همین برنامه";
  }
  return null;
}

function roomAvailable(
  roomId: string,
  start: Date,
  end: Date,
  roomBusy: { roomId: string; from: Date; to: Date }[],
  assigned: { requestId: string; roomId: string | null; start: Date; end: Date }[],
): boolean {
  for (const rb of roomBusy) {
    if (rb.roomId === roomId && overlaps(start.getTime(), end.getTime(), rb.from.getTime(), rb.to.getTime())) return false;
  }
  for (const a of assigned) {
    if (a.roomId === roomId && overlaps(start.getTime(), end.getTime(), a.start.getTime(), a.end.getTime())) return false;
  }
  return true;
}

/**
 * موتور اصلی — Greedy با اولویت + گرید ۱۵ دقیقه‌ای.
 * برای ۱۰۰+ درخواست کافی است (هر درخواست × اسلات‌های بازه).
 */
export function scheduleRequests(requests: SchedRequest[], c: SchedConstraints, roomBusy: { roomId: string; from: Date; to: Date }[] = []): SchedResult {
  const t0 = Date.now();
  const assignments: SchedAssignment[] = [];
  const unscheduled: SchedResult["unscheduled"] = [];
  const reqMap = new Map(requests.map((r) => [r.id, r]));

  // ۱. اولویت‌بندی — نزولی
  const sorted = [...requests].sort((a, b) => priorityScore(b) - priorityScore(a));

  // گرید: شروع‌های ممکن ۱۵ دقیقه‌ای داخل بازه
  const gridStarts: Date[] = [];
  const g = new Date(c.windowFrom);
  g.setSeconds(0, 0);
  // رُند به گرید ۱۵ دقیقه‌ای بالا
  const offset = g.getMinutes() % STEP_MIN;
  if (offset !== 0) g.setMinutes(g.getMinutes() + (STEP_MIN - offset));
  while (g < c.windowTo) {
    gridStarts.push(new Date(g));
    g.setMinutes(g.getMinutes() + STEP_MIN);
  }

  for (const r of sorted) {
    let placed = false;
    let lastReason = "زمان معتبری در بازه یافت نشد";
    let roomReason: string | null = null; // علت اتاق مهم‌تر است — زمان کاری هست ولی اتاق نیست
    const alternatives: { start: Date; end: Date }[] = [];

    for (const start of gridStarts) {
      const end = new Date(start.getTime() + r.durationMin * 60000);
      if (end > c.windowTo) continue;

      const ruleErr = withinRules(start, end, c, r);
      if (ruleErr) { lastReason = ruleErr; continue; }
      const confErr = participantConflict(start, end, r.participantIds, c.busy, assignments, reqMap);
      if (confErr) { lastReason = confErr; continue; }

      // اتاق: فقط ONSITE و با نیاز به ظرفیت — اولین اتاق آزاد
      let roomId: string | null = null;
      if (r.venue === "ONSITE") {
        const need = Math.max(2, (r.participantIds.length || 1) + 1);
        const room = c.rooms
          .filter((rm) => rm.active && rm.capacity >= need)
          .sort((a, b) => a.capacity - b.capacity) // کوچک‌ترین مناسب — اتاق بزرگ برای جمعیت بزرگ بماند
          .find((rm) => roomAvailable(rm.id, start, end, roomBusy, assignments));
        if (!room) { roomReason = "اتاق خالی با ظرفیت کافی نیست"; continue; }
        roomId = room.id;
      }

      if (alternatives.length < 3) alternatives.push({ start: new Date(start), end: new Date(end) });
      if (!placed) {
        assignments.push({
          requestId: r.id,
          start: new Date(start),
          end: new Date(end),
          roomId,
          priorityScore: priorityScore(r),
          reason: r.urgency === "URGENT"
            ? "فوری — نزدیک‌ترین زمان ممکن"
            : r.prefFrom
              ? "نزدیک به پنجره‌ی ترجیحی"
              : "اولین زمان مشترک آزاد",
        });
        placed = true;
        break; // اولین اسلات معتبر = گیری
      }
    }
    if (!placed) {
      unscheduled.push({ requestId: r.id, title: r.title, reason: roomReason ?? lastReason, alternatives: alternatives.slice(0, 2) });
    }
  }

  return {
    assignments,
    unscheduled,
    stats: { total: requests.length, scheduled: assignments.length, unscheduled: unscheduled.length, elapsedMs: Date.now() - t0 },
  };
}

/** اعتبارسنجی مجدد یک برنامه (بعد از ویرایش دستی ادمین) — بدون تغییر وضعیت‌ها */
export function validatePlan(
  assignments: { requestId: string; start: Date; end: Date; roomId: string | null }[],
  c: SchedConstraints,
  requests: SchedRequest[],
): { ok: boolean; errors: { requestId: string; message: string }[] } {
  const errors: { requestId: string; message: string }[] = [];
  const reqMap = new Map(requests.map((r) => [r.id, r]));
  for (const a of assignments) {
    const r = reqMap.get(a.requestId);
    if (!r) { errors.push({ requestId: a.requestId, message: "درخواست یافت نشد" }); continue; }
    const ruleErr = withinRules(a.start, a.end, c, r);
    if (ruleErr) errors.push({ requestId: a.requestId, message: ruleErr });
    const confErr = participantConflict(a.start, a.end, r.participantIds, c.busy, assignments.filter((x) => x.requestId !== a.requestId), reqMap);
    if (confErr) errors.push({ requestId: a.requestId, message: confErr });
  }
  // اتاق مشترک هم‌زمان
  const byRoom = new Map<string, { requestId: string; start: Date; end: Date }[]>();
  for (const a of assignments) {
    if (!a.roomId) continue;
    const arr = byRoom.get(a.roomId) ?? [];
    arr.push(a);
    byRoom.set(a.roomId, arr);
  }
  for (const [roomId, arr] of byRoom) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (overlaps(arr[i].start.getTime(), arr[i].end.getTime(), arr[j].start.getTime(), arr[j].end.getTime())) {
          errors.push({ requestId: arr[j].requestId, message: `دو جلسه در یک اتاق هم‌زمان (${roomId})` });
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
