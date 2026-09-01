import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { isLdapAuthEnabled } from "@/server/auth/auth-config";
import { parseLoginIdentifier } from "@/lib/login-identifier";
import { faNum, toEnDigits, stripBidiMarks } from "@/lib/fa";
import { parseEmailProviderKind, createEmailProvider, type EmailProvider } from "./email-provider";
import {
  hashPasswordResetSecret,
  newPasswordResetCode,
  newPasswordResetToken,
  passwordResetTtlMs,
  resetTokenErrorMessage,
  resetTokenStatus,
} from "@/server/auth/password-reset-token";

const LDAP_MSG = "در حالت LDAP رمز عبور از طریق Active Directory مدیریت می‌شود";
const GENERIC_SENT = "اگر حسابی با این مشخصات باشد، لینک بازنشانی ارسال شد";

export function shouldExposeResetDebug(): boolean {
  return parseEmailProviderKind() === "mock" && process.env.NODE_ENV !== "production";
}

export function buildPasswordResetEmail(opts: {
  fullName: string;
  resetUrl: string;
  code: string;
  ttlMinutes: number;
}): { subject: string; body: string } {
  const minutes = faNum(opts.ttlMinutes);
  const codeFa = faNum(opts.code);
  return {
    subject: "بازنشانی رمز عبور مهرسا",
    body: [
      `${opts.fullName} عزیز،`,
      "",
      "درخواست بازنشانی رمز عبور مهرسا ثبت شد.",
      `این لینک تا ${minutes} دقیقه اعتبار دارد:`,
      opts.resetUrl,
      "",
      `یا کد یک‌بارمصرف: ${codeFa}`,
      "",
      "اگر این درخواست از سمت شما نبوده، این پیام را نادیده بگیرید.",
    ].join("\n"),
  };
}

async function findActiveUserByIdentifier(raw: string) {
  const parsed = parseLoginIdentifier(raw);
  if (!parsed) return null;
  const user =
    parsed.kind === "email"
      ? await prisma.user.findUnique({ where: { email: parsed.value } })
      : await prisma.user.findUnique({ where: { phone: parsed.value } });
  if (!user || !user.isActive) return null;
  return user;
}

export async function requestPasswordReset(
  identifier: string,
  origin: string,
  mail: EmailProvider = createEmailProvider(),
): Promise<{ sent: true; debugToken?: string; debugCode?: string }> {
  if (isLdapAuthEnabled()) {
    throw new HttpError(400, LDAP_MSG, "LDAP_PASSWORD");
  }

  const parsed = parseLoginIdentifier(identifier);
  if (!parsed) {
    throw new HttpError(400, "ایمیل یا شماره موبایل نامعتبر است", "INVALID_IDENTIFIER");
  }

  const user = await findActiveUserByIdentifier(identifier);
  if (!user) {
    return { sent: true };
  }

  const token = newPasswordResetToken();
  const code = newPasswordResetCode();
  const ttl = passwordResetTtlMs();
  const expiresAt = new Date(Date.now() + ttl);

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashPasswordResetSecret(token),
      codeHash: hashPasswordResetSecret(code),
      expiresAt,
    },
  });

  const resetUrl = `${origin.replace(/\/$/, "")}/reset-password?token=${token}`;
  const email = buildPasswordResetEmail({
    fullName: user.fullName,
    resetUrl,
    code,
    ttlMinutes: Math.round(ttl / 60000),
  });

  try {
    await mail.send(user.email, email.subject, email.body);
  } catch (e) {
    console.error("[password-reset] email failed", e);
  }

  if (shouldExposeResetDebug()) {
    return { sent: true, debugToken: token, debugCode: code };
  }
  return { sent: true };
}

async function loadResetRow(opts: { token?: string; identifier?: string; code?: string }) {
  const token = opts.token?.trim();
  if (token) {
    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashPasswordResetSecret(token) },
    });
    return row;
  }

  const codeRaw = toEnDigits(stripBidiMarks(opts.code ?? "")).replace(/\D/g, "");
  if (codeRaw.length !== 6 || !opts.identifier?.trim()) {
    throw new HttpError(400, "لینک یا کد یک‌بارمصرف را وارد کنید", "INVALID_RESET");
  }

  const user = await findActiveUserByIdentifier(opts.identifier);
  if (!user) {
    throw new HttpError(400, "لینک یا کد نامعتبر است", "INVALID_RESET");
  }

  const rows = await prisma.passwordResetToken.findMany({
    where: { userId: user.id, codeHash: hashPasswordResetSecret(codeRaw) },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return rows[0] ?? null;
}

export async function completePasswordReset(opts: {
  token?: string;
  identifier?: string;
  code?: string;
  newPassword: string;
}): Promise<void> {
  if (isLdapAuthEnabled()) {
    throw new HttpError(400, LDAP_MSG, "LDAP_PASSWORD");
  }

  const row = await loadResetRow(opts);
  if (!row) {
    throw new HttpError(400, "لینک یا کد نامعتبر است", "INVALID_RESET");
  }

  const status = resetTokenStatus(row);
  if (status !== "valid") {
    throw new HttpError(400, resetTokenErrorMessage(status), status === "expired" ? "EXPIRED" : "CONSUMED");
  }

  const passwordHash = await bcrypt.hash(opts.newPassword, 10);
  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);
}
