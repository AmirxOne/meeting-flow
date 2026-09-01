import { NextRequest } from "next/server";
import { HttpError, requireUser } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import {
  assertCanViewMeeting,
  listAttachments,
  loadMeetingForAttachments,
  uploadAttachment,
} from "@/server/services/attachment.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await loadMeetingForAttachments(id, user.orgId);
    assertCanViewMeeting(user, meeting);
    const attachments = await listAttachments(id);
    return ok({ attachments });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      throw new HttpError(400, "فایل انتخاب نشده است", "NO_FILE");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const attachment = await uploadAttachment(id, user, {
      buffer,
      name: file.name || "file",
    });
    await audit({
      actorId: user.id,
      action: "ATTACHMENT_UPLOAD",
      entity: "MeetingAttachment",
      entityId: attachment.id,
      newValue: {
        meetingId: id,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ attachment }, 201);
  } catch (e) {
    return handleError(e);
  }
}
