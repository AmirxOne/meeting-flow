import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("PWA shell service worker", () => {
  const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

  it("caches shell assets and skips API / Next runtime", () => {
    expect(sw).toContain("mehrsa-shell-v2");
    expect(sw).toContain("/offline.html");
    expect(sw).toContain("addEventListener(\"fetch\"");
    expect(sw).toContain("/api/");
    expect(sw).toContain("/_next/");
  });

  it("handles Web Push and notification click", () => {
    expect(sw).toContain("addEventListener(\"push\"");
    expect(sw).toContain("showNotification");
    expect(sw).toContain("notificationclick");
    expect(sw).toContain("dir: \"rtl\"");
  });
});
