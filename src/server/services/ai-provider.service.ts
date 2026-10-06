// AI provider registry — multi-provider, secrets encrypted at rest (AES-256-GCM),
// keys never leave the server. SystemMeta key: "ai:providers".

import { prisma } from "@/server/db";
import { sealSecret, openSecret } from "@/server/crypto/secret-box";

export type ProviderKind = "LLM" | "SMS" | "EMAIL" | "PUSH" | "TRANSCRIBE";

/** الگوهای شناسایی توکن — فقط برای نمایش ماسک‌شده؛ توکن خام هرگز برگردانده نمی‌شود */
export function maskToken(secret: string): string {
  if (secret.length <= 8) return "•".repeat(secret.length);
  const head = secret.slice(0, 4);
  const tail = secret.slice(-4);
  return `${head}${"•".repeat(Math.min(12, Math.max(4, secret.length - 8)))}${tail}`;
}

export interface ProviderSpec {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  defaultModel: string | null;
  models: string[];
  docsUrl?: string;
}

/**
 * رجیستری پروایدرهای شناخته‌شده. افزودن پروایدر جدید = یک شیء جدید در این آرایه.
 * custom هم مجاز است (baseUrl دلخواه، سازگار OpenAI-compatible).
 */
export const PROVIDER_SPECS: ProviderSpec[] = [
  {
    id: "zai",
    name: "Z.AI (GLM)",
    kind: "LLM",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    defaultModel: "glm-4.7",
    models: ["glm-4.7", "glm-4.6", "glm-4.5-air", "glm-4-flash"],
    docsUrl: "https://docs.z.ai",
  },
  {
    id: "openai",
    name: "OpenAI",
    kind: "LLM",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o4-mini"],
    docsUrl: "https://platform.openai.com/docs",
  },
  {
    id: "openrouter",
    name: "OpenRouter (چند-مدلی)",
    kind: "LLM",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: null,
    models: [],
    docsUrl: "https://openrouter.ai/docs",
  },
  {
    id: "custom",
    name: "سفارشی (سازگار OpenAI)",
    kind: "LLM",
    baseUrl: "",
    defaultModel: null,
    models: [],
  },
];

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

export interface SafeProvider {
  id: string;
  specId: string;
  name: string;
  baseUrl: string;
  model: string | null;
  enabled: boolean;
  updatedAt: string;
  apiKeyMasked: string;
}

function toSafe(id: string, p: StoredProvider): SafeProvider {
  let masked = "••••";
  try {
    masked = maskToken(openSecret(p.apiKeySealed));
  } catch {
    /* sealed with an old SESSION_SECRET — show locked */
  }
  const { apiKeySealed: _sealed, ...rest } = p;
  return { id, ...rest, apiKeyMasked: masked };
}

export async function listProviders(): Promise<SafeProvider[]> {
  const row = await prisma.systemMeta.findUnique({ where: { key: META_KEY } });
  const map = (row?.value ?? {}) as unknown as Record<string, StoredProvider>;
  return Object.entries(map)
    .sort((a, b) => a[1].updatedAt.localeCompare(b[1].updatedAt))
    .map(([id, p]) => toSafe(id, p));
}

export async function saveProvider(input: {
  id?: string;
  specId: string;
  name: string;
  baseUrl: string;
  model: string | null;
  apiKey?: string; // فقط هنگام ثبت/تغییر؛ خالی = بدون تغییر
  enabled: boolean;
}): Promise<SafeProvider> {
  const spec = PROVIDER_SPECS.find((s) => s.id === input.specId);
  if (!spec) throw new Error("پروایدر ناشناخته است");

  const row = await prisma.systemMeta.findUnique({ where: { key: META_KEY } });
  const map = { ...((row?.value ?? {}) as unknown as Record<string, StoredProvider>) };
  const id = input.id ?? `prov-${Date.now().toString(36)}`;

  const apiKeySealed = input.apiKey?.trim()
    ? sealSecret(input.apiKey.trim())
    : map[id]?.apiKeySealed;
  if (!apiKeySealed) throw new Error("کلید API الزامی است");

  const stored: StoredProvider = {
    specId: input.specId,
    name: input.name.trim() || spec.name,
    baseUrl: input.baseUrl.trim() || spec.baseUrl,
    model: input.model?.trim() || null,
    enabled: input.enabled,
    apiKeySealed,
    updatedAt: new Date().toISOString(),
  };
  map[id] = stored;
  await prisma.systemMeta.upsert({
    where: { key: META_KEY },
    create: { key: META_KEY, value: map as unknown as object },
    update: { value: map as unknown as object },
  });
  return toSafe(id, stored);
}

export async function deleteProvider(id: string): Promise<void> {
  const row = await prisma.systemMeta.findUnique({ where: { key: META_KEY } });
  const map = { ...((row?.value ?? {}) as unknown as Record<string, StoredProvider>) };
  if (!(id in map)) throw new Error("پروایدر یافت نشد");
  delete map[id];
  await prisma.systemMeta.upsert({
    where: { key: META_KEY },
    create: { key: META_KEY, value: map as unknown as object },
    update: { value: map as unknown as object },
  });
}

/** تست اتصال واقعی به پروایدر — کلید از DB باز و مستقیم استفاده می‌شود، لاگ نمی‌شود. */
export async function testProvider(id: string): Promise<{ ok: boolean; detail: string }> {
  const row = await prisma.systemMeta.findUnique({ where: { key: META_KEY } });
  const map = (row?.value ?? {}) as unknown as Record<string, StoredProvider>;
  const p = map[id];
  if (!p) return { ok: false, detail: "پروایدر یافت نشد" };
  let key: string;
  try {
    key = openSecret(p.apiKeySealed);
  } catch {
    return { ok: false, detail: "کلید رمزگشایی نشد — SESSION_SECRET تغییر یافته؟" };
  }
  if (p.specId !== "custom" && !p.baseUrl && !PROVIDER_SPECS.find((s) => s.id === p.specId)?.baseUrl) {
    return { ok: false, detail: "آدرس پایه تنظیم نشده است" };
  }
  const base = p.baseUrl || PROVIDER_SPECS.find((s) => s.id === p.specId)?.baseUrl || "";
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: p.model || PROVIDER_SPECS.find((s) => s.id === p.specId)?.defaultModel || "gpt-4o-mini",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true, detail: "اتصال موفق — کلید معتبر است" };
    const text = (await res.text().catch(() => "")).slice(0, 200);
    if (res.status === 401 || res.status === 403) return { ok: false, detail: "کلید رد شد (۴۰۱/۴۰۳)" };
    return { ok: false, detail: `پاسخ پروایدر: ${res.status} — ${text || "بدون متن"}` };
  } catch (e) {
    return { ok: false, detail: `ارتباط برقرار نشد: ${(e as Error).message}`.slice(0, 200) };
  }
}
