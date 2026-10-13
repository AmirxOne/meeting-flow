import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/** GET — نوبت‌های من (آینده + اخیر) */
export async function GET() {
  try {
    const user = await requireUser();
    const bookings = await prisma.appointmentBooking.findMany({
      where: { orgId: user.orgId, userId: user.id, startAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      include: {
        program: { select: { title: true, hostId: true, isConfidential: true, host: { select: { fullName: true } } } },
        meeting: { select: { id: true, status: true } },
        room: { select: { name: true } },
      },
      orderBy: { startAt: "asc" },
    });
    return ok({
      bookings: bookings.map((b) => ({
        id: b.id,
        startAt: b.startAt,
        endAt: b.endAt,
        status: b.status,
        title: b.program.title,
        hostName: b.program.host.fullName,
        roomName: b.room.name,
        meetingId: b.meeting.id,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
