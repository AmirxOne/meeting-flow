import { describe, expect, it } from "vitest";
import {
  generateTotp,
  generateTotpSecret,
  normalizeOtpCode,
  totpOtpauthUrl,
  verifyTotp,
} from "@/lib/totp";

/** RFC 6238 SHA-1 test secret (ASCII 12345678901234567890). */
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP", () => {
  it("matches RFC 6238 SHA-1 vectors", () => {
    expect(generateTotp(RFC_SECRET, 59 * 1000)).toBe("287082");
    expect(generateTotp(RFC_SECRET, 1111111109 * 1000)).toBe("081804");
    expect(generateTotp(RFC_SECRET, 1111111111 * 1000)).toBe("050471");
    expect(generateTotp(RFC_SECRET, 1234567890 * 1000)).toBe("005924");
    expect(generateTotp(RFC_SECRET, 2000000000 * 1000)).toBe("279037");
  });

  it("accepts the current code and rejects a wrong code", () => {
    const at = 1_700_000_000_000;
    const good = generateTotp(RFC_SECRET, at);
    expect(verifyTotp(RFC_SECRET, good, at)).toBe(true);
    expect(verifyTotp(RFC_SECRET, "000000", at)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "123456", at)).toBe(false);
  });

  it("accepts neighbouring window steps and rejects farther ones", () => {
    const at = 1_700_000_030_000;
    const prev = generateTotp(RFC_SECRET, at - 30_000);
    const next = generateTotp(RFC_SECRET, at + 30_000);
    const far = generateTotp(RFC_SECRET, at + 90_000);
    expect(verifyTotp(RFC_SECRET, prev, at)).toBe(true);
    expect(verifyTotp(RFC_SECRET, next, at)).toBe(true);
    expect(verifyTotp(RFC_SECRET, far, at)).toBe(false);
  });

  it("accepts Persian digits", () => {
    const at = 59 * 1000;
    expect(verifyTotp(RFC_SECRET, "۲۸۷۰۸۲", at)).toBe(true);
    expect(normalizeOtpCode("۲۸۷۰۸۲")).toBe("287082");
  });

  it("rejects truncated or non-numeric input", () => {
    expect(verifyTotp(RFC_SECRET, "28708", 59 * 1000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "abcdef", 59 * 1000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "", 59 * 1000)).toBe(false);
  });

  it("builds an otpauth URL for مهرسا", () => {
    const url = totpOtpauthUrl({ secret: RFC_SECRET, account: "ali@example.com" });
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain("ali%40example.com");
    expect(url).toContain("secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("generates a 32-character base32 secret", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });
});
