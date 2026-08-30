// Background worker: reminders + meeting lifecycle.
// Dev: pnpm worker:dev  (second terminal alongside pnpm dev)

import { PrismaClient } from "@prisma/client";
import { runWorkerTick } from "../server/services/worker-tick.service";
import { parseReminderChannels } from "../server/services/reminder.service";

const prisma = new PrismaClient();
const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 15000);

let running = true;

async function tick() {
  try {
    const { sent, completed } = await runWorkerTick();
    if (sent || completed) {
      console.log(`[worker] tick — reminders sent: ${sent}, auto-completed: ${completed}`);
    }
  } catch (e) {
    console.error("[worker] tick error:", e);
  }
}

async function main() {
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

main().catch((e) => {
  console.error("[worker] fatal:", e);
  process.exit(1);
});
