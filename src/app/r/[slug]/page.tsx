import { prisma } from "@/server/db";
import { RoomBoardClient } from "./board-client";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Public room board — /r/[slug] — NO LOGIN required (QR poster target). */
export default async function RoomBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await prisma.meetingRoom.findUnique({
    where: { publicSlug: slug },
    include: { branch: { select: { name: true, org: { select: { name: true } } } } },
  });
  if (!room || !room.isActive) notFound();

  return (
    <RoomBoardClient
      room={{
        name: room.name,
        capacity: room.capacity,
        branch: room.branch.name,
        org: room.branch.org.name,
        slug: room.publicSlug!,
      }}
    />
  );
}
