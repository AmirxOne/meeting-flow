import { describe, expect, it } from "vitest";
import { spotlightRadiusFor } from "@/components/guided-tours";

function mockEl(width: number, height: number): Element {
  return {
    getBoundingClientRect: () =>
      ({
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  } as Element;
}

describe("spotlightRadiusFor", () => {
  it("uses a small radius for wide thin targets like h1", () => {
    expect(spotlightRadiusFor(mockEl(460, 28))).toBeLessThanOrEqual(4);
  });

  it("uses a moderate radius for buttons", () => {
    const r = spotlightRadiusFor(mockEl(120, 36));
    expect(r).toBeGreaterThanOrEqual(3);
    expect(r).toBeLessThanOrEqual(6);
  });

  it("allows slightly more rounding on square-ish targets", () => {
    const r = spotlightRadiusFor(mockEl(44, 44));
    expect(r).toBeGreaterThanOrEqual(5);
    expect(r).toBeLessThanOrEqual(8);
  });

  it("never exceeds half the smaller dimension visually (cap at 8)", () => {
    expect(spotlightRadiusFor(mockEl(200, 200))).toBeLessThanOrEqual(8);
  });
});
