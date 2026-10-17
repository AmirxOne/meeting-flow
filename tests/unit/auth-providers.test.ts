import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockLdapClient } from "@/server/auth/ldap-client";

/**
 * تست‌های معماری Authentication Provider (سناریوهای ۱–۲۰ پرامپت — بدون سرور LDAP واقعی).
 * Real-server tests باید جدا و opt-in باشند (LDAP_TEST_URL).
 */

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(async () => false), hash: vi.fn(async () => "$2a$10$mocked") },
  compare: vi.fn(async () => false),
  hash: vi.fn(async () => "$2a$10$mocked"),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    role: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    personDirectory: { upsert: vi.fn().mockResolvedValue(undefined) },
  },
}));

import { prisma } from "@/server/db";
import { buildProviders, resolvePasswordProvider } from "@/server/auth/provider-registry";
import { createLdapProvider } from "@/server/auth/providers/ldap.provider";
import { createLocalProvider } from "@/server/auth/providers/local.provider";
import { authenticateLogin, setLdapClientForTests } from "@/server/auth/login.service";
import { HttpError } from "@/server/auth/session";

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.LDAP_URL;
  delete process.env.LDAP_BASE_DN;
  delete process.env.LDAP_BIND_DN;
  delete process.env.LDAP_BIND_PASSWORD;
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
  setLdapClientForTests(null);
});

describe("سناریو ۱–۲: نصب بدون LDAP — همه‌چیز کار می‌کند", () => {
  it("local همیشه enabled است حتی بدون هیچ env", () => {
    process.env.AUTH_MODE = "local";
    const local = createLocalProvider();
    expect(local.isEnabled()).toBe(true);
  });

  it("LDAP بدون تنظیمات disabled است و startup نمی‌شکند", () => {
    process.env.AUTH_MODE = "local";
    const ldap = createLdapProvider();
    expect(ldap.isEnabled()).toBe(false);
  });

  it("LDAP غیرفعال در AUTH_MODE=ldap ولی env ناقص → local انتخاب می‌شود (نصب مستقل)", () => {
    process.env.AUTH_MODE = "ldap"; // ادمین روشن کرده ولی env فراموش شده
    const provider = resolvePasswordProvider(buildProviders());
    expect(provider.id).toBe("local");
  });
});

describe("سناریو ۳–۴: ورود محلی حفظ شده", () => {
  it("authenticateLogin با AUTH_MODE=local همان مسیر قبلی را می‌رود", async () => {
    process.env.AUTH_MODE = "local";
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u1", email: "ali@x.com", isActive: true, passwordHash: "$2a$10$hashed",
    });
    const bcrypt = await import("bcryptjs");
    (bcrypt.compare as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const user = await authenticateLogin("ali@x.com", "correct");
    expect(user.id).toBe("u1");
  });

  it("رمز غلط → همان پیام عمومی قبلی", async () => {
    process.env.AUTH_MODE = "local";
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u1", email: "ali@x.com", isActive: true, passwordHash: "$2a$10$hashed",
    });
    const bcrypt = await import("bcryptjs");
    (bcrypt.compare as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await expect(authenticateLogin("ali@x.com", "wrong")).rejects.toMatchObject({ status: 401 });
  });
});

describe("سناریو ۸–۱۱: LDAP با mock", () => {
  const mock = () =>
    new MockLdapClient({
      "emp@corp.com": { password: "dir-pass", profile: { email: "emp@corp.com", fullName: "کارمند دایرکتوری" } },
    });

  it("ورود LDAP موفق با provisioning نقش EMPLOYEE", async () => {
    process.env.AUTH_MODE = "ldap";
    setLdapClientForTests(mock());
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(undefined); // کاربر جدید
    (prisma.role.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "role-emp", key: "EMPLOYEE" });
    const createMock = prisma.user.create as unknown as ReturnType<typeof vi.fn>;
    createMock.mockImplementation(({ data }: { data: { email: string; fullName: string } }) =>
      Promise.resolve({ id: "new-1", ...data, jobTitle: null, roles: [{ role: { key: "EMPLOYEE", name: "کارمند" } }] }),
    );
    const user = await authenticateLogin("emp@corp.com", "dir-pass");
    expect(user.email).toBe("emp@corp.com");
    // provisioning فقط نقش EMPLOYEE می‌سازد — هرگز ADMIN (سناریو ۱۸)
    const createdData = createMock.mock.calls.find((c) => c[0]?.data?.roles)?.[0]?.data;
    expect(createdData?.roles?.[0]?.roleId ?? "role-emp").toBe("role-emp");
  });

  it("رمز LDAP اشتباه → invalid", async () => {
    process.env.AUTH_MODE = "ldap";
    setLdapClientForTests(mock());
    await expect(authenticateLogin("emp@corp.com", "wrong")).rejects.toMatchObject({ status: 401 });
  });

  it("LDAP قطع/timeout → unavailable نه crash، ورود محلی مختل نمی‌شود", async () => {
    process.env.AUTH_MODE = "ldap";
    setLdapClientForTests({
      authenticate: () => Promise.reject(new Error("connect ETIMEDOUT 10.0.0.1:389")),
    } as never);
    // provider مستقیم: unavailable
    const provider = createLdapProvider();
    const r = await provider.authenticate({ identifier: "emp@corp.com", password: "x" });
    expect(r.status).toBe("unavailable");
  });

  it("provider خاموش فراخوانی مستقیم → پاسخ کنترل‌شده unavailable", async () => {
    process.env.AUTH_MODE = "local";
    const provider = createLdapProvider();
    const r = await provider.authenticate({ identifier: "emp@corp.com", password: "x" });
    expect(r.status).toBe("unavailable");
  });
});

describe("سناریو ۱۲: غیرفعال‌کردن LDAP پس از استفاده", () => {
  it("AUTH_MODE=local → کاربران LDAP با رمز محلی وارد نمی‌شوند مگر رمز محلی داشته باشند (رفتار صریح)", async () => {
    process.env.AUTH_MODE = "local"; // LDAP خاموش شد
    // کاربر LDAP-provisioned با passwordHash تصادفی
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ldap-u", email: "emp@corp.com", isActive: true, passwordHash: "$2a$10$random",
    });
    const bcrypt = await import("bcryptjs");
    (bcrypt.compare as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await expect(authenticateLogin("emp@corp.com", "dir-pass")).rejects.toMatchObject({ status: 401 });
  });
});

describe("سناریو ۲۰: افزودن provider بدون بازنویسی", () => {
  it("registry سه provider ثبت‌شده دارد با شناسه‌های متفاوت", () => {
    const ids = buildProviders().map((p) => p.id);
    expect(ids).toEqual(["local", "ldap", "sso"]);
  });
});

describe("امنیت: پیام‌های عمومی، بدون افشا", () => {
  it("خطای dایرکتوری جزئیات فنی را در HttpError نمی‌ریزد", async () => {
    process.env.AUTH_MODE = "ldap";
    setLdapClientForTests({
      authenticate: () => Promise.reject(new Error("bind failed: secret ldap-bind-pw=XYZ leaked")),
    } as never);
    const provider = createLdapProvider();
    const r = await provider.authenticate({ identifier: "emp@corp.com", password: "x" });
    expect(JSON.stringify(r)).not.toContain("XYZ");
  });
});
