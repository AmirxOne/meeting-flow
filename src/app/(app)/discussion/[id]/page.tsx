import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { DiscussionRoomClient } from "./page-client";

export default async function DiscussionRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const meeting = await prisma.meeting.findFirst({
    where: { id, orgId: user.orgId },
    select: {
      id: true,
      title: true,
      startAt: true,
      status: true,
      organizerId: true,
      isPrivate: true,
      branch: { select: { name: true } },
      room: { select: { name: true } },
      participants: { select: { userId: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 300,
        select: {
          id: true,
          userId: true,
          body: true,
          createdAt: true,
          user: { select: { id: true, fullName: true, avatarUrl: true, jobTitle: true } },
        },
      },
    },
  });
  if (!meeting) notFound();

  // the discussion is private to its participants — even admins not involved cannot open it
  const isInvolved = meeting.organizerId === user.id || meeting.participants.some((p) => p.userId === user.id);
  if (!isInvolved) notFound();

  return (
    <DiscussionRoomClient
      meetingId={meeting.id}
      title={meeting.title}
      startAt={meeting.startAt.toISOString()}
      status={meeting.status}
      place={`${meeting.branch?.name ?? ""}${meeting.room ? ` · ${meeting.room.name}` : ""}`}
      currentUserId={user.id}
      canChat={isInvolved}
      initialMessages={JSON.parse(JSON.stringify(meeting.messages))}
    />
  );
}
