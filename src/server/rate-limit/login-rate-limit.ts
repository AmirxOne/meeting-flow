/** Login rate limit — sliding window 10 attempts / 15 min per IP. */

import Redis from "ioredis";

export const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_MAX_ATTEMPTS = 10;
export const LOGIN_RATE_KEY_PREFIX = "ratelimit:login:";

export interface LoginRateLimiter {
  isLimited(key: string): Promise<boolean>;
}

/** In-memory sliding window (dev / no Redis). */
export class MemoryLoginRateLimiter implements LoginRateLimiter {
  private attempts = new Map<string, number[]>();

  async isLimited(key: string): Promise<boolean> {
    return memorySlidingWindowLimited(this.attempts, key, Date.now());
  }
}

/** Pure helper for unit tests. Returns true when limited. */
export function memorySlidingWindowLimited(
  store: Map<string, number[]>,
  key: string,
  now: number,
  windowMs = LOGIN_RATE_WINDOW_MS,
  maxAttempts = LOGIN_RATE_MAX_ATTEMPTS,
): boolean {
  const windowStart = now - windowMs;
  const prev = store.get(key) ?? [];
  const inWindow = prev.filter((t) => t > windowStart);
  if (inWindow.length >= maxAttempts) {
    store.set(key, inWindow);
    return true;
  }
  inWindow.push(now);
  store.set(key, inWindow);
  return false;
}

/** Minimal Redis surface for sliding-window sorted sets (mockable in tests). */
export interface RedisMultiChain {
  zremrangebyscore(key: string, min: number, max: number): RedisMultiChain;
  zadd(key: string, score: number, member: string): RedisMultiChain;
  zcard(key: string): RedisMultiChain;
  pexpire(key: string, ms: number): RedisMultiChain;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
}

export interface RedisLike {
  multi(): RedisMultiChain;
}

export class RedisLoginRateLimiter implements LoginRateLimiter {
  constructor(
    private redis: RedisLike,
    private keyPrefix = LOGIN_RATE_KEY_PREFIX,
    private windowMs = LOGIN_RATE_WINDOW_MS,
    private maxAttempts = LOGIN_RATE_MAX_ATTEMPTS,
  ) {}

  async isLimited(key: string): Promise<boolean> {
    const now = Date.now();
    const redisKey = `${this.keyPrefix}${key}`;
    const member = `${now}:${Math.random().toString(36).slice(2, 9)}`;

    const multi = this.redis.multi();
    multi.zremrangebyscore(redisKey, 0, now - this.windowMs);
    multi.zadd(redisKey, now, member);
    multi.zcard(redisKey);
    multi.pexpire(redisKey, this.windowMs);
    const results = await multi.exec();
    const count = Number(results?.[2]?.[1] ?? 0);
    return count > this.maxAttempts;
  }
}

let cachedLimiter: LoginRateLimiter | null = null;

export function createLoginRateLimiter(redisUrl?: string): LoginRateLimiter {
  const url = redisUrl ?? process.env.REDIS_URL;
  if (url?.trim()) {
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    }) as unknown as RedisLike;
    return new RedisLoginRateLimiter(client);
  }
  return new MemoryLoginRateLimiter();
}

export function getLoginRateLimiter(): LoginRateLimiter {
  if (!cachedLimiter) cachedLimiter = createLoginRateLimiter();
  return cachedLimiter;
}

/** Test hook — reset singleton between tests. */
export function resetLoginRateLimiterForTests(): void {
  cachedLimiter = null;
}
