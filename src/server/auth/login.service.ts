import { compare } from "bcryptjs";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { isLdapAuthEnabled, parseAuthMode } from "./auth-config";
import { createLdapClient, type LdapClient } from "./ldap-client";
import { findOrProvisionLdapUser } from "./ldap-user.service";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
}

let ldapClientOverride: LdapClient | null = null;

/** Test hook — inject mock LDAP client. */
export function setLdapClientForTests(client: LdapClient | null): void {
  ldapClientOverride = client;
}

function getLdapClient(): LdapClient {
  return ldapClientOverride ?? createLdapClient();
}

async function authenticateLocal(email: string, password: string): Promise<AuthenticatedUser> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, "ایمیل یا رمز عبور اشتباه است", "BAD_CREDENTIALS");
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, "ایمیل یا رمز عبور اشتباه است", "BAD_CREDENTIALS");
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    jobTitle: user.jobTitle,
  };
}

async function authenticateLdap(email: string, password: string): Promise<AuthenticatedUser> {
  const profile = await getLdapClient().authenticate(email, password);
  if (!profile) {
    throw new HttpError(401, "ایمیل یا رمز عبور اشتباه است", "BAD_CREDENTIALS");
  }

  const user = await findOrProvisionLdapUser(profile);
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    jobTitle: user.jobTitle,
  };
}

/** Resolve credentials according to AUTH_MODE. */
export async function authenticateLogin(
  email: string,
  password: string,
): Promise<AuthenticatedUser> {
  if (isLdapAuthEnabled()) {
    return authenticateLdap(email, password);
  }
  return authenticateLocal(email, password);
}

export { parseAuthMode, isLdapAuthEnabled };
