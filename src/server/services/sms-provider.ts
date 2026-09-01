/** Pluggable SMS providers — mock (dev) or Kavenegar (real send via SMS_API_KEY). */

export type SmsProviderKind = "mock" | "kavenegar";

export type SmsSendMeta = {
  token?: string;
  token2?: string;
  token3?: string;
};

export interface SmsProvider {
  readonly name: string;
  send(to: string, text: string, meta?: SmsSendMeta): Promise<void>;
}

export interface SmsProviderConfig {
  provider?: string;
  apiKey?: string;
  sender?: string;
  template?: string;
  fetchFn?: typeof fetch;
  env?: NodeJS.Dict<string>;
}

export type SmsRuntimeStatus = {
  provider: SmsProviderKind;
  /** Ready to call Kavenegar (key + sender present). */
  configured: boolean;
  hasApiKey: boolean;
  sender: string | null;
  template: string | null;
  reminderSmsEnabled: boolean;
};

/** Parse NOTIFICATION_SMS_PROVIDER. Explicit mock/empty/unknown → mock (dev). */
export function parseSmsProviderKind(
  raw?: string,
  env: NodeJS.Dict<string> = process.env,
): SmsProviderKind {
  const value = (raw ?? env.NOTIFICATION_SMS_PROVIDER ?? "mock").trim().toLowerCase();
  if (value === "kavenegar") return "kavenegar";
  return "mock";
}

export function readSmsApiKey(env: NodeJS.Dict<string> = process.env): string {
  return (env.SMS_API_KEY ?? env.KAVENEGAR_API_KEY ?? "").trim();
}

export function readSmsSender(env: NodeJS.Dict<string> = process.env): string {
  return (env.SMS_FROM ?? "").trim();
}

export function readSmsTemplate(env: NodeJS.Dict<string> = process.env): string {
  return (env.SMS_TEMPLATE ?? "").trim();
}

/** Normalize Iranian mobile for Kavenegar (receptor). */
export function normalizeSmsPhone(raw: string): string {
  let p = raw.replace(/[\s\-()]/g, "");
  if (p.startsWith("+98")) p = "0" + p.slice(3);
  if (p.startsWith("98") && p.length === 12) p = "0" + p.slice(2);
  return p;
}

export function isValidIranMobile(raw: string): boolean {
  return /^09\d{9}$/.test(normalizeSmsPhone(raw));
}

/** Safe lastError text — never include the API URL (key lives in the path). */
export function formatSmsError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/https?:\/\/\S+/gi, "[kavenegar]").slice(0, 300);
}

export function describeSmsRuntime(
  env: NodeJS.Dict<string> = process.env,
  reminderChannels: readonly string[] = [],
): SmsRuntimeStatus {
  const provider = parseSmsProviderKind(undefined, env);
  const hasApiKey = !!readSmsApiKey(env);
  const sender = readSmsSender(env) || null;
  const template = readSmsTemplate(env) || null;
  return {
    provider,
    configured: provider === "kavenegar" && hasApiKey && !!sender,
    hasApiKey,
    sender,
    template,
    reminderSmsEnabled: reminderChannels.includes("SMS"),
  };
}

function sanitizeLookupToken(value: string | undefined, fallback: string): string {
  const t = (value ?? "").replace(/\s+/g, "-").trim();
  return (t || fallback).slice(0, 100);
}

type KavenegarReturn = { return?: { status?: number; message?: string } };

async function assertKavenegarOk(res: Response): Promise<void> {
  let data: KavenegarReturn | null = null;
  try {
    data = (await res.json()) as KavenegarReturn;
  } catch {
    data = null;
  }
  const apiStatus = data?.return?.status;
  const apiMessage = data?.return?.message;
  if (!res.ok) {
    throw new Error(
      `Kavenegar HTTP ${res.status}${apiMessage ? `: ${apiMessage}` : ""}`,
    );
  }
  if (apiStatus !== 200) {
    throw new Error(`Kavenegar: ${apiMessage ?? "send failed"} (${apiStatus ?? "unknown"})`);
  }
}

class MockSmsProvider implements SmsProvider {
  readonly name = "mock-sms";
  async send(to: string, text: string) {
    console.log(`[sms:${this.name}] → ${to} :: ${text.replace(/\n/g, " ").slice(0, 80)}`);
  }
}

export class KavenegarSmsProvider implements SmsProvider {
  readonly name = "kavenegar";

  constructor(
    private readonly apiKey: string,
    private readonly sender: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly template?: string,
  ) {}

  async send(to: string, text: string, meta?: SmsSendMeta): Promise<void> {
    const receptor = normalizeSmsPhone(to);
    const key = encodeURIComponent(this.apiKey);
    const body = new URLSearchParams();
    body.set("receptor", receptor);

    let path = "sms/send.json";
    if (this.template) {
      path = "verify/lookup.json";
      body.set("template", this.template);
      body.set("token", sanitizeLookupToken(meta?.token, "1"));
      const t2 = sanitizeLookupToken(meta?.token2, "");
      const t3 = sanitizeLookupToken(meta?.token3, "");
      if (t2) body.set("token2", t2);
      if (t3) body.set("token3", t3);
    } else {
      body.set("sender", this.sender);
      body.set("message", text);
    }

    const url = `https://api.kavenegar.com/v1/${key}/${path}`;
    const res = await this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    await assertKavenegarOk(res);
  }
}

/** Factory — reads env unless config overrides are passed (tests). */
export function createSmsProvider(config: SmsProviderConfig = {}): SmsProvider {
  const env = config.env ?? process.env;
  const kind = parseSmsProviderKind(config.provider, env);

  if (kind === "kavenegar") {
    const apiKey = config.apiKey?.trim() || readSmsApiKey(env);
    const sender = config.sender?.trim() || readSmsSender(env);
    const template = config.template?.trim() || readSmsTemplate(env) || undefined;

    if (!apiKey) {
      throw new Error(
        "SMS_API_KEY (or KAVENEGAR_API_KEY) is required when NOTIFICATION_SMS_PROVIDER=kavenegar",
      );
    }
    if (!sender) {
      throw new Error("SMS_FROM is required when NOTIFICATION_SMS_PROVIDER=kavenegar");
    }

    return new KavenegarSmsProvider(apiKey, sender, config.fetchFn ?? fetch, template);
  }

  return new MockSmsProvider();
}

let cachedProvider: SmsProvider | undefined;

/** Lazy so worker/Next pick up env after restart; mock stays the default without a key. */
export function getSmsProvider(): SmsProvider {
  if (!cachedProvider) cachedProvider = createSmsProvider();
  return cachedProvider;
}

export function resetSmsProviderCache(): void {
  cachedProvider = undefined;
}
