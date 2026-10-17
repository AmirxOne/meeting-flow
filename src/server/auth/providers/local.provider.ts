import type { AuthProvider, AuthResult, CredentialsInput } from "../provider";
import { prisma } from "@/server/db";
import { compare } from "bcryptjs";
import { parseLoginIdentifier } from "@/lib/login-identifier";

/**
 * Local Authentication — روش ورود پیش‌فرض.
 * بدون هیچ تنظیمات خارجی کار می‌کند؛ رفتار فعلی پروژه دست‌نخورده.
 */
export function createLocalProvider(): AuthProvider {
  return {
    id: "local",
    label: "ورود با رمز (محلی)",
    isEnabled: () => true, // همیشه در دسترس — پیش‌فرض نصب

    async authenticate(input: CredentialsInput): Promise<AuthResult> {
      const parsed = parseLoginIdentifier(input.identifier);
      if (!parsed) return { status: "invalid" };

      const user = parsed.kind === "email"
        ? await prisma.user.findUnique({ where: { email: parsed.value } })
        : await prisma.user.findUnique({ where: { phone: parsed.value } });

      if (!user) return { status: "invalid" };
      if (!user.isActive) return { status: "disabled" };

      const valid = await compare(input.password, user.passwordHash);
      if (!valid) return { status: "invalid" };

      return {
        status: "ok",
        user: { id: user.id, email: user.email, fullName: user.fullName, jobTitle: user.jobTitle },
      };
    },
  };
}

