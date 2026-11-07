import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { ok, handleError } from "@/server/http";
import { getEffectiveLdapConfig } from "@/server/auth/ldap-settings.service";
import { createLdapClient } from "@/server/auth/ldap-client";

export const dynamic = "force-dynamic";

/**
 * جستجوی زنده‌ی کاربران LDAP برای PeoplePicker — وقتی دایرکتوری محلی خالی/کم است.
 * فقط سازمان‌هایی که LDAP فعال دارند. نیاز به نقش مدیریت ندارد (کاربر عادی هم باید بتواند همکار پیدا کند).
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireUser();
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return ok({ users: [], source: "ldap" });

    const cfg = await getEffectiveLdapConfig(actor.orgId);
    if (!cfg?.enabled || !cfg.url || !cfg.baseDn || !cfg.bindDn) {
      return ok({ users: [], source: "ldap-disabled" });
    }

    // دنبال بگردیم: نام یا ایمیل حاوی q
    const client = createLdapClient({
      url: cfg.url, baseDn: cfg.baseDn, bindDn: cfg.bindDn,
      bindPassword: cfg.bindPassword, userFilter: cfg.userFilter,
      tlsRejectUnauthorized: cfg.tlsRejectUnauthorized,
    });
    const all = await client.listUsers(200).catch(() => []);
    const needle = q.toLowerCase();
    const matches = all
      .filter(
        (u) =>
          u.fullName.toLowerCase().includes(needle) ||
          (u.email ?? "").toLowerCase().includes(needle),
      )
      .slice(0, 20);

    // دایرکتوری محلی را هم نگاه کن — اگر از قبل provision شده، id محلی را برگردان
    const emails = matches.map((m) => m.email.toLowerCase());
    const local = emails.length
      ? await prisma.personDirectory.findMany({
          where: { orgId: actor.orgId, email: { in: emails } },
          select: { email: true, userId: true, id: true },
        })
      : [];
    const localByEmail = new Map(
      local.map((l) => [String(l.email ?? "").toLowerCase(), l]),
    );

    const users = matches.map((m) => {
      const l = localByEmail.get(m.email.toLowerCase());
      return {
        email: m.email,
        fullName: m.fullName,
        jobTitle: m.jobTitle ?? null,
        department: m.department ?? null,
        // اگر قبلاً provision شده، ref محلی — وگرنه provision هنگام انتخاب لازم است
        directoryId: l?.id ?? null,
        provisioned: Boolean(l?.userId),
      };
    });

    return ok({ users, source: "ldap" });
  } catch (e) {
    return handleError(e);
  }
}
