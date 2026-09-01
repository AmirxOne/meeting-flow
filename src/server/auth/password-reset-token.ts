import { randomBytes, randomInt } from "node:crypto";
import { hashToken } from "@/server/auth/session";

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

export type ResetTokenStatus = "valid" | "expired" | "consumed";

export interface ResetTokenRow {
  expiresAt: Date;
  consumedAt: Date | null;
}

export function passwordResetTtlMs(): number {
  const minutes = Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 15);
  if (!Number.isFinite(minutes) || minutes <= 0) return PASSWORD_RESET_TTL_MS;
  return minutes * 60 * 1000;
}

/** URL token — 32 bytes hex. */
export function newPasswordResetToken(): string {
  return randomBytes(32).toString("hex");
}

/** Six-digit one-time code (crypto, not Math.random). */
export function newPasswordResetCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashPasswordResetSecret(raw: string): string {
  return hashToken(raw.trim());
}

export function resetTokenStatus(row: ResetTokenRow, now: Date = new Date()): ResetTokenStatus {
  if (row.consumedAt) return "consumed";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export function resetTokenErrorMessage(status: Exclude<ResetTokenStatus, "valid">): string {
  if (status === "consumed") return "این لینک یا کد قبلاً استفاده شده است";
  return "این لینک یا کد منقضی شده است — دوباره درخواست دهید";
}
