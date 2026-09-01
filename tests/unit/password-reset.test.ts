import { describe, expect, it, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import {
  newPasswordResetCode,
  resetTokenErrorMessage,
  resetTokenStatus,
} from "@/server/auth/password-reset-token";
import { HttpError } from "@/server/auth/session";

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    session: { deleteMany: vi.fn() },
    passwordResetToken: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown) => ops),
  },
}));

vi.mock("@/server/auth/auth-config", () => ({
  isLdapAuthEnabled: vi.fn(() => false),
}));

vi.mock("@/server/services/email-provider", () => ({
  parseEmailProviderKind: vi.fn(() => "mock"),
  createEmailProvider: vi.fn(() => ({
    name: "mock-email",
    send: vi.fn(),
  })),
}));

import { prisma } from "@/server/db";
import { isLdapAuthEnabled } from "@/server/auth/auth-config";
import {
  completePasswordReset,
  requestPasswordReset,
  buildPasswordResetEmail,
} from "@/server/services/password-reset.service";

describe("resetTokenStatus", () => {
  const now = new Date("2030-01-01T12:00:00Z");

  it("is valid when unconsumed and not expired", () => {
    expect(
      resetTokenStatus({ expiresAt: new Date("2030-01-01T12:15:00Z"), consumedAt: null }, now),
    ).toBe("valid");
  });

  it("is expired when past expiresAt", () => {
    expect(
      resetTokenStatus({ expiresAt: new Date("2030-01-01T11:59:00Z"), consumedAt: null }, now),
    ).toBe("expired");
  });

  it("is consumed even if not yet expired", () => {
    expect(
      resetTokenStatus(
        { expiresAt: new Date("2030-01-01T12:15:00Z"), consumedAt: new Date("2030-01-01T11:50:00Z") },
        now,
      ),
    ).toBe("consumed");
  });

  it("consumed takes precedence over expired", () => {
    expect(
      resetTokenStatus(
        { expiresAt: new Date("2030-01-01T11:00:00Z"), consumedAt: new Date("2030-01-01T10:00:00Z") },
        now,
      ),
    ).toBe("consumed");
  });
});

describe("resetTokenErrorMessage", () => {
  it("explains expired vs consumed in Persian", () => {
    expect(resetTokenErrorMessage("expired")).toMatch(/منقضی/);
    expect(resetTokenErrorMessage("consumed")).toMatch(/استفاده شده/);
  });
});

describe("newPasswordResetCode", () => {
  it("is always six digits", () => {
    for (let i = 0; i < 20; i++) {
      expect(newPasswordResetCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("buildPasswordResetEmail", () => {
  it("includes the link and Persian code", () => {
    const { subject, body } = buildPasswordResetEmail({
      fullName: "علی",
      resetUrl: "http://localhost:3100/reset-password?token=abc",
      code: "123456",
      ttlMinutes: 15,
    });
    expect(subject).toContain("بازنشانی");
    expect(body).toContain("http://localhost:3100/reset-password?token=abc");
    expect(body).toContain("۱۲۳۴۵۶");
    expect(body).toContain("۱۵");
  });
});

describe("completePasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isLdapAuthEnabled).mockReturnValue(false);
    vi.mocked(prisma.$transaction).mockImplementation(async (ops: unknown) => ops as never);
  });

  it("rejects an expired token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      expiresAt: new Date(Date.now() - 60_000),
      consumedAt: null,
    } as never);

    await expect(
      completePasswordReset({ token: "deadbeef", newPassword: "NewPass1" }),
    ).rejects.toMatchObject({ status: 400, code: "EXPIRED" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a consumed token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
    } as never);

    await expect(
      completePasswordReset({ token: "used", newPassword: "NewPass1" }),
    ).rejects.toMatchObject({ status: 400, code: "CONSUMED" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an unknown token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null);
    await expect(
      completePasswordReset({ token: "nope", newPassword: "NewPass1" }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_RESET" });
  });

  it("updates the hash and clears sessions for a valid token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    } as never);
    vi.mocked(prisma.passwordResetToken.update).mockResolvedValue({} as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 1 } as never);

    await completePasswordReset({ token: "fresh", newPassword: "NewPass9" });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1" },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );
    const userUpdate = vi.mocked(prisma.user.update).mock.calls[0]?.[0] as {
      data: { passwordHash: string };
    };
    expect(userUpdate.data.passwordHash).toBeTruthy();
    expect(await bcrypt.compare("NewPass9", userUpdate.data.passwordHash)).toBe(true);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });

  it("blocks LDAP mode", async () => {
    vi.mocked(isLdapAuthEnabled).mockReturnValue(true);
    await expect(
      completePasswordReset({ token: "x", newPassword: "NewPass1" }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isLdapAuthEnabled).mockReturnValue(false);
  });

  it("returns generic sent for unknown identifier without creating a token", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const mail = { name: "mock-email", send: vi.fn() };
    const result = await requestPasswordReset("ghost@example.com", "http://localhost:3100", mail);
    expect(result.sent).toBe(true);
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("blocks LDAP mode", async () => {
    vi.mocked(isLdapAuthEnabled).mockReturnValue(true);
    await expect(requestPasswordReset("ali@example.com", "http://localhost:3100")).rejects.toMatchObject({
      code: "LDAP_PASSWORD",
    });
  });
});
