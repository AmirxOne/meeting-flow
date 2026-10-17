/**
 * ═══════════════════════════════════════════════════════════════
 *  Appointment Service — رزرو نوبت سازمانی (روان‌شناس/HR/...)
 * ═══════════════════════════════════════════════════════════════
 * اصل معماری (طبق spec):
 *  - تعریف پنجره‌ی در دسترس ≠ رزرو اتاق؛ اسلات‌ها on-demand محاسبه می‌شوند.
 *  - آزادی اتاق و مسئول «در لحظه‌ی رزرو» دوباره چک می‌شود.
 *  - رزرو = تراکنش اتمیک: unique(programId,startAt) + findRoomConflicts
 *    + findUserConflicts + ایجاد Meeting واقعی + Booking یکجا.
 *  - محرمانگی: عنوان عمومی برای کارکنان؛ جزئیات فقط برای مجازها.
 */

import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { HttpError } from "@/server/auth/session";
import { overlaps, findRoomConflicts, findUserConflicts } from "./conflict.service";
import { audit } from "@/server/http";

/** تعارض چند اتاق در بازه — بالای findRoomConflicts تک‌اتاقی */
async function anyRoomConflict(roomIds: string[], start: Date, end: Date): Promise<Set<string>> {
  const busy = new Set<string>();
  await Promise.all(
    roomIds.map(async (rid) => {
      const cs = await findRoomConflicts(rid, start, end);
      if (cs.length > 0) busy.add(rid);
    }),
  );
  return busy;
}
import { notifyUsers } from "./notification.service";

const ACTIVE_STATUSES = ["CONFIRMED", "PENDING_APPROVAL", "IN_PROGRESS"];

interface WindowDef {
  daysOfWeek: number[]; // 0=یکشنبه…6=شنبه (JS getDay)
  from: string; // HH:MM
  to: string; // HH:MM
}

function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) throw new HttpError(400, `فرمت ساعت نامعتبر: ${s}`, "BAD_TIME");
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) throw new HttpError(400, `ساعت نامعتبر: ${s}`, "BAD_TIME");
  return h * 60 + mm;
}

/** اعتبارسنجی پنجره‌ها — قبل از ذخیره */
export function validateWindows(ws: WindowDef[], durationMin: number, bufferMin: number): void {
  if (!Array.isArray(ws) || ws.length === 0) throw new HttpError(400, "حداقل یک بازه‌ی زمانی لازم است", "NO_WINDOWS");
  for (const w of ws) {
    if (!Array.isArray(w.daysOfWeek) || w.daysOfWeek.length === 0) throw new HttpError(400, "روزهای هفته لازم است", "BAD_WINDOW");
    if (w.daysOfWeek.some((d) => d < 0 || d > 6)) throw new HttpError(400, "روز هفته نامعتبر", "BAD_WINDOW");
    const f = parseHHMM(w.from);
    const t = parseHHMM(w.to);
    if (t - f < durationMin + bufferMin) throw new HttpError(400, `بازه ${w.from}-${w.to} برای جلسه‌ی ${durationMin} دقیقه‌ای کوتاه است`, "WINDOW_TOO_SHORT");
  }
}

/** آیا کاربر مخاطبِ برنامه است؟ (سمت سرور — UI هم فیلتر می‌کند ولی این منبع حقیقت است) */
/** شناسه‌ی کاربران مخاطب یک برنامه (برای اعلان) — همه‌ی فعال‌های org یا لیست USERS */
export async function programAudienceUserIds(program: { audienceType: string; audienceIds: string[]; orgId: string }): Promise<string[]> {
  if (program.audienceType === "USERS") return program.audienceIds;
  if (program.audienceType === "BRANCH") {
    const users = await prisma.user.findMany({ where: { orgId: program.orgId, isActive: true, branchId: { in: program.audienceIds } }, select: { id: true } });
    return users.map((u) => u.id);
  }
  const users = await prisma.user.findMany({ where: { orgId: program.orgId, isActive: true }, select: { id: true } });
  return users.map((u) => u.id);
}

/** ثبت پاسخ کاربر به برنامه: DECLINED (شرکت نمی‌کنم) */
export async function respondToProgram(programId: string, user: { id: string; orgId: string }, response: "DECLINED") {
  const program = await prisma.appointmentProgram.findUnique({ where: { id: programId } });
  if (!program || program.orgId !== user.orgId) throw new HttpError(404, "برنامه یافت نشد", "NOT_FOUND");
  if (!(await canAccessProgram(user, program))) throw new HttpError(403, "دسترسی به این برنامه ندارید", "FORBIDDEN");
  await prisma.appointmentResponse.upsert({
    where: { programId_userId: { programId, userId: user.id } },
    create: { orgId: user.orgId, programId, userId: user.id, response },
    update: { response },
  });
  return { ok: true };
}

/** کارت داشبورد: برنامه‌های «پاسخ‌نداده» برای این کاربر (جدیدترین اول) */
export async function pendingProgramInvites(user: { id: string; orgId: string; branchId?: string | null }) {
  const programs = await prisma.appointmentProgram.findMany({
    where: { orgId: user.orgId, status: "ACTIVE", validTo: { gte: new Date() }, hostId: { not: user.id } },
    include: { host: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const responded = await prisma.appointmentResponse.findMany({
    where: { userId: user.id, programId: { in: programs.map((p) => p.id) } },
    select: { programId: true, response: true },
  });
  // رزرو فعال هم «پاسخ» است — کارت را نشان نده
  const booked = await prisma.appointmentBooking.findMany({
    where: { userId: user.id, programId: { in: programs.map((p) => p.id) }, status: "BOOKED", startAt: { gte: new Date() } },
    select: { programId: true },
  });
  const respondedMap = new Map(responded.map((r) => [r.programId, r.response]));
  for (const b of booked) respondedMap.set(b.programId, "BOOKED");
  const out = [];
  for (const p of programs) {
    if (respondedMap.has(p.id)) continue; // پاسخ داده (DECLINED یا رزرو کرده) → دیگر نمایش نده
    if (!(await canAccessProgram(user, p))) continue;
    out.push({
      id: p.id,
      title: p.title,
      hostName: p.host.fullName,
      durationMin: p.durationMin,
      validTo: p.validTo,
      windows: p.windows,
      isConfidential: p.isConfidential,
    });
  }
  return out.slice(0, 3);
}

export async function canAccessProgram(
  user: { id: string; orgId: string; branchId?: string | null },
  program: { audienceType: string; audienceIds: string[]; orgId: string; hostId?: string },
): Promise<boolean> {
  if (program.orgId !== user.orgId) return false;
  // میزبان برنامه همیشه دسترسی دارد
  if (program.hostId && program.hostId === user.id) return true;
  if (program.audienceType === "ALL") return true;
  if (program.audienceType === "USERS") return program.audienceIds.includes(user.id);
  if (program.audienceType === "BRANCH") {
    if (!user.branchId) return false;
    return program.audienceIds.includes(user.branchId);
  }
  return false;
}

/**
 * محاسبه‌ی اسلات‌های قابل رزرو برای یک برنامه در بازه‌ی [from,to].
 * هر اسلات: معتبرِ پنجره + آینده + اتاقِ آزاد + مسئول آزاد + رزرونشده.
 */
export async function computeAvailableSlots(programId: string, viewer: { id: string; orgId: string; branchId?: string | null }, from: Date, to: Date) {
  const program = await prisma.appointmentProgram.findUnique({
    where: { id: programId },
    include: { bookings: { where: { status: "BOOKED" } } },
  });
  if (!program || program.orgId !== viewer.orgId) throw new HttpError(404, "برنامه یافت نشد", "NOT_FOUND");
  if (!(await canAccessProgram(viewer, program))) throw new HttpError(403, "دسترسی به این برنامه ندارید", "FORBIDDEN");
  if (program.status !== "ACTIVE") return { program: publicProgram(program), slots: [] };

  const windows = (program.windows as unknown as WindowDef[]) ?? [];
  const step = program.durationMin + program.bufferMin;
  const booked = new Set(program.bookings.map((b) => b.startAt.toISOString()));

  // جلسات متعارضِ مسئول (هر جلسه‌ای که host شرکت‌کننده/برگزارکننده است)
  const hostBusy = await prisma.meeting.findMany({
    where: {
      orgId: program.orgId,
      status: { in: ACTIVE_STATUSES },
      startAt: { lte: to },
      endAt: { gte: from },
      OR: [{ organizerId: program.hostId }, { participants: { some: { userId: program.hostId } } }],
    },
    select: { startAt: true, endAt: true },
  });

  // جلساتِ اتاق‌های برنامه در کل بازه — یک‌بار fetch، بررسی per-slot در حافظه
  const roomMeetings = await prisma.meeting.findMany({
    where: {
      roomId: { in: program.roomIds },
      status: { in: ACTIVE_STATUSES },
      startAt: { lte: to },
      endAt: { gte: from },
    },
    select: { startAt: true, endAt: true },
  });

  const slots: { startAt: Date; endAt: Date }[] = [];
  const cur = new Date(Math.max(from.getTime(), Date.now()));
  cur.setSeconds(0, 0);
  cur.setMinutes(Math.ceil(cur.getMinutes() / 5) * 5);

  while (cur < to) {
    const day = cur.getDay();
    const minOfDay = cur.getHours() * 60 + cur.getMinutes();
    const inWindow = windows.some((w) => {
      if (!w.daysOfWeek.includes(day)) return false;
      const f = parseHHMM(w.from);
      const t = parseHHMM(w.to);
      // گرید از «شروع پنجره» با قدمِ (مدت+فاصله) — cursor روی دقیقه‌ی فاصله از نیم‌شب چک می‌شود
      return minOfDay >= f && minOfDay + program.durationMin <= t && (minOfDay - f) % step === 0;
    });
    if (!inWindow) { cur.setMinutes(cur.getMinutes() + 5); continue; }

    const end = new Date(cur.getTime() + program.durationMin * 60000);
    const iso = cur.toISOString();
    if (!booked.has(iso)) {
      const hostFree = !hostBusy.some((b) =>
        cur.getTime() < b.endAt.getTime() && b.startAt.getTime() < end.getTime(),
      );
      if (hostFree) {
        // اتاق آزاد در همین لحظه (نمایش) — قطعیت فقط هنگام رزرو
        const roomFree = !roomMeetings.some((m) =>
          cur.getTime() < m.endAt.getTime() && m.startAt.getTime() < end.getTime(),
        );
        if (roomFree) slots.push({ startAt: new Date(cur), endAt: end });
      }
    }
    cur.setMinutes(cur.getMinutes() + step);
  }

  return { program: publicProgram(program), slots };
}

/** نمای عمومی برنامه — محرمانگی: بدون idهای داخلی حساس */
function publicProgram(p: {
  id: string; title: string; description: string | null; topics: unknown;
  durationMin: number; bufferMin: number; validFrom: Date; validTo: Date;
  status: string; isConfidential: boolean; hostId: string; roomIds: string[];
  host?: { fullName: string };
}) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    topics: p.topics,
    durationMin: p.durationMin,
    bufferMin: p.bufferMin,
    validFrom: p.validFrom,
    validTo: p.validTo,
    status: p.status,
    isConfidential: p.isConfidential,
    hostName: p.host?.fullName ?? "مسئول جلسه",
    // نام اتاق فقط هنگام رزرو قطعی انتخاب می‌شود — از افشای برنامه‌ی اتاق جلوگیری
    roomCount: p.roomIds.length,
  };
}

/**
 * رزرو اتمیک — قلب فیچر.
 * همه‌ی چک‌ها داخل تراکنش با قفلِ serialization از طریق unique constraint:
 *  - (programId, startAt) unique → دو رزرو هم‌زمان یک اسلات فقط یکی win
 *  - findRoomConflicts/findUserConflicts داخل تراکنش دوباره اجرا
 *  - Meeting + Booking + MeetingEvent یکجا
 */
export async function bookSlot(input: {
  programId: string;
  startAt: string;
  user: { id: string; orgId: string; branchId?: string | null; fullName?: string };
}) {
  const program = await prisma.appointmentProgram.findUnique({ where: { id: input.programId } });
  if (!program || program.orgId !== input.user.orgId) throw new HttpError(404, "برنامه یافت نشد", "NOT_FOUND");
  if (!(await canAccessProgram(input.user, program))) throw new HttpError(403, "دسترسی به این برنامه ندارید", "FORBIDDEN");
  if (program.status !== "ACTIVE") throw new HttpError(409, "برنامه فعال نیست", "PROGRAM_INACTIVE");
  // مسئول برنامه نمی‌تواند از برنامه‌ی خودش نوبت بگیرد
  if (program.hostId === input.user.id) throw new HttpError(400, "این برنامه‌ی خودتان است — کارکنان از آن نوبت می‌گیرند", "HOST_CANNOT_BOOK");

  const start = new Date(input.startAt);
  const end = new Date(start.getTime() + program.durationMin * 60000);
  if (start.getTime() < Date.now()) throw new HttpError(400, "زمان نوبت در گذشته است", "PAST_SLOT");
  if (start < program.validFrom || end > program.validTo) throw new HttpError(400, "خارج از بازه‌ی اعتبار برنامه", "OUT_OF_RANGE");

  // اسلات باید از پنجره‌ها باشد
  const windows = (program.windows as unknown as WindowDef[]) ?? [];
  const day = start.getDay();
  const minOfDay = start.getHours() * 60 + start.getMinutes();
  const step = program.durationMin + program.bufferMin;
  const inWindow = windows.some((w) => {
    if (!w.daysOfWeek.includes(day)) return false;
    const f = parseHHMM(w.from);
    const t = parseHHMM(w.to);
    return minOfDay >= f && minOfDay + program.durationMin <= t && (minOfDay - f) % step === 0;
  });
  if (!inWindow) throw new HttpError(400, "این زمان جزو نوبت‌های برنامه نیست", "NOT_A_SLOT");

  try {
    return await prisma.$transaction(async (tx) => {
      // ۱. نوبت قبلاً رزرو شده؟ (unique constraint هم پشتیبان است)
      const existing = await tx.appointmentBooking.findUnique({
        where: { programId_startAt: { programId: program.id, startAt: start } },
      });
      if (existing && existing.status === "BOOKED") {
        throw new HttpError(409, "این نوبت همین حالا توسط شخص دیگری رزرو شد — زمان دیگری انتخاب کنید", "SLOT_TAKEN");
      }

      // ۲. مسئول آزاد است؟ (لحظه‌ای — جلسه‌ی جدید ممکن است از راه رسیده باشد)
      const hostConflict = await findUserConflicts([program.hostId], start, end);
      if (hostConflict.length > 0) throw new HttpError(409, "مسئول جلسه در این زمان درگیر است", "HOST_BUSY");

      // ۳. کارمند خودش تداخل ندارد؟
      const selfConflict = await findUserConflicts([input.user.id], start, end);
      if (selfConflict.length > 0) throw new HttpError(409, "شما در این زمان جلسه‌ی دیگری دارید", "USER_BUSY");

      // ۴. اتاق آزاد — اولین اتاقِ مجازِ آزاد (داخل تراکنش)
      const busyRoomIds = await anyRoomConflict(program.roomIds, start, end);
      const rooms = await tx.meetingRoom.findMany({
        where: { id: { in: program.roomIds }, isActive: true },
        select: { id: true, name: true, capacity: true },
        orderBy: { capacity: "asc" },
      });
      const room = rooms.find((r) => !busyRoomIds.has(r.id));
      if (!room) throw new HttpError(409, "در این لحظه اتاق آزادی موجود نیست — زمان دیگری انتخاب کنید", "NO_ROOM");

      // ۵. جلسه‌ی واقعی — سرور آن را می‌سازد؛ اطلاع محرمانه در عنوان نمی‌آید
      const meeting = await tx.meeting.create({
        data: {
          orgId: program.orgId,
          title: program.isConfidential ? `${program.title} — جلسه‌ی محرمانه` : program.title,
          description: program.isConfidential ? null : program.description,
          organizerId: program.hostId,
          createdById: input.user.id,
          roomId: room.id,
          startAt: start,
          endAt: end,
          status: "CONFIRMED",
          meetingType: "INTERNAL",
          priority: "NORMAL",
          isPrivate: program.isConfidential,
          participants: {
            create: [
              { userId: program.hostId, role: "ORGANIZER" },
              { userId: input.user.id, role: "ATTENDEE" },
            ],
          },
        },
      });

      // ۶. Booking — unique(programId,startAt) رزرو هم‌زمان را قطعاً می‌بندد
      const booking = await tx.appointmentBooking.create({
        data: {
          orgId: program.orgId,
          programId: program.id,
          meetingId: meeting.id,
          userId: input.user.id,
          roomId: room.id,
          startAt: start,
          endAt: end,
        },
      });

      await tx.meetingEvent.create({
        data: {
          meetingId: meeting.id,
          type: "CREATED",
          data: { via: "appointment", programId: program.id },
        },
      });

      return { booking, meeting, room };
    }, { isolationLevel: "Serializable" });
  } catch (e) {
    // Prisma unique violation → پیام دوستانه
    if (String((e as { code?: string }).code) === "P2002") {
      throw new HttpError(409, "این نوبت همین حالا توسط شخص دیگری رزرو شد — زمان دیگری انتخاب کنید", "SLOT_TAKEN");
    }
    throw e;
  }
}

/** لغو رزرو توسط کارمند — جلسه CANCELLED + نوبت آزاد (اسلات دوباره قابل رزرو) */
/**
 * ویرایش برنامه — فقط مسئول یا ادمین. فیلدهای قابل ویرایش.
 * رزروهای آینده‌ی اسلات‌های حذف‌شده از پنجره‌ها باقی می‌مانند (جلسه‌ی واقعی‌اند)
 * ولی اسلات جدید در آن زمان‌ها ساخته نمی‌شود.
 */
export async function updateProgram(
  programId: string,
  user: { id: string; orgId: string; role?: string },
  patch: {
    title?: string; description?: string | null; topics?: { title: string }[];
    audienceType?: "ALL" | "BRANCH" | "USERS"; audienceIds?: string[];
    roomIds?: string[]; durationMin?: number; bufferMin?: number;
    windows?: WindowDef[]; validFrom?: Date; validTo?: Date;
    isConfidential?: boolean; status?: "DRAFT" | "ACTIVE";
  },
) {
  const program = await prisma.appointmentProgram.findUnique({ where: { id: programId } });
  if (!program || program.orgId !== user.orgId) throw new HttpError(404, "برنامه یافت نشد", "NOT_FOUND");
  const isHost = program.hostId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isHost && !isAdmin) throw new HttpError(403, "فقط مسئول برنامه یا مدیر سیستم می‌تواند ویرایش کند", "FORBIDDEN");

  const next = {
    durationMin: patch.durationMin ?? program.durationMin,
    bufferMin: patch.bufferMin ?? program.bufferMin,
    windows: patch.windows ?? (program.windows as unknown as WindowDef[]),
    validFrom: patch.validFrom ?? program.validFrom,
    validTo: patch.validTo ?? program.validTo,
  };
  if (patch.windows) validateWindows(next.windows, next.durationMin, next.bufferMin);
  if (next.validTo <= next.validFrom) throw new HttpError(400, "پایان اعتبار باید بعد از شروع باشد", "BAD_RANGE");
  if (patch.roomIds) {
    const rooms = await prisma.meetingRoom.count({ where: { id: { in: patch.roomIds }, orgId: user.orgId, isActive: true } });
    if (rooms !== patch.roomIds.length) throw new HttpError(400, "یکی از اتاق‌ها نامعتبر یا غیرفعال است", "BAD_ROOM");
  }
  const updated = await prisma.appointmentProgram.update({ where: { id: programId }, data: {
    ...(patch.title !== undefined && { title: patch.title }),
    ...(patch.description !== undefined && { description: patch.description }),
    ...(patch.topics !== undefined && { topics: patch.topics }),
    ...(patch.audienceType !== undefined && { audienceType: patch.audienceType }),
    ...(patch.audienceIds !== undefined && { audienceIds: patch.audienceIds }),
    ...(patch.roomIds !== undefined && { roomIds: patch.roomIds }),
    ...(patch.durationMin !== undefined && { durationMin: patch.durationMin }),
    ...(patch.bufferMin !== undefined && { bufferMin: patch.bufferMin }),
    ...(patch.windows !== undefined && { windows: patch.windows as unknown as Prisma.JsonObject[] }),
    ...(patch.validFrom !== undefined && { validFrom: patch.validFrom }),
    ...(patch.validTo !== undefined && { validTo: patch.validTo }),
    ...(patch.isConfidential !== undefined && { isConfidential: patch.isConfidential }),
    ...(patch.status !== undefined && { status: patch.status }),
  } });
  await audit({
    actorId: user.id, orgId: user.orgId, action: "APPOINTMENT_PROGRAM_UPDATE",
    entity: "AppointmentProgram", entityId: programId,
    newValue: { title: updated.title },
  });
  return updated;
}

/**
 * حذف برنامه — فقط وقتی رزرو فعال ندارد؛ وگرنه 409 (باید اول لغو کنند).
 */
export async function deleteProgram(programId: string, user: { id: string; orgId: string; role?: string }) {
  const program = await prisma.appointmentProgram.findUnique({ where: { id: programId }, include: { bookings: { where: { status: "BOOKED" } } } });
  if (!program || program.orgId !== user.orgId) throw new HttpError(404, "برنامه یافت نشد", "NOT_FOUND");
  const isHost = program.hostId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isHost && !isAdmin) throw new HttpError(403, "فقط مسئول برنامه یا مدیر سیستم می‌تواند حذف کند", "FORBIDDEN");
  const activeBookings = program.bookings.length;
  if (activeBookings > 0) {
    throw new HttpError(409, `این برنامه ${activeBookings} رزرو فعال دارد — اول رزروها را لغو کنید`, "HAS_BOOKINGS");
  }
  await prisma.appointmentProgram.delete({ where: { id: programId } });
  await audit({
    actorId: user.id, orgId: user.orgId, action: "APPOINTMENT_PROGRAM_DELETE",
    entity: "AppointmentProgram", entityId: programId,
    oldValue: { title: program.title },
  });
  return { ok: true };
}

export async function cancelBooking(bookingId: string, user: { id: string; orgId: string }) {
  const booking = await prisma.appointmentBooking.findUnique({ where: { id: bookingId }, include: { meeting: true, program: true } });
  if (!booking || booking.orgId !== user.orgId) throw new HttpError(404, "رزرو یافت نشد", "NOT_FOUND");
  const isOwner = booking.userId === user.id;
  const isHost = booking.program.hostId === user.id;
  if (!isOwner && !isHost) throw new HttpError(403, "فقط خودتان یا مسئول جلسه می‌تواند لغو کند", "FORBIDDEN");
  if (booking.status === "CANCELLED") return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.appointmentBooking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "لغو توسط کاربر" },
    });
    await tx.meeting.update({
      where: { id: booking.meetingId },
      data: { status: "CANCELLED", cancelReason: "لغو نوبت" },
    });
  });
  return { ok: true };
}

/** اعلان‌ها — شکستشان رزرو را خراب نمی‌کند */
export async function notifyBooking(bookingId: string): Promise<void> {
  try {
    const b = await prisma.appointmentBooking.findUnique({ where: { id: bookingId }, include: { program: { include: { host: true } }, user: true, meeting: true } });
    if (!b) return;
    const when = `${b.startAt.toLocaleDateString("fa-IR")} ساعت ${b.startAt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`;
    await notifyUsers(
      [b.program.hostId],
      "APPOINTMENT_BOOKED",
      "رزرو نوبت جدید",
      `${b.user.fullName} نوبت ${when} از «${b.program.title}» را رزرو کرد`,
      { meetingId: b.meetingId, orgId: b.orgId },
    ).catch(() => undefined);
  } catch { /* اعلان هرگز رزرو را نمی‌شکند */ }
}
