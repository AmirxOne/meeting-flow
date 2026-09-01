import { describe, expect, it } from "vitest";
import { evaluateAddDelegate, evaluateBookAs } from "@/server/services/delegate.service";

describe("evaluateBookAs", () => {
  it("allows booking as self when the actor can create", () => {
    expect(
      evaluateBookAs({
        actorId: "ali",
        organizerId: "ali",
        actorHasCreate: true,
        delegateRowExists: false,
      }),
    ).toEqual({ allowed: true });
  });

  it("blocks create even if a delegate row exists (RBAC is not bypassed)", () => {
    const out = evaluateBookAs({
      actorId: "room",
      organizerId: "admin",
      actorHasCreate: false,
      delegateRowExists: true,
    });
    expect(out.allowed).toBe(false);
    if (!out.allowed) expect(out.code).toBe("FORBIDDEN");
  });

  it("rejects an unauthorized delegate", () => {
    const out = evaluateBookAs({
      actorId: "ali",
      organizerId: "admin",
      actorHasCreate: true,
      delegateRowExists: false,
    });
    expect(out).toEqual({
      allowed: false,
      status: 403,
      code: "NOT_DELEGATE",
      message: "شما نمایندهٔ این کاربر نیستید",
    });
  });

  it("allows an appointed delegate who also has meeting:create", () => {
    expect(
      evaluateBookAs({
        actorId: "ali",
        organizerId: "admin",
        actorHasCreate: true,
        delegateRowExists: true,
      }),
    ).toEqual({ allowed: true });
  });
});

describe("evaluateAddDelegate", () => {
  const base = {
    managerId: "admin",
    delegateId: "ali",
    delegateExists: true,
    sameOrg: true,
    delegateActive: true,
    alreadyExists: false,
  };

  it("rejects self-delegate", () => {
    const out = evaluateAddDelegate({ ...base, delegateId: "admin" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("SELF_DELEGATE");
  });

  it("hides other-org users as not found", () => {
    const out = evaluateAddDelegate({ ...base, sameOrg: false });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(404);
  });

  it("rejects inactive users", () => {
    const out = evaluateAddDelegate({ ...base, delegateActive: false });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("INACTIVE");
  });

  it("rejects duplicates", () => {
    const out = evaluateAddDelegate({ ...base, alreadyExists: true });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(409);
  });

  it("accepts a valid appointment", () => {
    expect(evaluateAddDelegate(base)).toEqual({ ok: true });
  });
});
