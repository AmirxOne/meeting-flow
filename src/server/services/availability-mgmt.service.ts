import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { notificationService } from "./notification.service";

/**
 * ─── اعلام زمان‌های آزاد افراد (Availability Management) ───
 * Scheduler در worker tick اجرا می‌شود؛ منطق خالص این‌جاست تا تست‌پذیر باشد.
 */

const TEHRAN = "Asia/Tehran";

export interface SlotInput {
  date: string; // YYYY-MM-DD (تقویم شمسی در UI — این‌جا ISO می‌آید)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface SubmitInput {
  requestId: string;
  slots: SlotInput[];
}

// ─── Time helpers (Tehran-aware via Intl, no deps) ───

function tehranParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) parts[p.type] = p.value;
  return parts;
}

/** روز جاری تهران به‌صورت YYYY-MM-DD */
export function tehranToday(): string {
  const p = tehranParts(new Date());
  return `${p.year}-${p.month}-${p.day}`;
}

/** شماره‌ی روز هفته به سبک پروژه: 0=شنبه … 6=جمعه */
export function tehranWeekday(dateIso: string): number {
  // JS: 0=Sunday…6=Saturday → تبدیل به 0=شنبه
  const js = new Date(dateIso + "T12:00:00Z").getUTCDay();
  return (js + 1) % 7;
}

/** شنبه‌ی هفته‌ی مربوط به یک تاریخ (YYYY-MM-DD) */
export function saturdayOf(dateIso: string): string {
  const wd = tehranWeekday(dateIso);
  const d = new Date(dateIso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - wd);
  return d.toISOString().slice(0, 10);
}

/** بازه‌ی هدف: هفته‌ای یا ماهانه — تقویم شمسی مبنای ماه است */
export function periodFor(dateIso: string, periodKind: string, cadence = "WEEKLY", createDay = 3): { start: string; end: string } {
  const sat = saturdayOf(dateIso);
  if (periodKind === "THIS_WEEK") return { start: sat, end: addDays(sat, 6) };
  if (periodKind === "NEXT_WEEK") return { start: addDays(sat, 7), end: addDays(sat, 13) };
  if (periodKind === "THIS_MONTH" || periodKind === "NEXT_MONTH") {
    const m = monthOf(dateIso); // {y, m} شمسی
    const target = periodKind === "NEXT_MONTH" ? addJalaliMonth(m, 1) : m;
    const start = jalaliToIso(target.y, target.m, 1);
    const end = jalaliToIso(target.y, target.m, jalaliMonthLength(target.y, target.m));
    return { start, end };
  }
  // پیش‌فرض WEEKLY/NEXT_WEEK
  return { start: addDays(sat, 7), end: addDays(sat, 13) };
}

/** تبدیل تاریخ میلادی به سال/ماه شمسی با Intl */
function monthOf(dateIso: string): { y: number; m: number } {
  const p = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    timeZone: "UTC", year: "numeric", month: "numeric",
  }).formatToParts(new Date(dateIso + "T12:00:00Z"));
  const o: Record<string, string> = {};
  for (const x of p) o[x.type] = x.value;
  return { y: Number(o.year.replace(/[^0-9]/g, "")), m: Number(o.month) };
}

function addJalaliMonth(m: { y: number; m: number }, n: number): { y: number; m: number } {
  const t = m.m - 1 + n;
  return { y: m.y + Math.floor(t / 12), m: (t % 12 + 12) % 12 + 1 };
}

function jalaliMonthLength(y: number, m: number): number {
  // ۱ تا ۶ = ۳۱ روز، ۷ تا ۱۱ = ۳۰ روز، اسفند جدا
  if (m <= 6) return 31;
  if (m <= 11) return 30;
  // اسفند: کبیسه‌ی ۳۳-ساله‌ی معروف
  const rem = ((y % 33) + 33) % 33;
  const leap = [1, 5, 9, 13, 17, 22, 26, 30].includes(rem);
  return leap ? 30 : 29;
}

/** شمسی → میلادی ISO (با جست‌وجوی معکوس روی monthOf — بدون dependency) */
function jalaliToIso(jy: number, jm: number, jd: number): string {
  // حدود میلادی: فروردین ۱ ≈ مارس ۲۱
  let gy = jy + 621;
  let guess = new Date(Date.UTC(gy, 2, 21 + (jm - 1) * 31)); // برآیند اولیه
  for (let i = 0; i < 60; i++) {
    const iso = guess.toISOString().slice(0, 10);
    const cur = monthOf(iso);
    if (cur.y === jy && cur.m === jm) {
      // روز درست را در همین ماه پیدا کن
      const d = new Date(iso + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + (jd - 1));
      const finalIso = d.toISOString().slice(0, 10);
      const f = monthOf(finalIso);
      if (f.y === jy && f.m === jm) return finalIso;
      // لبه‌ی ماه — یک روز عقب
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    }
    guess = new Date(guess.getTime() + 86400000 * 5);
  }
  return guess.toISOString().slice(0, 10);
}

function addDays(dateIso: string, n: number): string {
  const d = new Date(dateIso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isoToUtc(dateIso: string): Date {
  // تاریخ‌های تقویمی را نیم‌روز UTC ذخیره می‌کنیم تا تغییر TZ رندر را نشکند
  return new Date(dateIso + "T12:00:00Z");
}

// ─── Validation (backend, same rules as the form) ───

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateSlots(slots: SlotInput[], period: { start: string; end: string }): string | null {
  if (!Array.isArray(slots) || slots.length === 0) return "حداقل یک بازه‌ی زمانی لازم است";
  const byDay = new Map<string, SlotInput[]>();
  for (const s of slots) {
    if (!DATE_RE.test(s.date)) return "تاریخ بازه معتبر نیست";
    if (s.date < period.start || s.date > period.end) return "بازه‌ی زمانی خارج از محدوده‌ی درخواست است";
    if (!TIME_RE.test(s.startTime) || !TIME_RE.test(s.endTime)) return "ساعت واردشده معتبر نیست";
    if (s.startTime >= s.endTime) return "ساعت شروع باید قبل از ساعت پایان باشد";
    const arr = byDay.get(s.date) ?? [];
    arr.push(s);
    byDay.set(s.date, arr);
  }
  // overlap check per day
  for (const [date, arr] of byDay) {
    const sorted = [...arr].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startTime < sorted[i - 1].endTime) {
        return `بازه‌های روز ${date} هم‌پوشانی دارند`;
      }
    }
  }
  return null;
}

// ─── Config ───

export async function getOrCreateConfig(orgId: string) {
  const existing = await prisma.availabilityConfig.findUnique({ where: { orgId } });
  if (existing) return existing;
  return prisma.availabilityConfig.create({ data: { orgId } });
}

export async function setMembers(orgId: string, actorId: string, userIds: string[], remove: boolean) {
  const config = await getOrCreateConfig(orgId);
  if (remove) {
    await prisma.availabilityMember.updateMany({
      where: { orgId, userId: { in: userIds }, removedAt: null },
      data: { removedAt: new Date() },
    });
    return { config, changed: userIds.length };
  }
  // اعضای جدید — فقط Userهای همان سازمان
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, orgId, isActive: true },
    select: { id: true },
  });
  for (const u of users) {
    await prisma.availabilityMember.upsert({
      where: { orgId_userId: { orgId, userId: u.id } },
      create: { orgId, userId: u.id, addedById: actorId, configId: config.id },
      update: { removedAt: null, configId: config.id },
    });
  }
  return { config, changed: users.length };
}

// ─── Scheduler ───

export interface AvailabilityTickResult {
  created: number;
  notified: number;
  expired: number;
}

/**
 * در هر worker tick صدا زده می‌شود:
 * 1) برای هر سازمانِ فعال، اگر امروز روزِ createDay است و request بازه‌ی هدف ساخته نشده → بساز + نوتیف
 * 2) requestهای PENDING با deadline گذشته → OVERDUE
 */
export async function processAvailability(): Promise<AvailabilityTickResult> {
  const result: AvailabilityTickResult = { created: 0, notified: 0, expired: 0 };

  const configs = await prisma.availabilityConfig.findMany({
    where: { isActive: true },
    include: { members: { where: { removedAt: null }, include: { user: { select: { id: true, isActive: true } } } } },
  });

  const today = tehranToday();
  const todayWd = tehranWeekday(today);

  for (const config of configs) {
    // فقط در روزِ تعیین‌شده — WEEKLY: روز هفته | MONTHLY: روزِ ماه
    if (config.cadence === "MONTHLY") {
      const dom = Number(today.slice(8, 10)); // روز ماه میلادیِ تهران ≈ روز شمسی برای اسکجول روز ۱/۵/۱۰/۱۵/۲۵؟ نه — دقیق‌تر:
      const jToday = monthOf(today);
      const jDay = Number(new Intl.DateTimeFormat("en-US-u-ca-persian", { timeZone: "UTC", day: "numeric" }).format(new Date(today + "T12:00:00Z")).replace(/[^0-9]/g, ""));
      void dom; void jToday;
      if (jDay !== config.createDay) continue;
    } else if (todayWd !== config.createDay) continue;
    const period = periodFor(today, config.periodKind, config.cadence, config.createDay);
    const deadline = computeDeadline(today, config.deadlineDayOffset, config.deadlineMinutes);

    for (const member of config.members) {
      if (!member.user.isActive) continue; // کاربر غیرفعال → رد
      // idempotency: یک request به‌ازای user+period
      const existing = await prisma.availabilityRequest.findFirst({
        where: { userId: member.userId, periodStart: isoToUtc(period.start), periodEnd: isoToUtc(period.end) },
      });
      if (existing) continue;

      await prisma.availabilityRequest.create({
        data: {
          orgId: config.orgId,
          userId: member.userId,
          configId: config.id,
          periodStart: isoToUtc(period.start),
          periodEnd: isoToUtc(period.end),
          deadline,
          status: "PENDING",
        },
      });
      result.created += 1;

      try {
        await notificationService.availabilityRequested(member.userId, period, deadline);
        result.notified += 1;
      } catch {
        /* notification must never break the request creation */
      }
    }
  }

  // deadline enforcement
  const expired = await prisma.availabilityRequest.updateMany({
    where: { status: "PENDING", deadline: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });
  result.expired = expired.count;

  return result;
}

function computeDeadline(todayIso: string, dayOffset: number, minutes: number): Date {
  const day = addDays(todayIso, dayOffset);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  // دقیقه‌ی روز تهران → UTC (‎+3:30)
  const utcH = ((h - 3) % 24 + 24) % 24;
  const utcM = m - 30 >= 0 ? m - 30 : m + 30;
  const utcHAdj = m - 30 >= 0 ? utcH : (utcH - 1 + 24) % 24;
  const d = new Date(day + "T00:00:00Z");
  d.setUTCHours(utcHAdj, utcM, 0, 0);
  return d;
}

// ─── Query helpers ───

export async function myPendingRequest(userId: string, orgId: string) {
  return prisma.availabilityRequest.findFirst({
    where: { userId, orgId, status: "PENDING", deadline: { gte: new Date() } },
    orderBy: { deadline: "asc" },
  });
}

export async function myRequests(userId: string, orgId: string) {
  return prisma.availabilityRequest.findMany({
    where: { userId, orgId },
    orderBy: { periodStart: "desc" },
    take: 12,
  });
}

export async function orgRequests(orgId: string) {
  return prisma.availabilityRequest.findMany({
    where: { orgId },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      submittedBy: { select: { id: true, fullName: true } },
      _count: { select: { slots: true } },
    },
    orderBy: { periodStart: "desc" },
    take: 100,
  });
}

// ─── Submit (user خودش یا admin از طرف او) ───

export async function submitAvailability(
  requestId: string,
  actorId: string,
  slots: SlotInput[],
  opts: { isAdmin: boolean },
) {
  const req = await prisma.availabilityRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new HttpError(404, "درخواست یافت نشد", "NOT_FOUND");

  const isOwner = req.userId === actorId;
  if (!isOwner && !opts.isAdmin) {
    throw new HttpError(403, "فقط خود کاربر یا مدیر می‌تواند ثبت کند", "FORBIDDEN");
  }

  if (req.status === "CLOSED" || req.status === "SUBMITTED") {
    throw new HttpError(409, "این درخواست قبلاً تکمیل شده است", "ALREADY_SUBMITTED");
  }
  // deadline: فقط admin می‌تواند بعد از ددلاین ثبت/ویرایش کند
  if (req.deadline < new Date() && !opts.isAdmin) {
    throw new HttpError(403, "مهلت ثبت گذشته است", "DEADLINE_PASSED");
  }

  const period = { start: req.periodStart.toISOString().slice(0, 10), end: req.periodEnd.toISOString().slice(0, 10) };
  const error = validateSlots(slots, period);
  if (error) throw new HttpError(400, error, "VALIDATION_ERROR");

  return prisma.$transaction(async (tx) => {
    await tx.availabilitySlot.deleteMany({ where: { requestId } });
    await tx.availabilitySlot.createMany({
      data: slots.map((s) => ({
        requestId,
        date: isoToUtc(s.date),
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    });
    return tx.availabilityRequest.update({
      where: { id: requestId },
      data: { status: "SUBMITTED", submittedAt: new Date(), submittedById: actorId },
      include: { slots: true, user: { select: { id: true, fullName: true } } },
    });
  });
}

export async function getRequestWithSlots(requestId: string) {
  return prisma.availabilityRequest.findUnique({
    where: { id: requestId },
    include: {
      slots: { orderBy: [{ date: "asc" }, { startTime: "asc" }] },
      user: { select: { id: true, fullName: true, email: true } },
      submittedBy: { select: { id: true, fullName: true } },
    },
  });
}
