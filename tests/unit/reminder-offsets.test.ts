import { describe, expect, it } from "vitest";
import {
  coerceReminderOffsets,
  validateReminderOffsets,
  REMINDER_OFFSET_MAX_COUNT,
  REMINDER_OFFSET_MAX_MINUTES,
} from "@/lib/reminder-offsets";

describe("validateReminderOffsets", () => {
  it("accepts positive integers and sorts descending", () => {
    const r = validateReminderOffsets([10, 30, 20]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.offsets).toEqual([30, 20, 10]);
  });

  it("accepts empty list", () => {
    const r = validateReminderOffsets([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.offsets).toEqual([]);
  });

  it("rejects non-array", () => {
    const r = validateReminderOffsets("30,10");
    expect(r.ok).toBe(false);
  });

  it("rejects zero and negative offsets", () => {
    expect(validateReminderOffsets([0, 10]).ok).toBe(false);
    expect(validateReminderOffsets([-5, 10]).ok).toBe(false);
  });

  it("rejects duplicates", () => {
    const r = validateReminderOffsets([30, 30]);
    expect(r.ok).toBe(false);
  });

  it("rejects non-integer values", () => {
    const r = validateReminderOffsets([10.5]);
    expect(r.ok).toBe(false);
  });

  it("rejects too many offsets", () => {
    const many = Array.from({ length: REMINDER_OFFSET_MAX_COUNT + 1 }, (_, i) => i + 1);
    const r = validateReminderOffsets(many);
    expect(r.ok).toBe(false);
  });

  it("rejects offsets above one week", () => {
    const r = validateReminderOffsets([REMINDER_OFFSET_MAX_MINUTES + 1]);
    expect(r.ok).toBe(false);
  });
});

describe("coerceReminderOffsets", () => {
  it("returns normalized offsets when valid", () => {
    expect(coerceReminderOffsets([5, 15], [30, 10])).toEqual([15, 5]);
  });

  it("falls back when invalid", () => {
    expect(coerceReminderOffsets(["bad"], [30, 10])).toEqual([30, 10]);
  });
});
