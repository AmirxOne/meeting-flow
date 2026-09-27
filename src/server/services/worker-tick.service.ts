import { processDueReminders, processMeetingLifecycle } from "./reminder.service";
import { processWaitlistOffers } from "./waitlist.service";
import { recordWorkerHeartbeat, type WorkerTickSource } from "./worker-status.service";

/** Single worker tick — reminders + meeting lifecycle + waitlist offers. */
export async function runWorkerTick(): Promise<{
  sent: number;
  completed: number;
  waitlist: number;
  availability?: { created: number; notified: number; expired: number };
}> {
  const sent = await processDueReminders();
  const completed = await processMeetingLifecycle();
  const waitlist = await processWaitlistOffers();
  // اعلام زمان‌های آزاد — هر خطا فقط همین بخش را متوقف کند
  let availability: { created: number; notified: number; expired: number } | undefined;
  try {
    const { processAvailability } = await import("./availability-mgmt.service");
    availability = await processAvailability();
  } catch (e) {
    console.error("[worker] availability tick error:", e);
  }
  return { sent, completed, waitlist, availability };
}

/** Run tick and persist heartbeat for admin / health checks. */
export async function runWorkerTickWithHeartbeat(source: WorkerTickSource): Promise<{
  sent: number;
  completed: number;
  waitlist: number;
}> {
  try {
    const result = await runWorkerTick();
    await recordWorkerHeartbeat({ source, ok: true, ...result });
    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : "worker tick failed";
    await recordWorkerHeartbeat({ source, ok: false, error }).catch(() => undefined);
    throw e;
  }
}
