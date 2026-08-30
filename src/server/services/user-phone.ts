import { canonicalizeUserPhone } from "@/lib/login-identifier";
import { HttpError } from "@/server/auth/session";
import { prisma } from "@/server/db";

export { canonicalizeUserPhone };

/** Canonical mobile (or null) — rejects a number already owned by another user. */
export async function uniqueUserPhone(
  raw: string | null | undefined,
  excludeUserId?: string,
): Promise<string | null> {
  const phone = canonicalizeUserPhone(raw);
  if (!phone) return null;
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing && existing.id !== excludeUserId) {
    throw new HttpError(409, "این شماره موبایل قبلاً ثبت شده است", "DUPLICATE_PHONE");
  }
  return phone;
}
