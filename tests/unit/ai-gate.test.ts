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
  const slot = (title: string, start: string, end: string) => ({ title, start, end });
  const good = JSON.stringify({ topics: [slot("الف", "10:00", "10:15"), slot("ب", "10:15", "10:30"), slot("ج", "10:30", "10:45"), slot("د", "10:45", "11:00"), slot("هـ", "11:00", "11:15")] });
  it("۵ موضوع سالم با زمان → قبول", () => {
    expect(validateTopics(good)?.map((t) => t.title)).toEqual(["الف", "ب", "ج", "د", "هـ"]);
  });
  it("۴ موضوع → رد", () => {
    expect(validateTopics(JSON.stringify({ topics: [slot("۱", "10:00", "10:10"), slot("۲", "10:10", "10:20"), slot("۳", "10:20", "10:30"), slot("۴", "10:30", "10:40")] }))).toBeNull();
  });
  it("۶ موضوع → رد", () => {
    expect(validateTopics(JSON.stringify({ topics: [slot("۱", "10:00", "10:10"), slot("۲", "10:10", "10:20"), slot("۳", "10:20", "10:30"), slot("۴", "10:30", "10:40"), slot("۵", "10:40", "10:50"), slot("۶", "10:50", "11:00")] }))).toBeNull();
  });
  it("تکراری → رد", () => {
    expect(validateTopics(JSON.stringify({ topics: [slot("الف", "10:00", "10:10"), slot("الف", "10:10", "10:20"), slot("ب", "10:20", "10:30"), slot("ج", "10:30", "10:40"), slot("د", "10:40", "10:50")] }))).toBeNull();
  });
  it("خالی/فاصله → رد", () => {
    expect(validateTopics(JSON.stringify({ topics: [slot(" ", "10:00", "10:10"), slot("ب", "10:10", "10:20"), slot("ج", "10:20", "10:30"), slot("د", "10:30", "10:40"), slot("هـ", "10:40", "10:50")] }))).toBeNull();
  });
  it("فرمت زمان غلط → رد", () => {
    expect(validateTopics(JSON.stringify({ topics: [slot("الف", "10", "10:10"), slot("ب", "10:10", "10:20"), slot("ج", "10:20", "10:30"), slot("د", "10:30", "10:40"), slot("هـ", "10:40", "10:50")] }))).toBeNull();
  });
  it("JSON داخل code fence هم پذیرفته می‌شود (extract)", () => {
    const fenced = "```json" + String.fromCharCode(10) + JSON.stringify({ topics: [slot("a", "10:00", "10:05"), slot("b", "10:05", "10:10"), slot("c", "10:10", "10:15"), slot("d", "10:15", "10:20"), slot("e", "10:20", "10:25")] }) + String.fromCharCode(10) + "```";
    expect(validateTopics(JSON.stringify(extractJson(fenced)))?.map((t) => t.title)).toEqual(["a", "b", "c", "d", "e"]);
  });

  const win = { startAt: new Date("2026-10-07T10:00:00"), endAt: new Date("2026-10-07T11:30:00"), durationMin: 90 };
  it("خارج از بازه‌ی جلسه → رد", () => {
    expect(validateTopics(good, { ...win, endAt: new Date("2026-10-07T10:45:00"), durationMin: 45 })).toBeNull();
  });
  it("هم‌پوشانی → رد", () => {
    const overlap = JSON.stringify({ topics: [slot("الف", "10:00", "10:20"), slot("ب", "10:10", "10:30"), slot("ج", "10:30", "10:40"), slot("د", "10:40", "10:50"), slot("هـ", "10:50", "11:00")] });
    expect(validateTopics(overlap, win)).toBeNull();
  });
  it("مجموع مدت بیشتر از جلسه → رد", () => {
    const long = JSON.stringify({ topics: [slot("الف", "10:00", "10:20"), slot("ب", "10:20", "10:40"), slot("ج", "10:40", "11:00"), slot("د", "11:00", "11:20"), slot("هـ", "11:20", "11:40")] });
    expect(validateTopics(long, win)).toBeNull();
  });
  it("داخل بازه و بدون هم‌پوشانی → قبول", () => {
    expect(validateTopics(good, win)?.length).toBe(5);
  });
});
