import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSession } from "@/server/auth/session";
import { ok } from "@/server/http";
import type { AuthenticatedUser } from "@/server/auth/login.service";
import { prisma } from "@/server/db";
import { ORG_COOKIE, SAMPLE_ORG_SLUG } from "@/lib/org-slug";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Number(process.env.SESSION_TTL_HOURS ?? 72) * 3600,
  };
}

function orgCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

async function resolveLoginOrg(userId: string, requestedSlug?: string) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      orgId: true,
      isSuperAdmin: true,
      org: { select: { slug: true } },
    },
  });
  const slug = requestedSlug || dbUser?.org?.slug || SAMPLE_ORG_SLUG;
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  });
  return {
    orgId: org?.id ?? dbUser?.orgId ?? null,
    slug: org?.slug ?? slug,
  };
}

/** Attach session cookie to a login success response. */
export async function buildLoginResponse(user: AuthenticatedUser, orgSlug?: string) {
  const org = await resolveLoginOrg(user.id, orgSlug);
  const token = await createSession(user.id, org.orgId);
  const res = ok({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      jobTitle: user.jobTitle,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  res.cookies.set(ORG_COOKIE, org.slug, orgCookieOptions());
  return res;
}

export async function redirectWithSession(userId: string, url: string, orgSlug?: string) {
  const org = await resolveLoginOrg(userId, orgSlug);
  const token = await createSession(userId, org.orgId);
  const res = NextResponse.redirect(url);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  res.cookies.set(ORG_COOKIE, org.slug, orgCookieOptions());
  return res;
}

export function buildLogoutResponse() {
  const res = NextResponse.json({ ok: true, data: { loggedOut: true } });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(ORG_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
