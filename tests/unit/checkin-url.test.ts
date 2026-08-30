import { describe, expect, it } from "vitest";
import { buildCheckinUrl } from "@/lib/checkin-url";

describe("buildCheckinUrl", () => {
  it("builds absolute URL with origin", () => {
    expect(buildCheckinUrl("a1b2c3d4", "https://meet.example.com")).toBe(
      "https://meet.example.com/checkin/A1B2C3D4",
    );
  });

  it("normalizes code to uppercase", () => {
    expect(buildCheckinUrl(" abcd1234 ", "http://localhost:3100")).toBe(
      "http://localhost:3100/checkin/ABCD1234",
    );
  });

  it("strips trailing slash from origin", () => {
    expect(buildCheckinUrl("FF00FF00", "http://localhost:3100/")).toBe(
      "http://localhost:3100/checkin/FF00FF00",
    );
  });
});
