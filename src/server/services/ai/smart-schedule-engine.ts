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
  createdAt: Date;
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

/**
 * امتیاز اولویت چندوجهی — بالاتر = زودتر زمان‌بندی می‌شود.
 * وزن‌ها شفاف‌اند تا ادمین بتواند گزارش «چرا این جلسه اول شد» را ببیند.
 */
export interface ScoreBreakdown {
  total: number;
  urgency: number;
  deadline: number;
  coordination: number;
  size: number;
  age: number;
}

export function priorityScoreDetailed(r: SchedRequest, now = Date.now()): ScoreBreakdown {
  const aiBoost = Math.min((r as SchedRequest & { aiBoost?: number }).aiBoost ?? 0, 30); // تحلیل AI — سقف ۳۰، ولیدیت‌شده
  const urgency = r.urgency === "URGENT" ? 100 : r.urgency === "NORMAL" ? 50 : 10;
  // نزدیکی ددلاینِ پنجره‌ی ترجیحی
  let deadline = 0;
  if (r.prefTo) {
    const hoursLeft = (r.prefTo.getTime() - now) / 3600000;
    if (hoursLeft < 24) deadline = 40;
    else if (hoursLeft < 72) deadline = 25;
    else if (hoursLeft < 168) deadline = 12;
    else if (hoursLeft < 0) deadline = 60; // از مهلت گذشته — فوری‌ترین
  }
  // سختی هماهنگی: شرکت‌کننده بیشتر = زودتر قفل شود
  const coordination = Math.min(r.participantIds.length, 8) * 4;
  // جلسه‌ی بزرگ (نفرات)
  const size = Math.min(r.attendeeCount ?? 0, 10) * 2;
  // قدیمی‌تر بودن درخواست (روزهای منتظر‌مانده) — انصاف FIFO
  const age = Math.min(Math.floor((now - r.createdAt.getTime()) / 86400000), 7) * 3;
  return { total: urgency + deadline + coordination + size + age + aiBoost, urgency, deadline, coordination, size, age };
}

export function priorityScore(r: SchedRequest): number {
  return priorityScoreDetailed(r).total;
}

/** توضیح شفاف «چرا این زمان» — بر اساس تصمیم‌های واقعی موتور */
function buildReason(r: SchedRequest, start: Date, d: ScoreBreakdown): string {
  const parts: string[] = [];
  if (d.deadline >= 40) parts.push("ددلاین نزدیک");
  if (r.urgency === "URGENT") parts.push("فوری — صبحِ نزدیک‌ترین روز");
  if (r.prefFrom && r.prefTo) {
    const min = start.getHours() * 60 + start.getMinutes();
    const pf = r.prefFrom.getHours() * 60 + r.prefFrom.getMinutes();
    const pt = r.prefTo.getHours() * 60 + r.prefTo.getMinutes();
    if (min >= pf && min <= pt) parts.push("داخل پنجره‌ی ترجیحی");
    else parts.push("نزدیک به پنجره‌ی ترجیحی");
  }
  const hour = start.getHours();
  if (hour >= 9 && hour < 12) parts.push("بازه‌ی پرانرژی صبح");
  else if (hour >= 13 && hour < 16) parts.push("بعدازظهر کاری");
  if (d.coordination >= 16) parts.push("هماهنگی شرکت‌کنندگان زیاد");
  if (parts.length === 0) parts.push("بهترین اسلات مشترک آزاد");
  return parts.join(" · ");
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
 * امتیاز کیفیتِ یک اسلاتِ معتبر برای یک درخواست — بالاتر = بهتر.
 * معیارها:
 *  - نزدیکی به پنجره/اسلات ترجیحی درخواست
 *  - فوری‌ها صبح و زودتر در بازه
 *  - انرژی‌بخشی: جلسات مهم‌تر در بازه‌ی پرانرژی (۹ تا ۱۲)
 *  - توزیع بار: روزِ خلوت‌تر بهتر
 *  - جریمه‌ی چسبیدن به ساعت ناهار
 */
function slotQuality(
  start: Date,
  r: SchedRequest,
  c: SchedConstraints,
  dayLoad: Map<string, number>,
): number {
  let q = 0;
  const min = start.getHours() * 60 + start.getMinutes();

  // ۱. نزدیکی به ترجیح درخواست
  if (r.prefFrom && r.prefTo) {
    const pf = r.prefFrom.getHours() * 60 + r.prefFrom.getMinutes();
    const pt = r.prefTo.getHours() * 60 + r.prefTo.getMinutes();
    if (min >= pf && min <= pt) q += 30; // داخل پنجره
    else q -= Math.min(Math.abs(min - pf), Math.abs(min - pt)) / 8;
  }
  if (r.prefSlots?.length) {
    const inside = r.prefSlots.some((sl) => {
      const f = new Date(sl.from);
      const t = new Date(sl.to);
      return start >= f && new Date(start.getTime() + r.durationMin * 60000) <= t;
    });
    if (inside) q += 30;
  }

  // ۲. فوری‌ها: زودتر در بازه + صبح
  if (r.urgency === "URGENT") {
    q += Math.max(0, 20 - (start.getTime() - c.windowFrom.getTime()) / (86400000 * 2));
    if (min < 12 * 60) q += 8;
  }

  // ۳. پرانرژی ۹–۱۲ برای همه (جز FLEXIBLE)
  if (min >= 9 * 60 && min < 12 * 60) q += r.urgency === "FLEXIBLE" ? 3 : 10;
  if (min >= 13 * 60 && min < 16 * 60) q += 4;
  if (min >= 12 * 60 && min < 13 * 60) q -= 12; // چسبیده به ناهار

  // ۴. توزیع بار روزها
  const dkey = fmtLocal(start);
  q -= Math.min((dayLoad.get(dkey) ?? 0) * 2.5, 25);

  // ۵. شنبه/چهارشنبه جریمه‌ی ملایم (اول و انتهای هفته کاری)
  const wd = start.getDay();
  if (wd === 6 || wd === 3) q -= 4;

  return q;
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

  // بار روزها برای توزیع
  const dayLoad = new Map<string, number>();
  for (const b of c.busy) {
    const k = fmtLocal(b.from);
    dayLoad.set(k, (dayLoad.get(k) ?? 0) + 1);
  }

  for (const r of sorted) {
    let lastReason = "زمان معتبری در بازه یافت نشد";
    let roomReason: string | null = null; // علت اتاق مهم‌تر است
    const alternatives: { start: Date; end: Date }[] = [];
    let best: { start: Date; end: Date; roomId: string | null; q: number } | null = null;

    for (const start of gridStarts) {
      const end = new Date(start.getTime() + r.durationMin * 60000);
      if (end > c.windowTo) continue;

      const ruleErr = withinRules(start, end, c, r);
      if (ruleErr) { lastReason = ruleErr; continue; }
      const confErr = participantConflict(start, end, r.participantIds, c.busy, assignments, reqMap);
      if (confErr) { lastReason = confErr; continue; }

      // اتاق: کوچک‌ترین اتاق مناسبِ آزاد
      let roomId: string | null = null;
      if (r.venue === "ONSITE") {
        const need = Math.max(2, (r.participantIds.length || 1) + 1);
        const room = c.rooms
          .filter((rm) => rm.active && rm.capacity >= need)
          .sort((a, b) => a.capacity - b.capacity)
          .find((rm) => roomAvailable(rm.id, start, end, roomBusy, assignments));
        if (!room) { roomReason = "اتاق خالی با ظرفیت کافی نیست"; continue; }
        roomId = room.id;
      }

      const q = slotQuality(start, r, c, dayLoad);
      if (alternatives.length < 3) alternatives.push({ start: new Date(start), end: new Date(end) });
      if (!best || q > best.q) best = { start: new Date(start), end: new Date(end), roomId, q };
    }

    if (best) {
      const d = priorityScoreDetailed(r);
      assignments.push({
        requestId: r.id,
        start: best.start,
        end: best.end,
        roomId: best.roomId,
        priorityScore: d.total,
        reason: buildReason(r, best.start, d),
      });
      const k = fmtLocal(best.start);
      dayLoad.set(k, (dayLoad.get(k) ?? 0) + 1);
    } else {
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
