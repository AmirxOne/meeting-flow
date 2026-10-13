import { describe, it, expect } from "vitest";
import { validateWindows, canAccessProgram } from "@/server/services/appointment.service";

describe("appointment — validateWindows", () => {
  it("بازه‌ی خالی → خطا", () => {
    expect(() => validateWindows([], 30, 0)).toThrow();
  });
  it("بازه‌ی کوتاه‌تر از مدت جلسه → خطا", () => {
    expect(() => validateWindows([{ daysOfWeek: [6], from: "09:00", to: "09:20" }], 30, 0)).toThrow();
  });
  it("مدت + فاصله > طول بازه → خطا", () => {
    expect(() => validateWindows([{ daysOfWeek: [6], from: "09:00", to: "10:00" }], 45, 30)).toThrow();
  });
  it("فرمت ساعت غلط → خطا", () => {
    expect(() => validateWindows([{ daysOfWeek: [6], from: "9", to: "12:00" }], 30, 0)).toThrow();
  });
  it("روز هفته نامعتبر → خطا", () => {
    expect(() => validateWindows([{ daysOfWeek: [9], from: "09:00", to: "12:00" }], 30, 0)).toThrow();
  });
  it("بازه‌ی سالم → پاس", () => {
    expect(() => validateWindows([{ daysOfWeek: [6, 1], from: "09:00", to: "12:00" }], 30, 0)).not.toThrow();
  });
});

describe("appointment — canAccessProgram", () => {
  const org = "org1";
  it("ALL → همه‌ی اعضای سازمان", () => {
    expect(canAccessProgram({ id: "u1", orgId: org }, { audienceType: "ALL", audienceIds: [], orgId: org })).resolves.toBe(true);
  });
  it("سازمان دیگر → رد", () => {
    expect(canAccessProgram({ id: "u1", orgId: "org2" }, { audienceType: "ALL", audienceIds: [], orgId: org })).resolves.toBe(false);
  });
  it("USERS → فقط لیست", () => {
    const p = { audienceType: "USERS", audienceIds: ["u1", "u2"], orgId: org };
    expect(canAccessProgram({ id: "u1", orgId: org }, p)).resolves.toBe(true);
    expect(canAccessProgram({ id: "u3", orgId: org }, p)).resolves.toBe(false);
  });
  it("BRANCH → فقط شعبه‌ی در لیست", () => {
    const p = { audienceType: "BRANCH", audienceIds: ["b1"], orgId: org };
    expect(canAccessProgram({ id: "u1", orgId: org, branchId: "b1" }, p)).resolves.toBe(true);
    expect(canAccessProgram({ id: "u2", orgId: org, branchId: "b2" }, p)).resolves.toBe(false);
    expect(canAccessProgram({ id: "u3", orgId: org }, p)).resolves.toBe(false);
  });
});
