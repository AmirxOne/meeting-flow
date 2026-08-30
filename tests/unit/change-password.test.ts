import { describe, expect, it } from "vitest";
import { changePasswordSchema, profileSelfUpdateSchema } from "@/lib/validations";

describe("changePasswordSchema", () => {
  it("requires current and min-6 new password", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "123456" }).success).toBe(
      true,
    );
    expect(changePasswordSchema.safeParse({ currentPassword: "", newPassword: "123456" }).success).toBe(
      false,
    );
    expect(changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "12345" }).success).toBe(
      false,
    );
  });
});

describe("profileSelfUpdateSchema", () => {
  it("allows self-service profile fields only", () => {
    const parsed = profileSelfUpdateSchema.safeParse({
      fullName: "علی رضایی",
      phone: "09121234567",
      jobTitle: "کارشناس",
      department: "فروش",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects short fullName when provided", () => {
    expect(profileSelfUpdateSchema.safeParse({ fullName: "ا" }).success).toBe(false);
  });
});
