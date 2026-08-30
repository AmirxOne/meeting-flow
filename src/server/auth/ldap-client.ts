import ldap from "ldapjs";
import {
  buildLdapUserFilter,
  resolveLdapConfig,
  type LdapConfig,
} from "./auth-config";

export interface LdapUserProfile {
  email: string;
  fullName: string;
  department?: string;
  jobTitle?: string;
}

export interface LdapClient {
  authenticate(email: string, password: string): Promise<LdapUserProfile | null>;
}

function promisifyBind(client: ldap.Client, dn: string, secret: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(dn, secret, (err) => (err ? reject(err) : resolve()));
  });
}

function promisifyUnbind(client: ldap.Client): Promise<void> {
  return new Promise((resolve) => {
    client.unbind(() => resolve());
  });
}

function searchUserDn(
  client: ldap.Client,
  config: LdapConfig,
  email: string,
): Promise<{ dn: string; attrs: Record<string, string> } | null> {
  const filter = buildLdapUserFilter(config.userFilter, email);

  return new Promise((resolve, reject) => {
    client.search(
      config.baseDn,
      {
        scope: "sub",
        filter,
        attributes: ["mail", "cn", "displayName", "department", "title"],
        sizeLimit: 2,
      },
      (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        const entries: ldap.SearchEntry[] = [];
        res.on("searchEntry", (entry) => entries.push(entry));
        res.on("error", (searchErr) => reject(searchErr));
        res.on("end", () => {
          if (entries.length === 0) {
            resolve(null);
            return;
          }
          resolve({ dn: entries[0].dn.toString(), attrs: attrsFromEntry(entries[0]) });
        });
      },
    );
  });
}

function attrsFromEntry(entry: ldap.SearchEntry): Record<string, string> {
  const out: Record<string, string> = {};
  for (const attr of entry.attributes) {
    const val = attr.vals?.[0];
    if (val != null) out[attr.type] = val.toString();
  }
  return out;
}

function readAttr(attrs: Record<string, string>, key: string): string | undefined {
  return attrs[key];
}

function profileFromAttrs(email: string, attrs: Record<string, string>): LdapUserProfile {
  const mail = readAttr(attrs, "mail")?.toLowerCase() ?? email.toLowerCase();
  const fullName =
    readAttr(attrs, "displayName") ??
    readAttr(attrs, "cn") ??
    mail.split("@")[0];

  return {
    email: mail,
    fullName,
    department: readAttr(attrs, "department"),
    jobTitle: readAttr(attrs, "title"),
  };
}

/** Real LDAP client using ldapjs service-account search + user bind. */
export class LdapJsClient implements LdapClient {
  constructor(private readonly config: LdapConfig) {}

  async authenticate(email: string, password: string): Promise<LdapUserProfile | null> {
    const searchClient = ldap.createClient({
      url: this.config.url,
      tlsOptions: { rejectUnauthorized: this.config.tlsRejectUnauthorized },
    });

    let userDn: string | null = null;
    let attrs: Record<string, string> = {};

    try {
      await promisifyBind(searchClient, this.config.bindDn, this.config.bindPassword);
      const found = await searchUserDn(searchClient, this.config, email);
      if (!found) return null;
      userDn = found.dn;
      attrs = found.attrs;
    } catch {
      return null;
    } finally {
      await promisifyUnbind(searchClient).catch(() => {});
    }

    const userClient = ldap.createClient({
      url: this.config.url,
      tlsOptions: { rejectUnauthorized: this.config.tlsRejectUnauthorized },
    });

    try {
      await promisifyBind(userClient, userDn, password);
      return profileFromAttrs(email, attrs);
    } catch {
      return null;
    } finally {
      await promisifyUnbind(userClient).catch(() => {});
    }
  }
}

/** In-memory LDAP for dev/tests. */
export class MockLdapClient implements LdapClient {
  constructor(
    private readonly users: Record<
      string,
      { password: string; profile: LdapUserProfile }
    >,
  ) {}

  async authenticate(email: string, password: string): Promise<LdapUserProfile | null> {
    const key = email.toLowerCase();
    const row = this.users[key];
    if (!row || row.password !== password) return null;
    return row.profile;
  }
}

export function createLdapClient(config: LdapConfig = resolveLdapConfig()): LdapClient {
  return new LdapJsClient(config);
}
