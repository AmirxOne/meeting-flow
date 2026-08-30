import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyWorkerTickSecret, isWorkerTickEnabled } from "@/server/worker-tick-auth";

function mockRequest(headers: Record<string, string>) {
  return {
    headers: {
      get(name: string) {
        const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
      },
    },
  } as import("next/server").NextRequest;
}

describe("worker tick auth", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env, WORKER_TICK_SECRET: "test-secret" };
  });

  afterEach(() => {
    process.env = env;
  });

  it("isWorkerTickEnabled when secret is set", () => {
    expect(isWorkerTickEnabled()).toBe(true);
    delete process.env.WORKER_TICK_SECRET;
    expect(isWorkerTickEnabled()).toBe(false);
  });

  it("accepts Bearer token", () => {
    const req = mockRequest({ authorization: "Bearer test-secret" });
    expect(verifyWorkerTickSecret(req)).toBe(true);
  });

  it("accepts x-worker-secret header", () => {
    const req = mockRequest({ "x-worker-secret": "test-secret" });
    expect(verifyWorkerTickSecret(req)).toBe(true);
  });

  it("rejects wrong secret", () => {
    const req = mockRequest({ authorization: "Bearer wrong" });
    expect(verifyWorkerTickSecret(req)).toBe(false);
  });
});
