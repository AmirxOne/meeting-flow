import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/session";
import { handleError } from "@/server/http";
import { avatarImageResponse, readOrgAvatar } from "@/server/services/avatar.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/avatars/:userId — stream avatar for self or same-org colleague. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const actor = await requireUser();
    const { userId } = await params;
    const file = await readOrgAvatar(actor, userId);
    return avatarImageResponse(file.body, file.mimeType);
  } catch (e) {
    return handleError(e);
  }
}
