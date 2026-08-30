import { processDueReminders, processMeetingLifecycle } from "./reminder.service";

/** Single worker tick — reminders + meeting lifecycle. */
export async function runWorkerTick(): Promise<{ sent: number; completed: number }> {
  const sent = await processDueReminders();
  const completed = await processMeetingLifecycle();
  return { sent, completed };
}
