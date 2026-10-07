import { describe, it, expect } from "vitest";
import { deriveAiUsable, AiUnavailableError, samePair, type AiHealth } from "@/server/services/llm-client.service";
import { extractJson } from "@/server/services/ai/feature-base";
import { validateTopicsOutput as validateTopics } from "@/server/services/ai/features/agenda-topics";

const baseSettings = { activeProviderId: "p1", fallbackProviderId: null, fallbackModel: null, temperature: 0.3, maxTokens: 2000 };
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

describe("samePair — پشتیبان تکراری", () => {
  it("همان پروایدر همان مدل → تکراری", () => {
    expect(samePair({ providerId: "a", model: "glm-5.3" }, { providerId: "a", model: "glm-5.3" })).toBe(true);
  });
  it("همان پروایدر مدل متفاوت → مجاز", () => {
    expect(samePair({ providerId: "a", model: "glm-5.3" }, { providerId: "a", model: "glm-5.2" })).toBe(false);
  });
  it("پروایدر متفاوت همان مدل → مجاز", () => {
    expect(samePair({ providerId: "a", model: "glm-5.3" }, { providerId: "b", model: "glm-5.3" })).toBe(false);
  });
});

describe("validateTopics — خروجی ساخت‌یافته AI", () => {
  const good = JSON.stringify({ topics: ["الف", "ب", "ج", "د", "هـ"] });
  it("۵ موضوع سالم → قبول", () => {
    expect(validateTopics(good)).toEqual(["الف", "ب", "ج", "د", "هـ"]);
  });
  it("۴ موضوع → رد", () => {
    expect(validateTopics(JSON.stringify({ topics: ["۱", "۲", "۳", "۴"] }))).toBeNull();
  });
  it("۶ موضوع → رد", () => {
    expect(validateTopics(JSON.stringify({ topics: ["۱", "۲", "۳", "۴", "۵", "۶"] }))).toBeNull();
  });
  it("تکراری → رد", () => {
    expect(validateTopics(JSON.stringify({ topics: ["الف", "الف", "ب", "ج", "د"] }))).toBeNull();
  });
  it("خالی/فاصله → رد", () => {
    expect(validateTopics(JSON.stringify({ topics: [" ", "ب", "ج", "د", "هـ"] }))).toBeNull();
  });
  it("غیر رشته → رد", () => {
    expect(validateTopics(JSON.stringify({ topics: [1, 2, 3, 4, 5] }))).toBeNull();
  });
  it("JSON داخل code fence هم پذیرفته می‌شود (extract)", () => {
    const fenced = "```json" + String.fromCharCode(10) + '{"topics":["a","b","c","d","e"]}' + String.fromCharCode(10) + "```";
    expect(validateTopics(JSON.stringify(extractJson(fenced)))).toEqual(["a", "b", "c", "d", "e"]);
  });
});
