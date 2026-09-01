import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { prisma } from "@/server/db";
import { HttpError, hashToken, newSessionToken, destroyOtherSessions } from "@/server/auth/session";
import { sealSecret, openSecret } from "@/server/crypto/secret-box";
import {
  generateTotpSecret,
  totpOtpauthUrl,
  verifyTotp,
} from "@/lib/totp";
import { stripBidiMarks, toEnDigits } from "@/lib/fa";

export const TOTP_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const hex = randomBytes(4).toString("hex");
    return `${hex.slice(0, 4)}-${hex.slice(4)}`;
  });
}

export function canonicalizeRecoveryCode(raw: string): string {
  return toEnDigits(stripBidiMarks(raw)).toLowerCase().replace(/[^a-f0-9]/g, "");
}

export function hashRecoveryCode(raw: string): string {
  return hashToken(canonicalizeRecoveryCode(raw));
}

export async function getTwoFactorStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabled: true, totpEnabledAt: true, totpSecretEnc: true },
  });
  return {
    enabled: !!user?.totpEnabled,
    enabledAt: user?.totpEnabledAt ?? null,
    pendingSetup: !!user?.totpSecretEnc && !user.totpEnabled,
  };
}

export async function startTwoFactorSetup(user: { id: string; email: string }) {
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpEnabled: true },
  });
  if (row?.totpEnabled) {
    throw new HttpError(400, "تأیید دو مرحله‌ای از قبل فعال است", "ALREADY_ENABLED");
  }

  const secret = generateTotpSecret();
  const otpauthUrl = totpOtpauthUrl({ secret, account: user.email });
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecretEnc: sealSecret(secret), totpEnabled: false },
  });

  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });

  return { secret, otpauthUrl, qrDataUrl };
}

export async function enableTwoFactor(
  userId: string,
  code: string,
  keepSessionToken?: string,
): Promise<{ recoveryCodes: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabled: true, totpSecretEnc: true },
  });
  if (!user?.totpSecretEnc) {
    throw new HttpError(400, "ابتدا راه‌اندازی را شروع کنید", "SETUP_REQUIRED");
  }
  if (user.totpEnabled) {
    throw new HttpError(400, "تأیید دو مرحله‌ای از قبل فعال است", "ALREADY_ENABLED");
  }

  let secret: string;
  try {
    secret = openSecret(user.totpSecretEnc);
  } catch {
    throw new HttpError(400, "راه‌اندازی نامعتبر است — دوباره شروع کنید", "INVALID_SETUP");
  }

  if (!verifyTotp(secret, toEnDigits(stripBidiMarks(code)))) {
    throw new HttpError(400, "کد authenticator نادرست است", "INVALID_OTP");
  }

  const recoveryCodes = generateRecoveryCodes();
  const totpRecoveryHashes = recoveryCodes.map(hashRecoveryCode);

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpEnabled: true,
      totpEnabledAt: new Date(),
      totpRecoveryHashes,
    },
  });
  await destroyOtherSessions(userId, keepSessionToken);
  return { recoveryCodes };
}

export async function disableTwoFactor(
  userId: string,
  opts: { code?: string; recoveryCode?: string },
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabled: true, totpSecretEnc: true, totpRecoveryHashes: true },
  });
  if (!user?.totpEnabled || !user.totpSecretEnc) {
    throw new HttpError(400, "تأیید دو مرحله‌ای فعال نیست", "NOT_ENABLED");
  }

  const okTotp = opts.code ? verifyUserTotp(user.totpSecretEnc, opts.code) : false;
  const recoveryHash = opts.recoveryCode ? hashRecoveryCode(opts.recoveryCode) : null;
  const okRecovery = recoveryHash ? user.totpRecoveryHashes.includes(recoveryHash) : false;
  if (!okTotp && !okRecovery) {
    throw new HttpError(400, "کد authenticator یا بازیابی نادرست است", "INVALID_OTP");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpEnabled: false,
      totpEnabledAt: null,
      totpSecretEnc: null,
      totpRecoveryHashes: [],
    },
  });
}

function verifyUserTotp(secretEnc: string, code: string): boolean {
  try {
    return verifyTotp(openSecret(secretEnc), toEnDigits(stripBidiMarks(code)));
  } catch {
    return false;
  }
}

export async function consumeRecoveryCode(userId: string, recoveryCode: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpRecoveryHashes: true },
  });
  if (!user) return false;
  const hashed = hashRecoveryCode(recoveryCode);
  const idx = user.totpRecoveryHashes.indexOf(hashed);
  if (idx < 0) return false;
  const next = user.totpRecoveryHashes.filter((_, i) => i !== idx);
  await prisma.user.update({
    where: { id: userId },
    data: { totpRecoveryHashes: next },
  });
  return true;
}

export async function createTwoFactorChallenge(userId: string): Promise<string> {
  const token = newSessionToken();
  await prisma.twoFactorChallenge.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await prisma.twoFactorChallenge.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOTP_CHALLENGE_TTL_MS),
    },
  });
  return token;
}

export async function completeTwoFactorLogin(opts: {
  challengeToken: string;
  code?: string;
  recoveryCode?: string;
}): Promise<{ userId: string }> {
  const row = await prisma.twoFactorChallenge.findUnique({
    where: { tokenHash: hashToken(opts.challengeToken) },
  });
  if (!row || row.consumedAt) {
    throw new HttpError(400, "نشست تأیید منقضی یا نامعتبر است — دوباره وارد شوید", "INVALID_CHALLENGE");
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(400, "زمان تأیید تمام شد — دوباره وارد شوید", "EXPIRED_CHALLENGE");
  }

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: {
      id: true,
      isActive: true,
      totpEnabled: true,
      totpSecretEnc: true,
      totpRecoveryHashes: true,
    },
  });
  if (!user?.isActive || !user.totpEnabled || !user.totpSecretEnc) {
    throw new HttpError(400, "تأیید دو مرحله‌ای برای این حساب فعال نیست", "NOT_ENABLED");
  }

  let accepted = false;
  if (opts.recoveryCode?.trim()) {
    accepted = await consumeRecoveryCode(user.id, opts.recoveryCode);
  } else if (opts.code?.trim()) {
    accepted = verifyUserTotp(user.totpSecretEnc, opts.code);
  }
  if (!accepted) {
    throw new HttpError(401, "کد نادرست است", "INVALID_OTP");
  }

  await prisma.twoFactorChallenge.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });
  return { userId: user.id };
}

export async function userHasTwoFactor(userId: string): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabled: true },
  });
  return !!row?.totpEnabled;
}
