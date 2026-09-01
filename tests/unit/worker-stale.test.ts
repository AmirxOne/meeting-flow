import { describe, it, expect } from "vitest";
import {
  DEFAULT_WORKER_STALE_MINUTES,
  evaluateWorkerStale,
  workerHealthOk,
  workerStaleAfterMinutes,
} from "@/lib/worker-stale";

describe("workerStaleAfterMinutes", () => {
  it("defaults to 5", () => {
    expect(workerStaleAfterMinutes({})).toBe(DEFAULT_WORKER_STALE_MINUTES);
    expect(workerStaleAfterMinutes({ WORKER_STALE_MINUTES: "" })).toBe(5);
  });

  it("reads env override", () => {
    expect(workerStaleAfterMinutes({ WORKER_STALE_MINUTES: "10" })).toBe(10);
  });

  it("rejects invalid values", () => {
    expect(workerStaleAfterMinutes({ WORKER_STALE_MINUTES: "0" })).toBe(5);
    expect(workerStaleAfterMinutes({ WORKER_STALE_MINUTES: "nope" })).toBe(5);
  });
});

describe("evaluateWorkerStale", () => {
  const now = new Date("2026-09-01T12:00:00.000Z");

  it("is stale when heartbeat is missing", () => {
    const r = evaluateWorkerStale(null, now, 5);
    expect(r.stale).toBe(true);
    expect(r.minutesSinceTick).toBeNull();
  });

  it("is fresh within threshold", () => {
    const r = evaluateWorkerStale(new Date("2026-09-01T11:58:00.000Z"), now, 5);
    expect(r.stale).toBe(false);
    expect(r.minutesSinceTick).toBeCloseTo(2, 1);
  });

  it("is stale after threshold", () => {
    const r = evaluateWorkerStale(new Date("2026-09-01T11:50:00.000Z"), now, 5);
    expect(r.stale).toBe(true);
    expect(r.minutesSinceTick).toBeCloseTo(10, 1);
  });

  it("is stale exactly one minute past threshold", () => {
    const r = evaluateWorkerStale(new Date("2026-09-01T11:54:00.000Z"), now, 5);
    expect(r.stale).toBe(true);
  });

  it("treats invalid dates as stale", () => {
    expect(evaluateWorkerStale("not-a-date", now, 5).stale).toBe(true);
  });
});

describe("workerHealthOk", () => {
  it("requires fresh tick and ok flag", () => {
    const fresh = evaluateWorkerStale(new Date(), new Date(), 5);
    expect(workerHealthOk(fresh, true)).toBe(true);
    expect(workerHealthOk(fresh, false)).toBe(false);
    expect(workerHealthOk({ stale: true, minutesSinceTick: 10, staleAfterMinutes: 5 }, true)).toBe(false);
  });
});
