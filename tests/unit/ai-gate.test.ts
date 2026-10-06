import { describe, it, expect } from "vitest";
import { deriveAiUsable, AiUnavailableError, type AiHealth } from "@/server/services/llm-client.service";

const baseSettings = { activeProviderId: "p1", fallbackProviderId: null, temperature: 0.3, maxTokens: 2000 };
const providers = { p1: { enabled: true }, p2: { enabled: true } };
const NOW = Date.now();

describe("AI availability gate", () => {
  it("بدون پروایدر → غیرقابل استفاده", () => {
    expect(deriveAiUsable({ settings: { ...baseSettings, activeProviderId: null }, providers: {}, health: null, now: NOW })).toBe(false);
  });

  it("پروایدر فعال → قابل استفاده", () => {
    expect(deriveAiUsable({ settings: baseSettings, providers, health: null, now: NOW })).toBe(true);
  });

  it("پروایدر غیرفعال → غیرقابل استفاده", () => {
    expect(deriveAiUsable({ settings: baseSettings, providers: { p1: { enabled: false } }, health: null, now: NOW })).toBe(false);
  });

  it("خطای اخیر (زیر ۱۵ دقیقه) → غیرقابل استفاده (حس خرابی حذف)", () => {
    const health: AiHealth = { ok: false, at: new Date(NOW - 5 * 60_000).toISOString(), error: "timeout" };
    expect(deriveAiUsable({ settings: baseSettings, providers, health, now: NOW })).toBe(false);
  });

  it("خطای قدیمی (بیش از ۱۵ دقیقه) → دوباره قابل استفاده (خودترمیم)", () => {
    const health: AiHealth = { ok: false, at: new Date(NOW - 20 * 60_000).toISOString(), error: "timeout" };
    expect(deriveAiUsable({ settings: baseSettings, providers, health, now: NOW })).toBe(true);
  });

  it("سلامت سبز → قابل استفاده", () => {
    const health: AiHealth = { ok: true, at: new Date(NOW - 60_000).toISOString() };
    expect(deriveAiUsable({ settings: baseSettings, providers, health, now: NOW })).toBe(true);
  });

  it("بدون active صریح، اولین enabled استفاده می‌شود", () => {
    expect(deriveAiUsable({ settings: { ...baseSettings, activeProviderId: null }, providers, health: null, now: NOW })).toBe(true);
  });

  it("AiUnavailableError پیام فارسی دارد", () => {
    const e = new AiUnavailableError();
    expect(e.message).toBe("قابلیت هوش مصنوعی در دسترس نیست");
  });
});
