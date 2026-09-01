import { NextRequest } from "next/server";
import { handleError } from "@/server/http";
import { readCheckinMap } from "@/server/services/guest-checkin.service";
import { mapImageResponse } from "@/server/services/wayfinding-map.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/checkin/:code/map — public floor/branch map for the guest page. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const file = await readCheckinMap(code);
    return mapImageResponse(file.body, file.mimeType);
  } catch (e) {
    return handleError(e);
  }
}
