import { describe, expect, it, vi, beforeEach } from "vitest";
import { sealSecret } from "@/server/crypto/secret-box";
import { generateTotp } from "@/lib/totp";

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    session: { deleteMany: vi.fn() },
    twoFactorChallenge: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/server/db";
import {
  canonicalizeRecoveryCode,
  enableTwoFactor,
  generateRecoveryCodes,
  hashRecoveryCode,
  completeTwoFactorLogin,
} from "@/server/services/two-factor.service";
import { hashToken } from "@/server/auth/session";

const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("2FA recovery codes", () => {
  it("generates 10 unique xxxx-xxxx codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[a-f0-9]{4}-[a-f0-9]{4}$/);
    }
  });

  it("canonicalizes hyphen, case, and spacing the same", () => {
    expect(canonicalizeRecoveryCode("AbCd-Ef01")).toBe("abcdef01");
    expect(canonicalizeRecoveryCode("abcdef01")).toBe("abcdef01");
    expect(hashRecoveryCode("AB12-cd34")).toBe(hashRecoveryCode("ab12cd34"));
  });
});

describe("enableTwoFactor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 0 } as never);
  });

  it("rejects a wrong authenticator code", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      totpEnabled: false,
      totpSecretEnc: sealSecret(SECRET),
    } as never);

    await expect(enableTwoFactor("u1", "000000")).rejects.toMatchObject({
      code: "INVALID_OTP",
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("accepts a valid TOTP and returns recovery codes", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      totpEnabled: false,
      totpSecretEnc: sealSecret(SECRET),
    } as never);

    const { recoveryCodes } = await enableTwoFactor("u1", generateTotp(SECRET), "keep-token");
    expect(recoveryCodes).toHaveLength(10);
    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.session.deleteMany).toHaveBeenCalled();
  });
});

describe("completeTwoFactorLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a wrong TOTP without issuing a session", async () => {
    vi.mocked(prisma.twoFactorChallenge.findUnique).mockResolvedValue({
      id: "ch1",
      userId: "u1",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      isActive: true,
      totpEnabled: true,
      totpSecretEnc: sealSecret(SECRET),
      totpRecoveryHashes: [],
    } as never);

    await expect(
      completeTwoFactorLogin({ challengeToken: "a".repeat(32), code: "000000" }),
    ).rejects.toMatchObject({ code: "INVALID_OTP" });
    expect(prisma.twoFactorChallenge.update).not.toHaveBeenCalled();
  });

  it("accepts a valid TOTP and consumes the challenge", async () => {
    const token = "b".repeat(32);
    vi.mocked(prisma.twoFactorChallenge.findUnique).mockResolvedValue({
      id: "ch1",
      userId: "u1",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      isActive: true,
      totpEnabled: true,
      totpSecretEnc: sealSecret(SECRET),
      totpRecoveryHashes: [],
    } as never);
    vi.mocked(prisma.twoFactorChallenge.update).mockResolvedValue({} as never);

    const result = await completeTwoFactorLogin({
      challengeToken: token,
      code: generateTotp(SECRET),
    });
    expect(result.userId).toBe("u1");
    expect(prisma.twoFactorChallenge.update).toHaveBeenCalled();
    expect(hashToken(token)).toHaveLength(64);
  });
});
