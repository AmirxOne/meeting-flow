import { describe, it, expect } from "vitest";
import { isPlatformSetupOpen } from "@/server/services/platform-setup.service";
import { normalizeOrgSlug, proposeOrgSlug } from "@/lib/org-slug";

describe("isPlatformSetupOpen", () => {
  it("is open only when org count is zero", () => {
    expect(isPlatformSetupOpen(0)).toBe(true);
    expect(isPlatformSetupOpen(1)).toBe(false);
    expect(isPlatformSetupOpen(3)).toBe(false);
  });
});

describe("proposeOrgSlug", () => {
  it("transliterates Persian org names", () => {
    expect(proposeOrgSlug("شرکت نمونه")).toBe("shrkt-nmonh");
  });

  it("keeps latin slugs", () => {
    expect(proposeOrgSlug("Acme Corp")).toBe("acme-corp");
  });

  it("returns empty for invalid-only input", () => {
    expect(proposeOrgSlug("!!!")).toBe("");
  });

  it("normalize accepts proposed slug", () => {
    const s = proposeOrgSlug("تست");
    expect(s.length).toBeGreaterThan(0);
    expect(normalizeOrgSlug(s)).toBe(s);
  });
});
