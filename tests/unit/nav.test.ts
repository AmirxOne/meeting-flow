import { describe, expect, it } from "vitest";
import { NAV, groupedVisibleNav, isNavActive, isMobileNavActive, MOBILE_NAV } from "@/lib/nav";

const permsOf =
  (...keys: string[]) =>
  (perm: string) =>
    keys.includes(perm);

describe("nav visibility", () => {
  it("shows public items to every role", () => {
    const groups = groupedVisibleNav(permsOf());
    expect(groups.map((g) => g.id)).toEqual(["main", "org", "system"]);
    expect(groups[0].items.map((i) => i.href)).toEqual([
      "/dashboard",
      "/calendar",
      "/meetings",
      "/availability",
    ]);
    expect(groups[2].items.map((i) => i.href)).toEqual(["/notifications"]);
  });

  it("hides reports and admin from employees", () => {
    const hrefs = groupedVisibleNav(permsOf()).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).not.toContain("/reports");
    expect(hrefs).not.toContain("/admin");
    expect(hrefs).not.toContain("/admin/audit-logs");
  });

  it("shows reports + admin (not audit) when user can update users", () => {
    const hrefs = groupedVisibleNav(permsOf("report:view", "audit:view", "user:update")).flatMap(
      (g) => g.items.map((i) => i.href),
    );
    expect(hrefs).toContain("/reports");
    expect(hrefs).toContain("/admin");
    expect(hrefs).not.toContain("/admin/audit-logs");
  });

  it("shows audit log instead of admin when only audit:view is granted", () => {
    const hrefs = groupedVisibleNav(permsOf("audit:view")).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/admin/audit-logs");
    expect(hrefs).not.toContain("/admin");
  });

  it("keeps a group that still has public items", () => {
    const groups = groupedVisibleNav(() => false);
    expect(groups.find((g) => g.id === "system")?.items.map((i) => i.href)).toEqual([
      "/notifications",
    ]);
  });

  it("keeps dashboard as the first visible item (tour target)", () => {
    const first = groupedVisibleNav(permsOf())[0]?.items[0];
    expect(first?.href).toBe("/dashboard");
    expect(first?.label).toBe("داشبورد");
  });
});

describe("isNavActive", () => {
  const siblings = NAV.map((n) => n.href);

  it("matches exact path and nested routes", () => {
    expect(isNavActive("/meetings", "/meetings", siblings)).toBe(true);
    expect(isNavActive("/meetings/abc", "/meetings", siblings)).toBe(true);
    expect(isNavActive("/calendar", "/meetings", siblings)).toBe(false);
  });

  it("prefers the more specific sibling over /admin", () => {
    expect(isNavActive("/admin/audit-logs", "/admin", siblings)).toBe(false);
    expect(isNavActive("/admin/audit-logs", "/admin/audit-logs", siblings)).toBe(true);
    expect(isNavActive("/admin/users", "/admin", siblings)).toBe(true);
  });
});

describe("mobile bottom nav", () => {
  it("includes جلسات من as a primary tab", () => {
    expect(MOBILE_NAV.map((i) => i.href)).toContain("/meetings");
    expect(MOBILE_NAV.find((i) => i.href === "/meetings")?.label).toBe("جلسات من");
  });

  it("highlights meetings list and detail, not the new-meeting wizard", () => {
    expect(isMobileNavActive("/meetings", "/meetings")).toBe(true);
    expect(isMobileNavActive("/meetings/abc", "/meetings")).toBe(true);
    expect(isMobileNavActive("/meetings/new", "/meetings")).toBe(false);
    expect(isMobileNavActive("/meetings/new", "/meetings/new")).toBe(true);
  });
});
