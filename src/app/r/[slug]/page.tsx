import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { RoomBoardClient } from "./board-client";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `برد زنده‌ی اتاق — ${slug} | مهرسا`,
    description: "صفحه‌ی زنده‌ی اتاق جلسه: برنامه‌ی امروز، جلسه‌ی در حال برگزاری و وضعیت اتاق — بدون نیاز به ورود.",
    robots: { index: false, follow: false },
  };
}

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
