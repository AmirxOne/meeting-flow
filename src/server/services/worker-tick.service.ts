import { processDueReminders, processMeetingLifecycle } from "./reminder.service";
import { processWaitlistOffers } from "./waitlist.service";
import { recordWorkerHeartbeat, type WorkerTickSource } from "./worker-status.service";

/** Single worker tick — reminders + meeting lifecycle + waitlist offers. */
export async function runWorkerTick(): Promise<{
  sent: number;
  completed: number;
  waitlist: number;
}> {
  const sent = await processDueReminders();
  const completed = await processMeetingLifecycle();
  const waitlist = await processWaitlistOffers();
  return { sent, completed, waitlist };
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
