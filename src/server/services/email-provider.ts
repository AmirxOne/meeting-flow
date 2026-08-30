/** Pluggable email providers — mock (dev) or SMTP (production). */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export type EmailProviderKind = "mock" | "smtp";

export interface EmailProvider {
  readonly name: string;
  send(to: string, subject: string, body: string): Promise<void>;
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
  /** Inject transporter for tests. */
  transporter?: Transporter;
}

/** Parse NOTIFICATION_EMAIL_PROVIDER env. Unknown values fall back to mock. */
export function parseEmailProviderKind(raw?: string): EmailProviderKind {
  const value = (raw ?? process.env.NOTIFICATION_EMAIL_PROVIDER ?? "mock").trim().toLowerCase();
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
  const host = config.host?.trim() || process.env.SMTP_HOST?.trim();
  const from =
    config.from?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim();

  if (!host || !from) return null;

  const port = parseSmtpPort(config.port);
  const secure =
    config.secure ??
    (process.env.SMTP_SECURE?.trim().toLowerCase() === "true" || port === 465);

  const user = config.user?.trim() || process.env.SMTP_USER?.trim() || undefined;
  const pass = config.pass ?? process.env.SMTP_PASS ?? undefined;

  return { host, port, secure, user, pass, from };
}

class MockEmailProvider implements EmailProvider {
  readonly name = "mock-email";
  async send(to: string, subject: string, body: string) {
    console.log(`[email:${this.name}] → ${to} :: ${subject}`);
  }
}

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";

  constructor(
    private readonly from: string,
    private readonly transporter: Transporter,
  ) {}

  async send(to: string, subject: string, body: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text: body,
    });
  }
}

/** Factory — reads env unless config overrides are passed (tests). */
export function createEmailProvider(config: EmailProviderConfig = {}): EmailProvider {
  const kind = parseEmailProviderKind(config.provider);

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
      });

    return new SmtpEmailProvider(smtp.from, transporter);
  }

  return new MockEmailProvider();
}
