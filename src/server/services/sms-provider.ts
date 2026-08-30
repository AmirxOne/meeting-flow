/** Pluggable SMS providers — mock (dev) or Kavenegar (production). */

export type SmsProviderKind = "mock" | "kavenegar";

export interface SmsProvider {
  readonly name: string;
  send(to: string, text: string): Promise<void>;
}

export interface SmsProviderConfig {
  provider?: string;
  apiKey?: string;
  sender?: string;
}

/** Parse NOTIFICATION_SMS_PROVIDER env. Unknown values fall back to mock. */
export function parseSmsProviderKind(raw?: string): SmsProviderKind {
  const value = (raw ?? process.env.NOTIFICATION_SMS_PROVIDER ?? "mock").trim().toLowerCase();
  if (value === "kavenegar") return "kavenegar";
  return "mock";
}

/** Normalize Iranian mobile for Kavenegar (receptor). */
export function normalizeSmsPhone(raw: string): string {
  let p = raw.replace(/[\s\-()]/g, "");
  if (p.startsWith("+98")) p = "0" + p.slice(3);
  if (p.startsWith("98") && p.length === 12) p = "0" + p.slice(2);
  return p;
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
  ) {}

  async send(to: string, text: string): Promise<void> {
    const receptor = normalizeSmsPhone(to);
    const url = `https://api.kavenegar.com/v1/${encodeURIComponent(this.apiKey)}/sms/send.json`;
    const body = new URLSearchParams({
      receptor,
      sender: this.sender,
      message: text,
    });

    const res = await this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      throw new Error(`Kavenegar HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      return?: { status?: number; message?: string };
    };

    if (data.return?.status !== 200) {
      throw new Error(`Kavenegar: ${data.return?.message ?? "send failed"}`);
    }
  }
}

/** Factory — reads env unless config overrides are passed (tests). */
export function createSmsProvider(config: SmsProviderConfig = {}): SmsProvider {
  const kind = parseSmsProviderKind(config.provider);

  if (kind === "kavenegar") {
    const apiKey =
      config.apiKey?.trim() ||
      process.env.SMS_API_KEY?.trim() ||
      process.env.KAVENEGAR_API_KEY?.trim();
    const sender = config.sender?.trim() || process.env.SMS_FROM?.trim();

    if (!apiKey) {
      throw new Error(
        "SMS_API_KEY (or KAVENEGAR_API_KEY) is required when NOTIFICATION_SMS_PROVIDER=kavenegar",
      );
    }
    if (!sender) {
      throw new Error("SMS_FROM is required when NOTIFICATION_SMS_PROVIDER=kavenegar");
    }

    return new KavenegarSmsProvider(apiKey, sender);
  }

  return new MockSmsProvider();
}
