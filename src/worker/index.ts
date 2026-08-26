// Background worker: reminders, lifecycle auto-transitions, queue ticks.
// Run standalone: pnpm worker  (or via docker compose service "worker")

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 15000);

// import services via relative paths (tsx runs TS directly)
import { processDueReminders, processMeetingLifecycle } from "../server/services/reminder.service";

let running = true;

async function tick() {
  try {
    const sent = await processDueReminders();
    const completed = await processMeetingLifecycle();
    if (sent || completed) {
      console.log(`[worker] reminders sent: ${sent}, auto-completed: ${completed}`);
    }
  } catch (e) {
    console.error("[worker] tick error:", e);
  }
}

async function main() {
  console.log(`[worker] started — poll every ${POLL_MS}ms`);
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

main().catch((e) => {
  console.error("[worker] fatal:", e);
  process.exit(1);
});
