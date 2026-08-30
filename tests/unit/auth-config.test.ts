import { describe, it, expect } from "vitest";
import {
  parseAuthMode,
  escapeLdapFilter,
  buildLdapUserFilter,
  resolveLdapConfig,
} from "@/server/auth/auth-config";

describe("parseAuthMode", () => {
  it("defaults to local", () => {
    expect(parseAuthMode(undefined)).toBe("local");
    expect(parseAuthMode("")).toBe("local");
  });

  it("recognizes ldap", () => {
    expect(parseAuthMode("ldap")).toBe("ldap");
    expect(parseAuthMode("LDAP")).toBe("ldap");
  });
});

describe("escapeLdapFilter", () => {
  it("escapes special LDAP characters", () => {
    expect(escapeLdapFilter("user*test")).toContain("\\2a");
    expect(escapeLdapFilter("(admin)")).toContain("\\28");
  });
});

describe("buildLdapUserFilter", () => {
  it("interpolates email into filter template", () => {
    expect(buildLdapUserFilter("(mail={{email}})", "Ali@Test.com")).toBe(
      "(mail=ali@test.com)",
    );
  });
});

describe("resolveLdapConfig", () => {
  it("throws when required vars missing", () => {
    expect(() => resolveLdapConfig({})).toThrow(/LDAP_URL/);
  });

  it("reads config from env object", () => {
    const cfg = resolveLdapConfig({
      LDAP_URL: "ldap://localhost",
      LDAP_BASE_DN: "dc=test,dc=com",
      LDAP_BIND_DN: "cn=admin,dc=test,dc=com",
      LDAP_BIND_PASSWORD: "pw",
      LDAP_USER_FILTER: "(uid={{email}})",
    });
    expect(cfg.url).toBe("ldap://localhost");
    expect(cfg.userFilter).toBe("(uid={{email}})");
  });
});
