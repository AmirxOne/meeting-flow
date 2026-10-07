/**
 * ═══════════════════════════════════════════════════════════════
 *  AI Feature Registry — نقطه‌ی ثبت همه‌ی فیچرهای AI
 * ═══════════════════════════════════════════════════════════════
 * فیچر جدید بسازی:
 *   1. فایل src/server/services/ai/features/<name>.ts با AiFeature
 *   2. این‌جا در REGISTRY ثبتش کن
 *   3. route: buildMeetingAiContext → runAiFeature(REGISTRY.x, ctx)
 *
 * فیچرها از ai/context.service.ts داده می‌گیرند و از
 * runAiFeature (retry/گیت/سلامت) اجرا می‌شوند.
 */

import { buildMeetingAiContext, type MeetingAiContext } from "./context.service";
import { runAiFeature, type AiFeature } from "./feature-base";
import { agendaTopicsFeature } from "./features/agenda-topics";

const REGISTRY: Record<string, AiFeature<unknown>> = {
  "agenda-topics": agendaTopicsFeature,
};

/** اجرای فیچر ثبت‌شده روی یک جلسه */
export async function runMeetingAiFeature<T>(
  featureId: string,
  meetingId: string,
): Promise<T> {
  const feature = REGISTRY[featureId] as AiFeature<T> | undefined;
  if (!feature) throw new Error(`فیچر AI «${featureId}» ثبت نشده است`);
  const ctx: MeetingAiContext | null = await buildMeetingAiContext(meetingId);
  if (!ctx) throw new Error("جلسه یافت نشد");
  return runAiFeature<T>(feature, ctx);
}

export { buildMeetingAiContext };
export type { MeetingAiContext, AiFeature };
