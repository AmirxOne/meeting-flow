import { describe, expect, it } from "vitest";
import {
  canonicalizeUserPhone,
  normalizeIranMobile,
  parseLoginIdentifier,
} from "@/lib/login-identifier";
import { loginSchema } from "@/lib/validations";

describe("normalizeIranMobile", () => {
  it("accepts 09XXXXXXXXX", () => {
    expect(normalizeIranMobile("09123456789")).toBe("09123456789");
  });

  it("accepts Persian digits, +98 and spaces", () => {
    expect(normalizeIranMobile("۰۹۱۲ ۳۴۵ ۶۷۸۹")).toBe("09123456789");
    expect(normalizeIranMobile("+989123456789")).toBe("09123456789");
    expect(normalizeIranMobile("00989123456789")).toBe("09123456789");
    expect(normalizeIranMobile("9123456789")).toBe("09123456789");
  });

  it("rejects landlines and short numbers", () => {
    expect(normalizeIranMobile("02122223344")).toBeNull();
    expect(normalizeIranMobile("0912")).toBeNull();
    expect(normalizeIranMobile("")).toBeNull();
  });
});

describe("parseLoginIdentifier", () => {
  it("parses email case-insensitively", () => {
    expect(parseLoginIdentifier("  Admin@Example.com ")).toEqual({
      kind: "email",
      value: "admin@example.com",
    });
  });

  it("parses Iranian mobile", () => {
    expect(parseLoginIdentifier("۰۹۱۲۰۰۰۱۰۰۱")).toEqual({
      kind: "phone",
      value: "09120001001",
    });
  });

  it("rejects junk", () => {
    expect(parseLoginIdentifier("admin@")).toBeNull();
    expect(parseLoginIdentifier("not-a-login")).toBeNull();
    expect(parseLoginIdentifier("")).toBeNull();
  });
});

describe("canonicalizeUserPhone", () => {
  it("stores mobiles in one shape", () => {
    expect(canonicalizeUserPhone("+98 912 000 1001")).toBe("09120001001");
    expect(canonicalizeUserPhone("  ")).toBeNull();
    expect(canonicalizeUserPhone(null)).toBeNull();
  });
});

describe("loginSchema", () => {
  it("accepts legacy { email, password }", () => {
    expect(loginSchema.parse({ email: "admin@example.com", password: "Pass1234" })).toEqual({
      identifier: "admin@example.com",
      password: "Pass1234",
    });
  });

  it("accepts { identifier, password }", () => {
    expect(loginSchema.parse({ identifier: "09120001001", password: "Pass1234" })).toEqual({
      identifier: "09120001001",
      password: "Pass1234",
    });
  });

  it("prefers identifier over email", () => {
    expect(
      loginSchema.parse({
        email: "old@example.com",
        identifier: "09120001001",
        password: "Pass1234",
      }).identifier,
    ).toBe("09120001001");
  });
});
