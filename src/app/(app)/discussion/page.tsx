import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { DiscussionClient } from "./page-client";

export default async function DiscussionHubPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
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
      organizer: { select: { id: true, fullName: true, avatarUrl: true } },
      room: { select: { name: true } },
      branch: { select: { name: true } },
      participants: { select: { userId: true } },
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true, userId: true },
      },
    },
    orderBy: { startAt: "desc" },
    take: 100,
  });

  // preload the selected room (if any) with full messages
  let selected = null;
  let selectedMessages: unknown[] = [];
  let canChat = false;
  if (m) {
    const mt = await prisma.meeting.findFirst({
      where: { id: m, orgId: user.orgId },
      select: {
        id: true,
        title: true,
        startAt: true,
        status: true,
        organizerId: true,
        isPrivate: true,
        branch: { select: { name: true } },
        room: { select: { name: true } },
        participants: {
          select: {
            userId: true,
            user: { select: { id: true, fullName: true, avatarUrl: true, jobTitle: true } },
          },
        },
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
    if (mt && (mt.organizerId === user.id || mt.participants.some((p) => p.userId === user.id) || user.permissions.has("meeting:view-all"))) {
      selected = mt;
      selectedMessages = mt.messages;
      canChat = mt.organizerId === user.id || mt.participants.some((p) => p.userId === user.id);
    }
  }

  return (
    <DiscussionClient
      userId={user.id}
      meetings={JSON.parse(JSON.stringify(meetings))}
      selectedId={selected?.id ?? null}
      selected={selected ? JSON.parse(JSON.stringify(selected)) : null}
      selectedMessages={JSON.parse(JSON.stringify(selectedMessages))}
      canChat={canChat}
    />
  );
}
