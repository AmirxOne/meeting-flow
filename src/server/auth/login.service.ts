import { compare } from "bcryptjs";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { parseLoginIdentifier, type ParsedLoginIdentifier } from "@/lib/login-identifier";
import { isLdapAuthEnabled, parseAuthMode } from "./auth-config";
import { createLdapClient, type LdapClient } from "./ldap-client";
import { findOrProvisionLdapUser } from "./ldap-user.service";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
}

const CREDENTIALS_MSG = "ایمیل، شماره موبایل یا رمز عبور اشتباه است";

let ldapClientOverride: LdapClient | null = null;

/** Test hook — inject mock LDAP client. */
export function setLdapClientForTests(client: LdapClient | null): void {
  ldapClientOverride = client;
}

function getLdapClient(): LdapClient {
  return ldapClientOverride ?? createLdapClient();
}

function toAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
}): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    jobTitle: user.jobTitle,
  };
}

async function findUserByIdentifier(parsed: ParsedLoginIdentifier) {
  return parsed.kind === "email"
    ? prisma.user.findUnique({ where: { email: parsed.value } })
    : prisma.user.findUnique({ where: { phone: parsed.value } });
}

async function authenticateLocal(
  parsed: ParsedLoginIdentifier,
  password: string,
): Promise<AuthenticatedUser> {
  const user = await findUserByIdentifier(parsed);

  if (!user || !user.isActive) {
    throw new HttpError(401, CREDENTIALS_MSG, "BAD_CREDENTIALS");
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, CREDENTIALS_MSG, "BAD_CREDENTIALS");
  }

  return toAuthUser(user);
}

async function authenticateLdap(
  parsed: ParsedLoginIdentifier,
  password: string,
): Promise<AuthenticatedUser> {
  let email = parsed.kind === "email" ? parsed.value : null;
  if (parsed.kind === "phone") {
    const local = await findUserByIdentifier(parsed);
    if (!local || !local.isActive) {
      throw new HttpError(401, CREDENTIALS_MSG, "BAD_CREDENTIALS");
    }
    email = local.email;
  }

  const profile = await getLdapClient().authenticate(email!, password);
  if (!profile) {
    throw new HttpError(401, CREDENTIALS_MSG, "BAD_CREDENTIALS");
  }

  const user = await findOrProvisionLdapUser(profile);
  return toAuthUser(user);
}

/** Resolve credentials (email or Iranian mobile) according to AUTH_MODE. */
export async function authenticateLogin(
  identifier: string,
  password: string,
): Promise<AuthenticatedUser> {
  const parsed = parseLoginIdentifier(identifier);
  if (!parsed) {
    throw new HttpError(400, "ایمیل یا شماره موبایل نامعتبر است", "INVALID_IDENTIFIER");
  }
  if (isLdapAuthEnabled()) {
    return authenticateLdap(parsed, password);
  }
  return authenticateLocal(parsed, password);
}

export { parseAuthMode, isLdapAuthEnabled };
