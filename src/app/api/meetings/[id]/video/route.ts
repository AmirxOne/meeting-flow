import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireUser, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { videoLinkSchema } from "@/lib/validations";
import { validateVideoLink } from "@/lib/video-link";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await prisma.meeting.findFirst({ where: { id, orgId: user.orgId } });
    if (!meeting) throw new HttpError(404, "جلسه یافت نشد", "NOT_FOUND");
    if (meeting.organizerId !== user.id) {
      throw new HttpError(403, "فقط برگزارکننده می‌تواند لینک ویدئو را ویرایش کند", "FORBIDDEN");
    }
    if (["CANCELLED", "REJECTED"].includes(meeting.status)) {
      throw new HttpError(400, "این جلسه قابل ویرایش نیست", "BAD_STATE");
    }
    const input = videoLinkSchema.parse(await req.json().catch(() => ({})));
    const video = validateVideoLink(input.videoProvider ?? null, input.videoUrl ?? null);
    const value = video.ok ? video.value : { videoProvider: null, videoUrl: null };
    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        videoProvider: value.videoProvider,
        videoUrl: value.videoUrl,
      },
    });
    await audit({
      actorId: user.id,
      action: "VIDEO_LINK_UPDATE",
      entity: "Meeting",
      entityId: id,
      newValue: { videoProvider: updated.videoProvider, hasUrl: !!updated.videoUrl },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ meeting: updated });
  } catch (e) {
    return handleError(e);
  }
}
