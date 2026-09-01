import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET /api/health — liveness probe for reverse proxy / Docker. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "meetinghub" });
}
