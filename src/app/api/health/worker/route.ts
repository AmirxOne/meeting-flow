import { NextResponse } from "next/server";
import { getWorkerHealthResponse } from "@/server/services/worker-status.service";

export const dynamic = "force-dynamic";

/** GET /api/health/worker — docker / load-balancer probe (reads shared DB heartbeat). */
export async function GET() {
  const body = await getWorkerHealthResponse();
  return NextResponse.json(body, { status: body.ok ? 200 : 503 });
}
