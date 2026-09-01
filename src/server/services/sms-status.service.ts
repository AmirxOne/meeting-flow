import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { parseOrgNotifChannels } from "@/lib/notification-prefs";
import { toEnDigits } from "@/lib/fa";
import {
  describeSmsRuntime,
  formatSmsError,
  getSmsProvider,
  isValidIranMobile,
  normalizeSmsPhone,
  type SmsRuntimeStatus,
} from "./sms-provider";

export type SmsLastSend = {
  ok: boolean;
  at: string | null;
  error: string | null;
  meetingTitle: string | null;
};

export type SmsLastTest = {
  ok: boolean;
  at: string;
  receptor: string | null;
  error: string | null;
  provider: string | null;
};

export type SmsAdminStatus = SmsRuntimeStatus & {
  lastSend: SmsLastSend | null;
  lastTest: SmsLastTest | null;
};

function maskPhone(phone: string): string {
  const n = normalizeSmsPhone(phone);
  if (n.length < 8) return "***";
  return `${n.slice(0, 4)}***${n.slice(-4)}`;
}

export async function getSmsAdminStatus(orgId: string): Promise<SmsAdminStatus> {
  const runtime = describeSmsRuntime(process.env, parseOrgNotifChannels());

  const [failing, sent, testLog] = await Promise.all([
    prisma.meetingReminder.findFirst({
      where: {
        channel: "SMS",
        status: "PENDING",
        lastError: { not: null },
        meeting: { orgId },
      },
      orderBy: { remindAt: "desc" },
      include: { meeting: { select: { title: true } } },
    }),
    prisma.meetingReminder.findFirst({
      where: {
        channel: "SMS",
        status: "SENT",
        sentAt: { not: null },
        meeting: { orgId },
      },
      orderBy: { sentAt: "desc" },
      include: { meeting: { select: { title: true } } },
    }),
    prisma.auditLog.findFirst({
      where: { orgId, entity: "Sms" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, newValue: true },
    }),
  ]);

  let lastSend: SmsLastSend | null = null;
  if (failing) {
    lastSend = {
      ok: false,
      at: failing.remindAt.toISOString(),
      error: failing.lastError,
      meetingTitle: failing.meeting.title,
    };
  } else if (sent) {
    lastSend = {
      ok: true,
      at: sent.sentAt?.toISOString() ?? null,
      error: null,
      meetingTitle: sent.meeting.title,
    };
  }

  let lastTest: SmsLastTest | null = null;
  if (testLog) {
    const v = (testLog.newValue ?? {}) as Record<string, unknown>;
    lastTest = {
      ok: v.ok === true,
      at: testLog.createdAt.toISOString(),
      receptor: typeof v.receptor === "string" ? v.receptor : null,
      error: typeof v.error === "string" ? v.error : null,
      provider: typeof v.provider === "string" ? v.provider : null,
    };
  }

  return { ...runtime, lastSend, lastTest };
}

export async function sendSmsTest(phone: string): Promise<{
  ok: true;
  provider: string;
  receptor: string;
}> {
  const receptor = normalizeSmsPhone(toEnDigits(phone));
  if (!isValidIranMobile(receptor)) {
    throw new HttpError(400, "شماره موبایل نامعتبر است (مثال: ۰۹۱۲۱۲۳۴۵۶۷)", "VALIDATION_ERROR");
  }

  const provider = getSmsProvider();
  try {
    await provider.send(receptor, "پیام آزمایشی مهرسا — پایلوت پیامک", {
      token: "1",
      token2: "آزمایش",
    });
  } catch (e) {
    throw new HttpError(502, formatSmsError(e), "SMS_SEND_FAILED");
  }

  return { ok: true, provider: provider.name, receptor: maskPhone(receptor) };
}

export { maskPhone as maskSmsPhone };
