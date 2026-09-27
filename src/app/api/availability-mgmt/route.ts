import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, can, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import {
  getOrCreateConfig, setMembers, orgRequests, myRequests, myPendingRequest,
  submitAvailability, getRequestWithSlots,
} from "@/server/services/availability-mgmt.service";

/**
 * GET /api/availability-mgmt
 *   ?scope=me        → درخواست‌های خودم (کاربر)
 *   ?scope=pending   → فعالِ ثبت‌نشده‌ی خودم (برای مودال ورود)
 *   ?scope=org       → همه‌ی درخواست‌های سازمان (admin) + تنظیمات + اعضا
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const scope = req.nextUrl.searchParams.get("scope") ?? "me";

    if (scope === "org") {
      if (!can(user, "org:manage") && !can(user, "user:update")) {
        throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
      }
      const [config, requests, members] = await Promise.all([
        getOrCreateConfig(user.orgId!),
        orgRequests(user.orgId!),
        prisma.availabilityMember.findMany({
          where: { orgId: user.orgId!, removedAt: null },
          include: { user: { select: { id: true, fullName: true, email: true, jobTitle: true } } },
          orderBy: { createdAt: "asc" },
        }),
      ]);
      return ok({ config, requests, members });
    }

    if (scope === "pending") {
      const pending = await myPendingRequest(user.id, user.orgId!);
      return ok({ request: pending });
    }

    const requests = await myRequests(user.id, user.orgId!);
    return ok({ requests });
  } catch (e) {
    return handleError(e);
  }
}

const configSchema = z.object({
  cadence: z.enum(["WEEKLY", "MONTHLY"]).default("WEEKLY"),
  createDay: z.number().int().min(0).max(31),
  periodKind: z.enum(["THIS_WEEK", "NEXT_WEEK", "THIS_MONTH", "NEXT_MONTH"]),
  deadlineDayOffset: z.number().int().min(0).max(6),
  deadlineMinutes: z.number().int().min(0).max(1439),
  isActive: z.boolean(),
});

const membersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(200),
  remove: z.boolean().default(false),
});

/** POST /api/availability-mgmt — تنظیمات یا اعضا (admin) */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!can(user, "org:manage") && !can(user, "user:update")) {
      throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
    }
    const body = await req.json().catch(() => ({}));

    if ("userIds" in body) {
      const input = membersSchema.parse(body);
      const res = await setMembers(user.orgId!, user.id, input.userIds, input.remove);
      await audit({
        actorId: user.id, action: "AVAILABILITY_MEMBERS", entity: "AvailabilityConfig",
        entityId: res.config.id,
        newValue: { userIds: input.userIds, remove: input.remove },
      });
      return ok({ changed: res.changed });
    }

    const input = configSchema.parse(body);
    const config = await prisma.availabilityConfig.upsert({
      where: { orgId: user.orgId! },
      create: { orgId: user.orgId!, ...input },
      update: input,
    });
    await audit({
      actorId: user.id, action: "AVAILABILITY_CONFIG", entity: "AvailabilityConfig",
      entityId: config.id, newValue: input,
    });
    return ok({ config });
  } catch (e) {
    return handleError(e);
  }
}

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const submitSchema = z.object({
  requestId: z.string().min(1),
  slots: z.array(slotSchema).min(1).max(100),
});

/** PUT /api/availability-mgmt — ثبت زمان‌های آزاد (کاربر خودش یا admin از طرف او) */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = submitSchema.parse(await req.json().catch(() => ({})));
    const isAdmin = can(user, "org:manage") || can(user, "user:update");
    const updated = await submitAvailability(input.requestId, user.id, input.slots, { isAdmin });
    await audit({
      actorId: user.id, action: "AVAILABILITY_SUBMIT", entity: "AvailabilityRequest",
      entityId: input.requestId,
      newValue: { slots: input.slots.length, onBehalf: updated.userId !== user.id },
    });
    return ok({ request: updated });
  } catch (e) {
    return handleError(e);
  }
}

/** GET one request detail is covered by scope=org; single fetch via query id */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const { id } = z.object({ id: z.string().min(1) }).parse(await req.json().catch(() => ({})));
    const detail = await getRequestWithSlots(id);
    if (!detail) throw new HttpError(404, "درخواست یافت نشد", "NOT_FOUND");
    const isOwner = detail.userId === user.id;
    const isAdmin = can(user, "org:manage") || can(user, "user:update");
    if (!isOwner && !isAdmin) throw new HttpError(403, "دسترسی لازم را ندارید", "FORBIDDEN");
    return ok({ request: detail });
  } catch (e) {
    return handleError(e);
  }
}
