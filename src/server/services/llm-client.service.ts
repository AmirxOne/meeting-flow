/**
 * Central LLM client — the app's single gateway to any AI provider.
 * الگوی کانفیگ هرمس: provider فعال + مدل پیش‌فرض + fallback خودکار.
 *
 * همه‌ی قابلیت‌های AI اپ (خلاصه‌سازی، پیشنهاد زمان، ...) فقط از همین‌جا
 * فراخوانی می‌شوند؛ تغییر پروایدر هیچ فراخوانی را نمی‌شکند.
 */

import { prisma } from "@/server/db";
import { openSecret } from "@/server/crypto/secret-box";
import { PROVIDER_SPECS } from "./ai-provider.service";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  /** پیشوند لاگ برای audit — بدون کلید */
  purpose: string;
}

export interface LlmResponse {
  text: string;
  providerId: string;
  providerName: string;
  model: string;
  fallbackUsed: boolean;
}

interface StoredProvider {
  specId: string;
  name: string;
  baseUrl: string;
  model: string | null;
  apiKeySealed: string;
  enabled: boolean;
  updatedAt: string;
}

const META_KEY = "ai:providers";
const SETTINGS_KEY = "ai:settings";

export interface AiSettings {
  /** id پروایدر فعال — مدل پیش‌فرض از همان خوانده می‌شود */
  activeProviderId: string | null;
  /** id پروایدر fallback — موقع 429/503/قطعی استفاده می‌شود */
  fallbackProviderId: string | null;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_SETTINGS: AiSettings = {
  activeProviderId: null,
  fallbackProviderId: null,
  temperature: 0.3,
  maxTokens: 2000,
};

export async function getAiSettings(): Promise<AiSettings> {
  const row = await prisma.systemMeta.findUnique({ where: { key: SETTINGS_KEY } });
  return { ...DEFAULT_SETTINGS, ...((row?.value ?? {}) as Partial<AiSettings>) };
}

export async function saveAiSettings(input: Partial<AiSettings>): Promise<AiSettings> {
  const cur = await getAiSettings();
  const next = { ...cur, ...input };
  await prisma.systemMeta.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: next as unknown as object },
    update: { value: next as unknown as object },
  });
  return next;
}

async function loadProviders(): Promise<Record<string, StoredProvider>> {
  const row = await prisma.systemMeta.findUnique({ where: { key: META_KEY } });
  return (row?.value ?? {}) as unknown as Record<string, StoredProvider>;
}

async function callProvider(
  p: StoredProvider,
  req: LlmRequest,
): Promise<{ text: string; model: string }> {
  const spec = PROVIDER_SPECS.find((s) => s.id === p.specId);
  const base = (p.baseUrl || spec?.baseUrl || "").replace(/\/$/, "");
  if (!base) throw new Error(`پروایدر «${p.name}» آدرس پایه ندارد`);
  const model = p.model || spec?.defaultModel;
  if (!model) throw new Error(`پروایدر «${p.name}» مدل ندارد`);

  let key: string;
  try {
    key = openSecret(p.apiKeySealed);
  } catch {
    throw new Error(`کلید پروایدر «${p.name}» رمزگشایی نشد`);
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: req.messages,
      temperature: req.temperature ?? 0.3,
      max_tokens: req.maxTokens ?? 2000,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = new Error(`provider ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const j = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = j.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("پاسخ خالی از پروایدر");
  return { text, model };
}

/** آیا خطا قابل-fallback است؟ (مثل هرمس: 429/529/503/قطعی) */
function isFailoverError(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  if (status && [429, 503, 529].includes(status)) return true;
  const msg = String((e as Error)?.message ?? "");
  return /fetch failed|aborted|timeout|ETIMEDOUT|ECONN/i.test(msg);
}

/**
 * فراخوانی اصلی LLM — پروایدر فعال؛ در صورت خطای گذرا، fallback خودکار.
 * خطاها readable برمی‌گردند و هرگز کلید را شامل نمی‌شوند.
 */
export async function llmChat(req: LlmRequest): Promise<LlmResponse> {
  const [providers, settings] = await Promise.all([loadProviders(), getAiSettings()]);

  const activeId = settings.activeProviderId ?? Object.keys(providers).find((id) => providers[id].enabled) ?? null;
  if (!activeId || !providers[activeId]) {
    throw new Error("هیچ پروایدر هوش مصنوعی فعالی تنظیم نشده — از تنظیمات مدیریت اضافه کنید");
  }
  const active = providers[activeId];

  try {
    const r = await callProvider(active, req);
    return {
      text: r.text,
      providerId: activeId,
      providerName: active.name,
      model: r.model,
      fallbackUsed: false,
    };
  } catch (e) {
    const fbId = settings.fallbackProviderId;
    if (!fbId || !providers[fbId] || fbId === activeId || !isFailoverError(e)) {
      // خطای واقعی (کلید نامعتبر و…) — بدون fallback
      if ((e as { status?: number }).status === 401 || (e as { status?: number }).status === 403) {
        throw new Error(`کلید پروایدر «${active.name}» رد شد`);
      }
      throw new Error(`پروایدر «${active.name}» پاسخ نداد: ${(e as Error).message}`.slice(0, 200));
    }
    const fb = providers[fbId];
    const r = await callProvider(fb, req);
    return {
      text: r.text,
      providerId: fbId,
      providerName: fb.name,
      model: r.model,
      fallbackUsed: true,
    };
  }
}
