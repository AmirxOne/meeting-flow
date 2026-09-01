import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("exports a GET handler shape", async () => {
    const mod = await import("@/app/api/health/route");
    expect(typeof mod.GET).toBe("function");
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("meetinghub");
  });
});
