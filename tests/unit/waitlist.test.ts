import { describe, it, expect } from "vitest";
import { BLOCKING_STATUSES } from "@/server/services/conflict.service";
import { canTransition } from "@/server/services/state-machine";
import {
  WAITLIST_WAITING,
  WAITLIST_OFFERED,
  WAITLIST_OFFER_TTL_MS,
  bumpExpiredToBack,
  isOfferActive,
  isOfferExpired,
  isWaitlistStatus,
  pickNextWaitlistOffer,
  queuePosition,
  sortWaitlistQueue,
  waitlistLocksRoom,
  type WaitlistQueueItem,
} from "@/server/services/waitlist.service";

const t0 = Date.UTC(2026, 8, 1, 10, 0, 0);
const at = (min: number) => new Date(t0 + min * 60_000);

function item(
  partial: Partial<WaitlistQueueItem> & Pick<WaitlistQueueItem, "id">,
): WaitlistQueueItem {
  return {
    status: WAITLIST_WAITING,
    startAt: at(0),
    endAt: at(60),
    waitlistQueuedAt: at(0),
    waitlistOfferExpiresAt: null,
    ...partial,
  };
}

describe("waitlist never locks the room", () => {
  it("waitlist statuses are not blocking", () => {
    expect(waitlistLocksRoom()).toBe(false);
    expect((BLOCKING_STATUSES as readonly string[]).includes(WAITLIST_WAITING)).toBe(false);
    expect((BLOCKING_STATUSES as readonly string[]).includes(WAITLIST_OFFERED)).toBe(false);
  });

  it("isWaitlistStatus covers both queue states", () => {
    expect(isWaitlistStatus("WAITLISTED")).toBe(true);
    expect(isWaitlistStatus("WAITLIST_OFFERED")).toBe(true);
    expect(isWaitlistStatus("CONFIRMED")).toBe(false);
  });
});

describe("FIFO queue", () => {
  it("sorts by queuedAt then id", () => {
    const sorted = sortWaitlistQueue([
      item({ id: "b", waitlistQueuedAt: at(10) }),
      item({ id: "a", waitlistQueuedAt: at(5) }),
      item({ id: "c", waitlistQueuedAt: at(5) }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["a", "c", "b"]);
  });

  it("queuePosition is 1-based", () => {
    expect(queuePosition(["a", "c", "b"], "c")).toBe(2);
    expect(queuePosition(["a", "c", "b"], "missing")).toBe(0);
  });
});

describe("offer expiry", () => {
  it("null or past expiry is expired", () => {
    const now = at(20);
    expect(isOfferExpired(null, now)).toBe(true);
    expect(isOfferExpired(at(19), now)).toBe(true);
    expect(isOfferExpired(at(20), now)).toBe(true);
    expect(isOfferExpired(at(21), now)).toBe(false);
  });

  it("active offer requires WAITLIST_OFFERED and future expiry", () => {
    const now = at(10);
    expect(
      isOfferActive(
        item({
          id: "o",
          status: WAITLIST_OFFERED,
          waitlistOfferExpiresAt: at(25),
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isOfferActive(
        item({
          id: "w",
          status: WAITLIST_WAITING,
          waitlistOfferExpiresAt: at(25),
        }),
        now,
      ),
    ).toBe(false);
  });

  it("TTL is 15 minutes", () => {
    expect(WAITLIST_OFFER_TTL_MS).toBe(15 * 60 * 1000);
  });
});

describe("pickNextWaitlistOffer when a room frees", () => {
  const now = at(0);
  const free = () => true;
  const busy = () => false;

  it("offers the first waiter when the slot is free", () => {
    const picked = pickNextWaitlistOffer(
      [
        item({ id: "second", waitlistQueuedAt: at(20) }),
        item({ id: "first", waitlistQueuedAt: at(5) }),
      ],
      now,
      free,
    );
    expect(picked?.id).toBe("first");
  });

  it("skips a waiter whose slot is still occupied", () => {
    const picked = pickNextWaitlistOffer(
      [
        item({ id: "blocked", waitlistQueuedAt: at(1), startAt: at(0), endAt: at(60) }),
        item({ id: "open", waitlistQueuedAt: at(2), startAt: at(120), endAt: at(180) }),
      ],
      now,
      (start) => start.getTime() >= at(120).getTime(),
    );
    expect(picked?.id).toBe("open");
  });

  it("does not offer while an overlapping active offer exists", () => {
    const picked = pickNextWaitlistOffer(
      [
        item({
          id: "offered",
          status: WAITLIST_OFFERED,
          waitlistQueuedAt: at(1),
          waitlistOfferExpiresAt: at(30),
        }),
        item({ id: "next", waitlistQueuedAt: at(2) }),
      ],
      now,
      free,
    );
    expect(picked).toBeNull();
  });

  it("offers the next person after the first offer expires", () => {
    const picked = pickNextWaitlistOffer(
      [
        item({
          id: "expired",
          status: WAITLIST_OFFERED,
          waitlistQueuedAt: at(1),
          waitlistOfferExpiresAt: at(-1),
        }),
        item({ id: "next", waitlistQueuedAt: at(2) }),
      ],
      now,
      free,
    );
    expect(picked?.id).toBe("next");
  });

  it("returns null when the freed slot is still busy", () => {
    expect(
      pickNextWaitlistOffer([item({ id: "w", waitlistQueuedAt: at(1) })], now, busy),
    ).toBeNull();
  });
});

describe("expired offer goes to the back of the queue", () => {
  it("rebases queuedAt to now so earlier waiters stay ahead", () => {
    const now = at(100);
    const bumped = bumpExpiredToBack(at(1), now);
    expect(bumped.getTime()).toBe(now.getTime());
    const sorted = sortWaitlistQueue([
      item({ id: "expired", waitlistQueuedAt: bumped }),
      item({ id: "second", waitlistQueuedAt: at(2) }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["second", "expired"]);
  });
});

describe("waitlist state machine", () => {
  it("WAITLISTED → WAITLIST_OFFERED → CONFIRMED (or approval)", () => {
    expect(canTransition("WAITLISTED", "WAITLIST_OFFERED")).toBe(true);
    expect(canTransition("WAITLIST_OFFERED", "CONFIRMED")).toBe(true);
    expect(canTransition("WAITLIST_OFFERED", "PENDING_APPROVAL")).toBe(true);
  });

  it("waitlisted meetings can cancel, but cannot skip the offer to lock the room", () => {
    expect(canTransition("WAITLISTED", "CANCELLED")).toBe(true);
    expect(canTransition("WAITLISTED", "CONFIRMED")).toBe(false);
    expect(canTransition("WAITLISTED", "PENDING_APPROVAL")).toBe(false);
  });
});
