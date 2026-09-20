/** Admin email status + pilot test — mirrors sms-status.service. */
import { prisma } from "@/server/db";
import {
  parseEmailProviderKind,
  resolveSmtpConfig,
  getEmailProvider,
} from "@/server/services/email-provider";

export type EmailAdminStatus = {
  provider: "mock" | "smtp";
  /** SMTP config complete (host+from at minimum)? */
  configured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean;
  from: string | null;
  /** checklist of missing env vars for real SMTP */
  missing: string[];
  /** last failed reminder (email channel) */
  lastFailure: { at: string; error: string; meetingTitle: string | null } | null;
  lastSent: { at: string; meetingTitle: string | null } | null;
  lastTest: { ok: boolean; at: string; to: string | null; error: string | null; provider: string | null } | null;
};

export async function getEmailAdminStatus(orgId: string): Promise<EmailAdminStatus> {
  const kind = parseEmailProviderKind();
  const cfg = resolveSmtpConfig();
  const missing: string[] = [];
  const env = process.env;
  if (!env.SMTP_HOST) missing.push("SMTP_HOST");
  if (!env.SMTP_FROM && !env.EMAIL_FROM) missing.push("SMTP_FROM");
  if (!env.SMTP_USER) missing.push("SMTP_USER (اختیاری اگر سرور بدون احراز است)");

  const [failing, sent, testLog] = await Promise.all([
    prisma.meetingReminder.findFirst({
      where: {
        channel: "EMAIL",
        status: "PENDING",
        lastError: { not: null },
        meeting: { orgId },
      },
      orderBy: { remindAt: "desc" },
      include: { meeting: { select: { title: true } } },
    }),
    prisma.meetingReminder.findFirst({
      where: {
        channel: "EMAIL",
        status: "SENT",
        sentAt: { not: null },
        meeting: { orgId },
      },
      orderBy: { sentAt: "desc" },
      include: { meeting: { select: { title: true } } },
    }),
    prisma.auditLog.findFirst({
      where: { orgId, entity: "Email" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, newValue: true },
    }),
  ]);

  const t = testLog?.newValue as { ok?: boolean; to?: string; error?: string; provider?: string } | null;

  return {
    provider: kind,
    configured: kind === "smtp" && !!cfg,
    host: cfg?.host ?? null,
    port: cfg?.port ?? null,
    secure: cfg?.secure ?? false,
    from: cfg?.from ?? null,
    missing,
    lastFailure: failing
      ? { at: failing.remindAt.toISOString(), error: (failing.lastError ?? "").slice(0, 200), meetingTitle: failing.meeting?.title ?? null }
      : null,
    lastSent: sent ? { at: (sent.sentAt as Date).toISOString(), meetingTitle: sent.meeting?.title ?? null } : null,
    lastTest: testLog
      ? { ok: !!t?.ok, at: testLog.createdAt.toISOString(), to: t?.to ?? null, error: t?.error ?? null, provider: t?.provider ?? null }
      : null,
  };
}

/** Send a pilot test email to one address. */
export async function sendEmailTest(to: string): Promise<{ ok: true; provider: string; to: string }> {
  const provider = getEmailProvider();
  const html = '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8"><p>این یک ایمیل آزمایشی از سامانه‌ی <b>مهرسا</b> است.</p><p style="color:#777">اگر آن را دریافت کرده‌اید، تنظیمات SMTP درست است.</p></div>';
  await provider.send(
    to,
    "مهرسا — ایمیل آزمایشی",
    "این یک ایمیل آزمایشی از سامانه‌ی مهرسا است. اگر آن را دریافت کرده‌اید، تنظیمات SMTP درست است.",
    html,
  );
  return { ok: true, provider: provider.name, to };
}
