import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    session: { deleteMany: vi.fn() },
    personDirectory: { upsert: vi.fn() },
  },
}));

vi.mock("@/server/auth/auth-config", () => ({
  isLdapAuthEnabled: vi.fn(() => false),
}));

import { prisma } from "@/server/db";
import { isLdapAuthEnabled } from "@/server/auth/auth-config";
import { changeOwnPassword, updateSelfProfile } from "@/server/services/profile.service";
import { HttpError } from "@/server/auth/session";

describe("profile.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isLdapAuthEnabled).mockReturnValue(false);
  });

  it("changeOwnPassword rejects wrong current password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      isActive: true,
      passwordHash: await bcrypt.hash("Pass1234", 10),
    } as never);

    await expect(changeOwnPassword("u1", "wrong", "NewPass1")).rejects.toMatchObject({
      status: 401,
      code: "BAD_CREDENTIALS",
    });
  });

  it("changeOwnPassword updates hash and clears sessions", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      isActive: true,
      passwordHash: await bcrypt.hash("Pass1234", 10),
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 2 } as never);

    await changeOwnPassword("u1", "Pass1234", "NewPass9");

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" } }),
    );
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });

  it("changeOwnPassword blocks LDAP mode", async () => {
    vi.mocked(isLdapAuthEnabled).mockReturnValue(true);
    await expect(changeOwnPassword("u1", "a", "bbbbbb")).rejects.toBeInstanceOf(HttpError);
  });

  it("updateSelfProfile updates allowed fields", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      isActive: true,
      email: "ali@example.com",
      fullName: "قدیم",
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: "u1",
      email: "ali@example.com",
      fullName: "جدید",
      phone: null,
      jobTitle: "کارشناس",
      department: "فروش",
      branchId: "b1",
    } as never);
    vi.mocked(prisma.personDirectory.upsert).mockResolvedValue({} as never);

    const updated = await updateSelfProfile("u1", {
      fullName: "جدید",
      jobTitle: "کارشناس",
      department: "فروش",
    });

    expect(updated.fullName).toBe("جدید");
    expect(prisma.user.update).toHaveBeenCalled();
  });
});
