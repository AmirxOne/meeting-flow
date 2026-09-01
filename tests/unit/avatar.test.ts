import { describe, expect, it } from "vitest";
import {
  AVATAR_MAX_BYTES,
  avatarStorageKey,
  mimeForAvatarExt,
  publicAvatarPath,
  squareCoverLayout,
} from "@/lib/avatar";

describe("avatar helpers", () => {
  it("builds a stable public path with optional cache-bust", () => {
    expect(publicAvatarPath("u1")).toBe("/api/avatars/u1");
    expect(publicAvatarPath("u1", 99)).toBe("/api/avatars/u1?v=99");
  });

  it("scopes storage keys by tenant", () => {
    expect(avatarStorageKey("org-a", "u1", "png")).toBe("avatars/org-a/u1.png");
    expect(avatarStorageKey(null, "u1", "jpg")).toBe("avatars/platform/u1.jpg");
  });

  it("maps extension to mime", () => {
    expect(mimeForAvatarExt("jpg")).toBe("image/jpeg");
    expect(mimeForAvatarExt("png")).toBe("image/png");
    expect(mimeForAvatarExt("webp")).toBe("image/webp");
  });

  it("center-crops a landscape image to a square", () => {
    const layout = squareCoverLayout(400, 200, 200, 1, 0, 0);
    expect(layout.sx).toBeCloseTo(100);
    expect(layout.sy).toBeCloseTo(0);
    expect(layout.sw).toBeCloseTo(200);
    expect(layout.sh).toBeCloseTo(200);
    expect(layout.panX).toBe(0);
  });

  it("fills a square image without crop at zoom 1", () => {
    const layout = squareCoverLayout(200, 200, 200, 1, 0, 0);
    expect(layout.sx).toBeCloseTo(0);
    expect(layout.sw).toBeCloseTo(200);
  });

  it("clamps pan so the square stays covered", () => {
    const layout = squareCoverLayout(400, 200, 200, 1, 9999, 9999);
    expect(layout.panX).toBe(100);
    expect(layout.panY).toBe(0);
    expect(layout.sx + layout.sw).toBeLessThanOrEqual(400.001);
    expect(layout.sx).toBeGreaterThanOrEqual(-0.001);
  });

  it("keeps a 2MB upload cap", () => {
    expect(AVATAR_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
});
