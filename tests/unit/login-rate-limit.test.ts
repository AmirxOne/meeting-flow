import { describe, it, expect, beforeEach } from "vitest";
import {
  LOGIN_RATE_MAX_ATTEMPTS,
  LOGIN_RATE_WINDOW_MS,
  MemoryLoginRateLimiter,
  RedisLoginRateLimiter,
  memorySlidingWindowLimited,
  type RedisLike,
  type RedisMultiChain,
} from "@/server/rate-limit/login-rate-limit";

describe("login rate limit", () => {
  describe("memory sliding window", () => {
    let store: Map<string, number[]>;

    beforeEach(() => {
      store = new Map();
    });

    it("allows up to MAX attempts within the window", () => {
      const base = 1_000_000;
      for (let i = 0; i < LOGIN_RATE_MAX_ATTEMPTS; i++) {
        expect(memorySlidingWindowLimited(store, "1.2.3.4", base + i * 1000)).toBe(false);
      }
    });

    it("blocks the attempt after MAX within the window", () => {
      const base = 2_000_000;
      for (let i = 0; i < LOGIN_RATE_MAX_ATTEMPTS; i++) {
        memorySlidingWindowLimited(store, "1.2.3.4", base + i * 1000);
      }
      expect(memorySlidingWindowLimited(store, "1.2.3.4", base + LOGIN_RATE_MAX_ATTEMPTS * 1000)).toBe(
        true,
      );
    });

    it("expires attempts outside the sliding window", () => {
      const t0 = 3_000_000;
      for (let i = 0; i < LOGIN_RATE_MAX_ATTEMPTS; i++) {
        memorySlidingWindowLimited(store, "9.9.9.9", t0 + i * 1000);
      }
      const afterWindow = t0 + LOGIN_RATE_WINDOW_MS + 1;
      expect(memorySlidingWindowLimited(store, "9.9.9.9", afterWindow)).toBe(false);
    });

    it("MemoryLoginRateLimiter matches helper behavior", async () => {
      const limiter = new MemoryLoginRateLimiter();
      for (let i = 0; i < LOGIN_RATE_MAX_ATTEMPTS; i++) {
        expect(await limiter.isLimited("local")).toBe(false);
      }
      expect(await limiter.isLimited("local")).toBe(true);
    });
  });

  describe("redis sliding window (mock)", () => {
    it("returns limited when zcard exceeds max", async () => {
      let storedCount = 0;
      const multi: RedisMultiChain = {
        zremrangebyscore() {
          return this;
        },
        zadd() {
          storedCount += 1;
          return this;
        },
        zcard() {
          return this;
        },
        pexpire() {
          return this;
        },
        async exec() {
          return [
            [null, 0],
            [null, 1],
            [null, storedCount],
            [null, 1],
          ];
        },
      };
      const redis: RedisLike = {
        multi: () => multi,
      };
      const limiter = new RedisLoginRateLimiter(redis);

      for (let i = 0; i < LOGIN_RATE_MAX_ATTEMPTS; i++) {
        expect(await limiter.isLimited("1.2.3.4")).toBe(false);
      }
      expect(await limiter.isLimited("1.2.3.4")).toBe(true);
    });

    it("uses namespaced redis keys", async () => {
      let keyUsed = "";
      const multi: RedisMultiChain = {
        zremrangebyscore(k) {
          keyUsed = k;
          return this;
        },
        zadd() {
          return this;
        },
        zcard() {
          return this;
        },
        pexpire() {
          return this;
        },
        async exec() {
          return [
            [null, 0],
            [null, 1],
            [null, 1],
            [null, 1],
          ];
        },
      };
      const limiter = new RedisLoginRateLimiter({ multi: () => multi });
      await limiter.isLimited("10.0.0.1");
      expect(keyUsed).toBe("ratelimit:login:10.0.0.1");
    });
  });
});
