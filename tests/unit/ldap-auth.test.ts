import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockLdapClient } from "@/server/auth/ldap-client";
import {
  authenticateLogin,
  setLdapClientForTests,
} from "@/server/auth/login.service";
import { HttpError } from "@/server/auth/session";

vi.mock("@/server/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    role: { findUnique: vi.fn() },
    personDirectory: { upsert: vi.fn() },
  },
}));

import { prisma } from "@/server/db";

describe("LDAP login", () => {
  const originalAuthMode = process.env.AUTH_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_MODE = "ldap";
  });

  afterEach(() => {
    process.env.AUTH_MODE = originalAuthMode;
    setLdapClientForTests(null);
  });

  it("authenticates via mock LDAP and provisions new user", async () => {
    setLdapClientForTests(
      new MockLdapClient({
        "new@corp.com": {
          password: "ldap-pass",
          profile: {
            email: "new@corp.com",
            fullName: "کاربر جدید",
            department: "IT",
          },
        },
      }),
    );

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.role.findUnique).mockResolvedValue({ id: "role-1", key: "EMPLOYEE" } as never);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "u-new",
      email: "new@corp.com",
      fullName: "کاربر جدید",
      jobTitle: null,
      isActive: true,
      roles: [],
    } as never);
    vi.mocked(prisma.personDirectory.upsert).mockResolvedValue({} as never);

    const user = await authenticateLogin("new@corp.com", "ldap-pass");
    expect(user.email).toBe("new@corp.com");
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it("reuses existing DB user on LDAP login", async () => {
    setLdapClientForTests(
      new MockLdapClient({
        "ali@example.com": {
          password: "ldap-pass",
          profile: { email: "ali@example.com", fullName: "علی" },
        },
      }),
    );

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "ali@example.com",
      fullName: "علی",
      jobTitle: null,
      isActive: true,
      department: null,
      roles: [],
    } as never);

    const user = await authenticateLogin("ali@example.com", "ldap-pass");
    expect(user.id).toBe("u1");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects invalid LDAP credentials", async () => {
    setLdapClientForTests(new MockLdapClient({}));

    await expect(authenticateLogin("x@corp.com", "wrong")).rejects.toMatchObject({
      status: 401,
    });
  });

  it("local mode uses password hash in DB", async () => {
    process.env.AUTH_MODE = "local";
    setLdapClientForTests(null);

    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("Pass1234", 10);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
      fullName: "Admin",
      jobTitle: null,
      isActive: true,
      passwordHash: hash,
    } as never);

    const user = await authenticateLogin("admin@example.com", "Pass1234");
    expect(user.id).toBe("u1");
  });

  it("local mode accepts Iranian mobile", async () => {
    process.env.AUTH_MODE = "local";
    setLdapClientForTests(null);

    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("Pass1234", 10);

    vi.mocked(prisma.user.findUnique).mockImplementation((async (args: { where: { email?: string; phone?: string } }) => {
      const where = args.where;
      if (where.phone === "09120001001" || where.email === "admin@example.com") {
        return {
          id: "u1",
          email: "admin@example.com",
          fullName: "Admin",
          jobTitle: null,
          isActive: true,
          passwordHash: hash,
        };
      }
      return null;
    }) as never);

    const user = await authenticateLogin("۰۹۱۲۰۰۰۱۰۰۱", "Pass1234");
    expect(user.id).toBe("u1");
    expect(user.email).toBe("admin@example.com");
  });

  it("LDAP phone login binds with the stored email", async () => {
    setLdapClientForTests(
      new MockLdapClient({
        "ali@example.com": {
          password: "ldap-pass",
          profile: { email: "ali@example.com", fullName: "علی" },
        },
      }),
    );

    vi.mocked(prisma.user.findUnique).mockImplementation((async (args: { where: { email?: string; phone?: string } }) => {
      const where = args.where;
      if (where.phone === "09120001006" || where.email === "ali@example.com") {
        return {
          id: "u1",
          email: "ali@example.com",
          fullName: "علی",
          jobTitle: null,
          isActive: true,
          department: null,
          roles: [],
        };
      }
      return null;
    }) as never);

    const user = await authenticateLogin("09120001006", "ldap-pass");
    expect(user.id).toBe("u1");
  });

  it("rejects an identifier that is neither email nor mobile", async () => {
    process.env.AUTH_MODE = "local";
    await expect(authenticateLogin("not-a-login", "Pass1234")).rejects.toMatchObject({
      status: 400,
      code: "INVALID_IDENTIFIER",
    });
  });

  it("rejects disabled accounts after LDAP bind", async () => {
    setLdapClientForTests(
      new MockLdapClient({
        "off@corp.com": {
          password: "pw",
          profile: { email: "off@corp.com", fullName: "Off" },
        },
      }),
    );

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u-off",
      email: "off@corp.com",
      fullName: "Off",
      isActive: false,
      jobTitle: null,
      department: null,
      roles: [],
    } as never);

    await expect(authenticateLogin("off@corp.com", "pw")).rejects.toBeInstanceOf(HttpError);
  });
});
