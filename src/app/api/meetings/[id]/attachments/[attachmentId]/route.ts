import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/session";
import { handleError, ok, audit } from "@/server/http";
import {
  deleteAttachment,
  getAttachmentForDownload,
} from "@/server/services/attachment.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function contentDisposition(name: string): string {
  const safe = name.replace(/[\r\n"]/g, "_");
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_") || "file";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, attachmentId } = await params;
    const file = await getAttachmentForDownload(id, attachmentId, user);
    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.sizeBytes),
        "Content-Disposition": contentDisposition(file.originalName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, attachmentId } = await params;
    const removed = await deleteAttachment(id, attachmentId, user);
    await audit({
      actorId: user.id,
      action: "ATTACHMENT_DELETE",
      entity: "MeetingAttachment",
      entityId: attachmentId,
      oldValue: { meetingId: id, originalName: removed.originalName },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ removed: true });
  } catch (e) {
    return handleError(e);
  }
}
