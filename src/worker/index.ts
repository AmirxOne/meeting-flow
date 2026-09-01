// Background worker: reminders + meeting lifecycle.
// Dev: pnpm worker:dev  (second terminal alongside pnpm dev)

import { PrismaClient } from "@prisma/client";
import { runWorkerTickWithHeartbeat } from "../server/services/worker-tick.service";
import { parseReminderChannels } from "../server/services/reminder.service";
import { reportError } from "../server/report-error";
import { flushSentry, initNodeSentry } from "../server/sentry-node";
import { noteWorkerTick, startWorkerHealthServer } from "./health-server";

const prisma = new PrismaClient();
const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 15000);

let running = true;

async function tick() {
  try {
    const { sent, completed, waitlist } = await runWorkerTickWithHeartbeat("worker");
    noteWorkerTick(true);
    if (sent || completed || waitlist) {
      console.log(
        `[worker] tick — reminders sent: ${sent}, auto-completed: ${completed}, waitlist: ${waitlist}`,
      );
    }
  } catch (e) {
    noteWorkerTick(false);
    console.error("[worker] tick error:", e);
    reportError(e, { tags: { source: "worker-tick" } });
  }
}

async function main() {
  initNodeSentry("worker");
  startWorkerHealthServer();
  const channels = parseReminderChannels().join(",");
  console.log(
    `[worker] ready — reminders (${channels}) + lifecycle · poll every ${POLL_MS}ms`,
  );
  while (running) {
    await tick();
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  await prisma.$disconnect();
}

process.on("SIGINT", async () => {
  running = false;
  console.log("[worker] shutting down...");
  process.exit(0);
});

main().catch(async (e) => {
  console.error("[worker] fatal:", e);
  reportError(e, { tags: { source: "worker" } });
  await flushSentry();
  process.exit(1);
});
