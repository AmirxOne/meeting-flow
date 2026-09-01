import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { getOrgTimezone } from "./org-timezone.service";
import {
  holidayBlocksBooking,
  holidayHitsForRange,
  holidayRequiresApproval,
  isIsoDate,
  parseHolidayBookingMode,
  type HolidayBookingMode,
} from "@/lib/holiday";

export { parseHolidayBookingMode, type HolidayBookingMode };

export interface OrgHolidayRow {
  id: string;
  dateIso: string;
  name: string;
}

export async function getHolidayBookingMode(orgId: string): Promise<HolidayBookingMode> {
  const row = await prisma.meetingPolicy.findUnique({
    where: { orgId_key: { orgId, key: "holidayBooking" } },
    select: { value: true },
  });
  return parseHolidayBookingMode(row?.value);
}

export async function listHolidays(
  orgId: string,
  fromIso?: string,
  toIso?: string,
): Promise<OrgHolidayRow[]> {
  return prisma.orgHoliday.findMany({
    where: {
      orgId,
      ...(fromIso || toIso
        ? {
            dateIso: {
              ...(fromIso ? { gte: fromIso } : {}),
              ...(toIso ? { lte: toIso } : {}),
            },
          }
        : {}),
    },
    select: { id: true, dateIso: true, name: true },
    orderBy: { dateIso: "asc" },
  });
}

export async function createOrgHoliday(
  orgId: string,
  input: { dateIso: string; name: string; createdBy?: string },
): Promise<OrgHolidayRow> {
  if (!isIsoDate(input.dateIso)) {
    throw new HttpError(400, "تاریخ نامعتبر است", "INVALID_DATE");
  }
  const name = input.name.trim();
  if (name.length < 2) {
    throw new HttpError(400, "نام تعطیلی حداقل ۲ کاراکتر است", "VALIDATION");
  }
  const exists = await prisma.orgHoliday.findUnique({
    where: { orgId_dateIso: { orgId, dateIso: input.dateIso } },
  });
  if (exists) {
    throw new HttpError(409, "این تاریخ قبلاً به‌عنوان تعطیل ثبت شده است", "HOLIDAY_EXISTS");
  }
  return prisma.orgHoliday.create({
    data: {
      orgId,
      dateIso: input.dateIso,
      name,
      createdBy: input.createdBy ?? null,
    },
    select: { id: true, dateIso: true, name: true },
  });
}

export async function deleteOrgHoliday(orgId: string, id: string): Promise<void> {
  const row = await prisma.orgHoliday.findFirst({ where: { id, orgId } });
  if (!row) throw new HttpError(404, "تعطیلی یافت نشد", "NOT_FOUND");
  await prisma.orgHoliday.delete({ where: { id } });
}

/**
 * BLOCK → throw. REQUIRE_APPROVAL → requiresApproval true.
 * No hits → requiresApproval false.
 */
export async function assertHolidayBooking(
  orgId: string,
  startAt: Date,
  endAt: Date,
): Promise<{ requiresApproval: boolean; hits: OrgHolidayRow[] }> {
  const tz = await getOrgTimezone(orgId);
  const [mode, holidays] = await Promise.all([
    getHolidayBookingMode(orgId),
    listHolidays(orgId),
  ]);
  const hits = holidayHitsForRange(holidays, startAt, endAt, tz);
  if (holidayBlocksBooking(mode, hits.length)) {
    const label = hits.map((h) => h.name).join("، ");
    throw new HttpError(
      400,
      `رزرو در روز تعطیل سازمانی مجاز نیست (${label})`,
      "HOLIDAY_BLOCKED",
    );
  }
  return { requiresApproval: holidayRequiresApproval(mode, hits.length), hits };
}
