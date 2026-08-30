import { describe, expect, it } from "vitest";
import { faNum, faStr, stripBidiMarks, toEnDigits, withRtlMark } from "@/lib/fa";

describe("Persian digits", () => {
  it("faNum converts ASCII digits", () => {
    expect(faNum(12)).toBe("۱۲");
    expect(faNum("09")).toBe("۰۹");
  });

  it("faStr converts digits inside a phone or email", () => {
    expect(faStr("0912-345-6789")).toBe("۰۹۱۲-۳۴۵-۶۷۸۹");
    expect(faStr("admin2@example.com")).toBe("admin۲@example.com");
  });

  it("toEnDigits reverses Persian and Arabic-Indic digits", () => {
    expect(toEnDigits("۰۹۱۲")).toBe("0912");
    expect(toEnDigits("٠٩١٢")).toBe("0912");
    expect(toEnDigits("۰۹۱۲-abc")).toBe("0912-abc");
  });

  it("round-trips a typed phone value", () => {
    expect(toEnDigits(faStr("09121234567"))).toBe("09121234567");
  });

  it("pins displayed values to the RTL edge without changing stored digits", () => {
    const shown = withRtlMark(faStr("0912"));
    expect(shown.startsWith("\u200F")).toBe(true);
    expect(toEnDigits(stripBidiMarks(shown))).toBe("0912");
  });
});
