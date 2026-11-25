import { describe, expect, it } from "vitest";
import { SlidingWindowRateLimiter } from "@/server/security/rateLimiter";

describe("SlidingWindowRateLimiter", () => {
  it("allows requests within limit and blocks once exceeded", () => {
    let now = 1000;
    const limiter = new SlidingWindowRateLimiter({
      maxRequests: 3,
      windowMs: 60_000,
      nowFn: () => now,
    });

    expect(limiter.consume("ip-1").allowed).toBe(true);
    expect(limiter.consume("ip-1").allowed).toBe(true);
    const third = limiter.consume("ip-1");
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = limiter.consume("ip-1");
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);

    // Different key stays unaffected
    expect(limiter.consume("ip-2").allowed).toBe(true);

    // After window passes, key resets cleanly
    now += 61_000;
    expect(limiter.consume("ip-1").allowed).toBe(true);
  });
});
