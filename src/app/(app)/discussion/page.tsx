import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { DiscussionClient } from "./page-client";

export default async function DiscussionHubPage() {
  const user = await requireUser();
  const meetings = await prisma.meeting.findMany({
    where: {
      orgId: user.orgId,
      status: { notIn: ["DRAFT", "CANCELLED", "REJECTED"] },
      OR: [
        { organizerId: user.id },
        { participants: { some: { userId: user.id } } },
      ],
    },
    select: {
      id: true,
      title: true,
      startAt: true,
      status: true,
      meetingType: true,
      organizer: { select: { id: true, fullName: true } },
      room: { select: { name: true } },
      branch: { select: { name: true } },
      _count: { select: { messages: true, participants: true } },
    },
    orderBy: { startAt: "desc" },
    take: 100,
  });
  return <DiscussionClient userId={user.id} meetings={JSON.parse(JSON.stringify(meetings))} />;
}
