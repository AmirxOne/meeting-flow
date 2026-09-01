import { describe, expect, it } from "vitest";
import { joinFullName, splitFullName } from "@/lib/person-name";

describe("splitFullName / joinFullName", () => {
  it("splits a two-part Persian name", () => {
    expect(splitFullName("علی رضایی")).toEqual({ firstName: "علی", lastName: "رضایی" });
  });

  it("keeps extra tokens in the family name", () => {
    expect(splitFullName("مدیر ارشد سیستم")).toEqual({
      firstName: "مدیر",
      lastName: "ارشد سیستم",
    });
  });

  it("treats a single token as the given name", () => {
    expect(splitFullName("علی")).toEqual({ firstName: "علی", lastName: "" });
  });

  it("trims extra spaces", () => {
    expect(splitFullName("  علیرضا   محمدی  ")).toEqual({
      firstName: "علیرضا",
      lastName: "محمدی",
    });
  });

  it("joins back without a trailing space", () => {
    expect(joinFullName("علی", "رضایی")).toBe("علی رضایی");
    expect(joinFullName("علی", "")).toBe("علی");
    expect(joinFullName("  علیرضا  ", "  محمدی  ")).toBe("علیرضا محمدی");
  });

  it("round-trips a typical seed name", () => {
    const original = "سارا نجفی";
    const parts = splitFullName(original);
    expect(joinFullName(parts.firstName, parts.lastName)).toBe(original);
  });
});
