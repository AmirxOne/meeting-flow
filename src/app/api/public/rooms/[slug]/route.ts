import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/** GET /api/public/rooms/[slug] — NO AUTH. Room agenda for the QR poster.
 *  Confidential meetings are masked (title hidden, time/room shown). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const room = await prisma.meetingRoom.findUnique({
      where: { publicSlug: slug },
      include: { branch: { select: { name: true } } },
    });
    if (!room || !room.isActive) {
      return Response.json(
        { ok: false, error: { message: "اتاق یافت نشد", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    const now = new Date();
    const dayEnd = new Date(now.getTime() + 36 * 3600000); // today + tomorrow

    const meetings = await prisma.meeting.findMany({
      where: {
        roomId: room.id,
        startAt: { gte: new Date(now.getTime() - 2 * 3600000), lte: dayEnd },
        status: { notIn: ["CANCELLED", "REJECTED", "DRAFT"] },
      },
      select: {
        id: true,
        title: true,
        isPrivate: true,
        startAt: true,
        endAt: true,
        status: true,
        organizer: { select: { fullName: true } },
      },
      orderBy: { startAt: "asc" },
      take: 30,
    });

    return Response.json({
      ok: true,
      data: {
        room: {
          name: room.name,
          capacity: room.capacity,
          branch: room.branch.name,
          slug: room.publicSlug,
        },
        serverTime: now.toISOString(),
        meetings: meetings.map((m) => ({
          id: m.id,
          startAt: m.startAt,
          endAt: m.endAt,
          status: m.status,
          organizer: m.isPrivate ? null : m.organizer.fullName,
          // confidential meetings: show THAT the room is busy, not WHAT
          title: m.isPrivate ? "جلسه محرمانه" : m.title,
          isPrivate: m.isPrivate,
        })),
      },
    });
  } catch {
    return Response.json(
      { ok: false, error: { message: "خطای داخلی سرور", code: "INTERNAL" } },
      { status: 500 },
    );
  }
}
