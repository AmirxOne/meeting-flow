/**
 * ═══════════════════════════════════════════════════════════════
 *  AI Feature Base — الگوی مشترک همه‌ی فیچرهای AI
 * ═══════════════════════════════════════════════════════════════
 * هر فیچر AI (در ai-features/) یک آبجکت AiFeature است:
 *
 *   id            — شناسه‌ی یکتا (برای audit/log)
 *   buildPrompt   — از context، پیام‌های system+user می‌سازد
 *   validate      — خروجی خام مدل را اعتبارسنجی/پاکسازی می‌کند؛
 *                   نامعتبر → null (موتور retry می‌کند)
 *   maxRetries    — حداکثر تلاش مجدد (پیش‌فرض ۲)
 *   temperature / maxTokens
 *
 * موتور اجرای مشترک: runAiFeature() — retry، سلامت، خطاها.
 * فیچر جدید = یک فایل جدید در ai-features/ + ثبت در registry.
 */

import { llmChat, ensureAiAvailable, type LlmMessage } from "../llm-client.service";
import type { MeetingAiContext } from "../ai/context.service";

export interface AiFeature<T> {
  id: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  /** تبدیل context جلسه به پیام‌های مدل */
  buildPrompt: (ctx: MeetingAiContext) => LlmMessage[];
  /** اعتبارسنجی خروجی خام — null یعنی retry */
  validate: (raw: string) => T | null;
}

/** استخراج JSON از پاسخ مدل — حتی با code fence یا متن اضافه */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = t.indexOf("{");
  const startArr = t.indexOf("[");
  const s = startArr !== -1 && (start === -1 || startArr < start) ? startArr : start;
  const end = s === start ? t.lastIndexOf("}") : t.lastIndexOf("]");
  if (s === -1 || end === -1 || end <= s) return null;
  try {
    return JSON.parse(t.slice(s, end + 1));
  } catch {
    return null;
  }
}

/** موتور مشترک اجرا: گیت → پرامپت → LLM → اعتبارسنجی → retry */
export async function runAiFeature<T>(
  feature: AiFeature<T>,
  ctx: MeetingAiContext,
): Promise<T> {
  await ensureAiAvailable();
  const maxRetries = feature.maxRetries ?? 2;

  const messages = feature.buildPrompt(ctx);
  let lastErr = "پاسخ نامعتبر";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let raw: string;
    try {
      const r = await llmChat({
        messages,
        temperature: feature.temperature ?? 0.4,
        maxTokens: feature.maxTokens ?? 1200,
        purpose: feature.id,
      });
      raw = r.text;
    } catch (e) {
      // خطای زیرساخت — retry بی‌فایده
      throw new Error(`تولید ناموفق: ${(e as Error).message}`.slice(0, 200));
    }
    const parsed = feature.validate(raw);
    if (parsed !== null && parsed !== undefined) return parsed;
    lastErr = "خروجی مدل نامعتبر بود";
  }
  throw new Error(`${lastErr} پس از ${maxRetries + 1} تلاش`);
}
