import { describe, expect, it, vi } from "vitest";
import { HttpError } from "@/server/auth/session";
import { orgFilter, requireOrgId } from "@/server/tenant";
import type { AuthUser } from "@/server/auth/session";

vi.mock("@/server/db", () => ({ prisma: {} }));

function user(partial: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "a@example.com",
    fullName: "a",
    phone: null,
    avatarUrl: null,
    jobTitle: null,
    department: null,
    orgId: "org-main",
    orgSlug: "sample",
    isPlatformAdmin: false,
    isSuperAdmin: false,
    branchId: null,
    permissions: new Set(),
    roleKeys: [],
    ...partial,
  };
}

describe("tenant requireOrgId", () => {
  it("returns the session tenant", () => {
    expect(requireOrgId(user())).toBe("org-main");
    expect(orgFilter(user())).toEqual({ orgId: "org-main" });
  });

  it("rejects a user without org", () => {
    expect(() => requireOrgId(user({ orgId: "" }))).toThrow(HttpError);
  });
});
