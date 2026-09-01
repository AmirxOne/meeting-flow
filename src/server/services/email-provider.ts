/** Pluggable email providers — mock (dev) or SMTP (production). */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { wrapRtlEmailHtml } from "@/lib/email-templates";

export type EmailProviderKind = "mock" | "smtp";

export interface EmailProvider {
  readonly name: string;
  send(to: string, subject: string, body: string, html?: string): Promise<void>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export interface EmailProviderConfig {
  provider?: string;
  host?: string;
  port?: string | number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  env?: NodeJS.Dict<string>;
  /** Inject transporter for tests. */
  transporter?: Transporter;
}

/** Parse NOTIFICATION_EMAIL_PROVIDER. Explicit mock/empty/unknown → mock (dev). */
export function parseEmailProviderKind(
  raw?: string,
  env: NodeJS.Dict<string> = process.env,
): EmailProviderKind {
  const value = (raw ?? env.NOTIFICATION_EMAIL_PROVIDER ?? "mock").trim().toLowerCase();
  if (value === "smtp") return "smtp";
  return "mock";
}

/** Parse SMTP_PORT with default 587. */
export function parseSmtpPort(raw?: string | number): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const source = raw ?? process.env.SMTP_PORT;
  if (!source) return 587;
  const n = Number(String(source).trim());
  return Number.isFinite(n) && n > 0 ? n : 587;
}

/** Build SMTP config from env or overrides. Returns null when required fields missing. */
export function resolveSmtpConfig(config: EmailProviderConfig = {}): SmtpConfig | null {
  const env = config.env ?? process.env;
  const host = config.host?.trim() || env.SMTP_HOST?.trim();
  const from =
    config.from?.trim() ||
    env.SMTP_FROM?.trim() ||
    env.EMAIL_FROM?.trim();

  if (!host || !from) return null;

  const port = parseSmtpPort(config.port ?? env.SMTP_PORT);
  const secure =
    config.secure ??
    (env.SMTP_SECURE?.trim().toLowerCase() === "true" || port === 465);

  const user = config.user?.trim() || env.SMTP_USER?.trim() || undefined;
  const pass = config.pass ?? env.SMTP_PASS ?? undefined;

  return { host, port, secure, user, pass, from };
}

export function formatEmailError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/https?:\/\/\S+/gi, "[smtp]").slice(0, 300);
}

class MockEmailProvider implements EmailProvider {
  readonly name = "mock-email";
  async send(to: string, subject: string, body: string) {
    console.log(`[email:${this.name}] → ${to} :: ${subject}`);
    if (body.trim()) {
      console.log(`[email:${this.name}] ${body.split("\n").slice(0, 8).join(" | ")}`);
    }
  }
}

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";

  constructor(
    private readonly from: string,
    private readonly transporter: Transporter,
  ) {}

  async send(to: string, subject: string, body: string, html?: string): Promise<void> {
    const htmlBody =
      html?.trim() ||
      wrapRtlEmailHtml({
        heading: subject,
        paragraphs: body ? [body] : [],
      });
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text: body,
      html: htmlBody,
    });
  }
}

/** Factory — reads env unless config overrides are passed (tests). */
export function createEmailProvider(config: EmailProviderConfig = {}): EmailProvider {
  const env = config.env ?? process.env;
  const kind = parseEmailProviderKind(config.provider, env);

  if (kind === "smtp") {
    const smtp = resolveSmtpConfig(config);
    if (!smtp) {
      throw new Error(
        "SMTP_HOST and SMTP_FROM (or EMAIL_FROM) are required when NOTIFICATION_EMAIL_PROVIDER=smtp",
      );
    }

    const transporter =
      config.transporter ??
      nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass ?? "" } : undefined,
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });

    return new SmtpEmailProvider(smtp.from, transporter);
  }

  return new MockEmailProvider();
}

let cachedProvider: EmailProvider | undefined;

/** Lazy so worker/Next pick up env after restart; mock stays the default. */
export function getEmailProvider(): EmailProvider {
  if (!cachedProvider) cachedProvider = createEmailProvider();
  return cachedProvider;
}

export function resetEmailProviderCache(): void {
  cachedProvider = undefined;
}
