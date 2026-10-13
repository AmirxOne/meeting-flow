import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { prisma } from "@/server/db";
import { z } from "zod";
import { validateWindows, canAccessProgram } from "@/server/services/appointment.service";

export const dynamic = "force-dynamic";

const windowSchema = z.object({
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  from: z.string().regex(/^\d{1,2}:\d{2}$/),
  to: z.string().regex(/^\d{1,2}:\d{2}$/),
});

const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  topics: z.array(z.object({ title: z.string().trim().min(1).max(200) })).max(10).optional(),
  audienceType: z.enum(["ALL", "BRANCH", "USERS"]).default("ALL"),
  audienceIds: z.array(z.string()).max(100).default([]),
  roomIds: z.array(z.string()).min(1, "حداقل یک اتاق لازم است"),
  durationMin: z.number().int().min(10).max(240),
  bufferMin: z.number().int().min(0).max(60).default(0),
  windows: z.array(windowSchema).min(1),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  isConfidential: z.boolean().default(false),
  status: z.enum(["DRAFT", "ACTIVE"]).default("ACTIVE"),
});

/** GET — برنامه‌های قابل مشاهده‌ی من (فیلتر سمت سرور) */
export async function GET() {
  try {
    const user = await requireUser();
    const programs = await prisma.appointmentProgram.findMany({
      where: { orgId: user.orgId, status: { in: ["ACTIVE", "DRAFT"] } },
      include: { host: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    const visible = [];
    for (const p of programs) {
      const mine = p.hostId === user.id;
      if (!mine && p.status !== "ACTIVE") continue;
      if (mine || (await canAccessProgram(user, p))) {
        visible.push({
          id: p.id,
          title: p.title,
          description: p.description,
          topics: p.topics,
          audienceType: p.audienceType,
          audienceIds: p.audienceIds,
          roomIds: p.roomIds,
          durationMin: p.durationMin,
          bufferMin: p.bufferMin,
          windows: p.windows,
          validFrom: p.validFrom,
          validTo: p.validTo,
          status: p.status,
          isConfidential: p.isConfidential,
          hostName: p.host.fullName,
          roomCount: p.roomIds.length,
          isMine: mine,
        });
      }
    }
    return ok({ programs: visible });
  } catch (e) {
    return handleError(e);
  }
}

/** POST — ایجاد برنامه (مسئول = خود کاربر) */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = createSchema.parse(await req.json().catch(() => ({})));
    // اتاق‌ها معتبر و فعال این سازمان
    const rooms = await prisma.meetingRoom.findMany({
      where: { id: { in: input.roomIds }, orgId: user.orgId, isActive: true },
      select: { id: true },
    });
    if (rooms.length !== input.roomIds.length) {
      throw new HttpError(400, "یکی از اتاق‌ها نامعتبر یا غیرفعال است", "BAD_ROOM");
    }
    // مخاطبان USERS باید در همین سازمان باشند
    if (input.audienceType === "USERS") {
      const cnt = await prisma.user.count({ where: { id: { in: input.audienceIds }, orgId: user.orgId } });
      if (cnt !== input.audienceIds.length) throw new HttpError(400, "کاربر مخاطب نامعتبر", "BAD_AUDIENCE");
    }
    validateWindows(input.windows as { daysOfWeek: number[]; from: string; to: string }[], input.durationMin, input.bufferMin);
    if (new Date(input.validTo) <= new Date(input.validFrom)) {
      throw new HttpError(400, "پایان اعتبار باید بعد از شروع باشد", "BAD_RANGE");
    }

    const program = await prisma.appointmentProgram.create({
      data: {
        orgId: user.orgId,
        hostId: user.id,
        title: input.title,
        description: input.description,
        topics: input.topics ?? [],
        audienceType: input.audienceType,
        audienceIds: input.audienceIds,
        roomIds: input.roomIds,
        durationMin: input.durationMin,
        bufferMin: input.bufferMin,
        windows: input.windows,
        validFrom: new Date(input.validFrom),
        validTo: new Date(input.validTo),
        isConfidential: input.isConfidential,
        status: input.status,
      },
    });
    await audit({
      actorId: user.id,
      orgId: user.orgId,
      action: "APPOINTMENT_PROGRAM_CREATE",
      entity: "AppointmentProgram",
      entityId: program.id,
      newValue: { title: program.title },
    });
    return ok({ program });
  } catch (e) {
    return handleError(e);
  }
}
