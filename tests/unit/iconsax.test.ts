import { describe, expect, it } from "vitest";
import { ICONSAX_GLYPHS, ICONSAX_MAP } from "@/lib/iconsax-glyphs";

describe("official Iconsax glyphs", () => {
  it("maps every used icon to a non-empty SVG", () => {
    const ids = [...new Set(Object.values(ICONSAX_MAP))];
    expect(ids.length).toBeGreaterThan(20);
    for (const id of ids) {
      const svg = ICONSAX_GLYPHS[id];
      expect(svg, id).toMatch(/^<svg[\s>]/);
      expect(svg).toContain("currentColor");
    }
  });

  it("does not keep lucide package names as glyph ids", () => {
    expect(ICONSAX_MAP.LayoutDashboard).toBe("category");
    expect(ICONSAX_MAP.LifeBuoy).toBe("lifebuoy");
    expect(ICONSAX_MAP.Plus).toBe("add");
  });
});
