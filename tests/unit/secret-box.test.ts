import { describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "@/server/crypto/secret-box";

describe("sealSecret / openSecret", () => {
  it("round-trips unicode secrets", () => {
    const packed = sealSecret("refresh-توکن-۱");
    expect(packed.split(".")).toHaveLength(3);
    expect(openSecret(packed)).toBe("refresh-توکن-۱");
  });

  it("does not store plaintext", () => {
    expect(sealSecret("plain-token")).not.toContain("plain-token");
  });

  it("rejects truncated payloads", () => {
    expect(() => openSecret("abcd")).toThrow(/invalid sealed secret/);
  });
});
