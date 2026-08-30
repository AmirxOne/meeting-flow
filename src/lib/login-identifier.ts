import { stripBidiMarks, toEnDigits } from "./fa";

export type LoginKind = "email" | "phone";

export type ParsedLoginIdentifier =
  | { kind: "email"; value: string }
  | { kind: "phone"; value: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IR_MOBILE_RE = /^09\d{9}$/;

/** Canonical Iranian mobile: 09XXXXXXXXX. */
export function normalizeIranMobile(raw: string): string | null {
  let digits = toEnDigits(stripBidiMarks(raw)).replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("0098")) digits = digits.slice(4);
  else if (digits.startsWith("98")) digits = digits.slice(2);
  if (digits.startsWith("9") && digits.length === 10) digits = `0${digits}`;
  if (!IR_MOBILE_RE.test(digits)) return null;
  return digits;
}

/** Store user phones in one shape so login-by-mobile always matches. */
export function canonicalizeUserPhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = toEnDigits(stripBidiMarks(raw)).trim();
  if (!trimmed) return null;
  const mobile = normalizeIranMobile(trimmed);
  if (mobile) return mobile;
  const compact = trimmed.replace(/\s/g, "");
  return compact || null;
}

export function parseLoginIdentifier(raw: string): ParsedLoginIdentifier | null {
  const value = toEnDigits(stripBidiMarks(raw)).trim();
  if (!value) return null;
  if (value.includes("@") || EMAIL_RE.test(value)) {
    const email = value.toLowerCase();
    if (!EMAIL_RE.test(email)) return null;
    return { kind: "email", value: email };
  }
  const phone = normalizeIranMobile(value);
  if (!phone) return null;
  return { kind: "phone", value: phone };
}
