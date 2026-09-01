import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const publicDir = join(process.cwd(), "public");

describe("public static assets", () => {
  it("includes logo-white.png for sidebar/login/404", () => {
    const logo = join(publicDir, "logo-white.png");
    expect(existsSync(logo)).toBe(true);
    expect(statSync(logo).size).toBeGreaterThan(100);
  });

  it("includes PWA shell files", () => {
    for (const rel of ["sw.js", "offline.html", "apple-touch-icon.png"]) {
      const path = join(publicDir, rel);
      expect(existsSync(path), rel).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(100);
    }
    for (const icon of ["icon-192.png", "icon-512.png", "icon-maskable-192.png", "icon-maskable-512.png"]) {
      const path = join(publicDir, "icons", icon);
      expect(existsSync(path), icon).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(100);
    }
  });

  for (const file of [
    "Alibaba-Regular.woff2",
    "Alibaba-Bold.woff2",
    "Alibaba-Black.woff2",
  ]) {
    it(`includes font ${file}`, () => {
      const path = join(publicDir, "fonts", file);
      expect(existsSync(path)).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(1000);
    });
  }
});
