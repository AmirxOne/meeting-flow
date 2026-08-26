import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
  TransitionError,
  evaluateApprovalNeed,
  DEFAULT_POLICIES,
} from "@/server/services/state-machine";

describe("meeting state machine", () => {
  it("allows normal lifecycle", () => {
    expect(canTransition("DRAFT", "PENDING_APPROVAL")).toBe(true);
    expect(canTransition("PENDING_APPROVAL", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
  });

  it("allows direct confirm from draft (auto-approve path)", () => {
    expect(canTransition("DRAFT", "CONFIRMED")).toBe(true);
  });

  it("allows cancel from most active states", () => {
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("PENDING_APPROVAL", "CANCELLED")).toBe(true);
    expect(canTransition("APPROVED", "CANCELLED")).toBe(true);
  });

  it("blocks invalid transitions", () => {
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransition("NO_SHOW", "COMPLETED")).toBe(false);
    expect(canTransition("REJECTED", "CONFIRMED")).toBe(false);
    expect(canTransition("DRAFT", "IN_PROGRESS")).toBe(false);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
  });

  it("terminal states have no exits", () => {
    expect(canTransition("COMPLETED", "COMPLETED")).toBe(false);
    expect(canTransition("CANCELLED", "CANCELLED")).toBe(false);
  });

  it("assertTransition throws TransitionError on invalid", () => {
    expect(() => assertTransition("COMPLETED", "IN_PROGRESS")).toThrow(TransitionError);
  });
});

describe("approval policy evaluation", () => {
  it("internal short meeting auto-approves", () => {
    expect(
      evaluateApprovalNeed(DEFAULT_POLICIES, {
        hasExternalGuest: false,
        isVipRoom: false,
        durationMin: 60,
        meetingType: "INTERNAL",
      }),
    ).toBe(false);
  });

  it("external guest requires approval", () => {
    expect(
      evaluateApprovalNeed(DEFAULT_POLICIES, {
        hasExternalGuest: true,
        isVipRoom: false,
        durationMin: 30,
        meetingType: "EXTERNAL",
      }),
    ).toBe(true);
  });

  it("VIP room requires approval", () => {
    expect(
      evaluateApprovalNeed(DEFAULT_POLICIES, {
        hasExternalGuest: false,
        isVipRoom: true,
        durationMin: 30,
        meetingType: "INTERNAL",
      }),
    ).toBe(true);
  });

  it("long meeting (>120m) requires approval", () => {
    expect(
      evaluateApprovalNeed(DEFAULT_POLICIES, {
        hasExternalGuest: false,
        isVipRoom: false,
        durationMin: 121,
        meetingType: "INTERNAL",
      }),
    ).toBe(true);
  });

  it("non-internal meetings without auto-approve flag need approval", () => {
    expect(
      evaluateApprovalNeed(DEFAULT_POLICIES, {
        hasExternalGuest: false,
        isVipRoom: false,
        durationMin: 30,
        meetingType: "CLIENT",
      }),
    ).toBe(true);
  });
});
