import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { toEnDigits } from "@/lib/fa";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD_SEC = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1;

/** RFC 4648 base32 without padding — Google Authenticator compatible. */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/g, "").replace(/[\s-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error("invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(key: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = bin % 10 ** digits;
  return otp.toString().padStart(digits, "0");
}

export function generateTotp(
  secret: string,
  atMs: number = Date.now(),
  periodSec = TOTP_PERIOD_SEC,
): string {
  const counter = Math.floor(atMs / 1000 / periodSec);
  return hotp(base32Decode(secret), counter);
}

export function normalizeOtpCode(raw: string): string {
  return toEnDigits(raw).replace(/[^\d]/g, "").slice(0, TOTP_DIGITS);
}

function codesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/** Accepts the current step and ±window neighbouring steps. */
export function verifyTotp(
  secret: string,
  code: string,
  atMs: number = Date.now(),
  window = TOTP_WINDOW,
): boolean {
  const normalized = normalizeOtpCode(code);
  if (normalized.length !== TOTP_DIGITS) return false;
  let key: Buffer;
  try {
    key = base32Decode(secret);
  } catch {
    return false;
  }
  const counter = Math.floor(atMs / 1000 / TOTP_PERIOD_SEC);
  for (let i = -window; i <= window; i++) {
    if (codesEqual(hotp(key, counter + i), normalized)) return true;
  }
  return false;
}

export function totpOtpauthUrl(opts: { secret: string; account: string; issuer?: string }): string {
  const issuer = opts.issuer ?? "مهرسا";
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(opts.account)}`;
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SEC),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
