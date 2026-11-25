export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** In-memory sliding window rate limiter keyed by client IP or identifier. */
export class SlidingWindowRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly nowFn: () => number;
  private readonly hits = new Map<string, number[]>();

  constructor(options: {
    maxRequests: number;
    windowMs: number;
    nowFn?: () => number;
  }) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.nowFn = options.nowFn ?? (() => Date.now());
  }

  /** Record a request attempt and return whether it stays within quota. */
  consume(key: string): RateLimitResult {
    const now = this.nowFn();
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);

    if (recent.length >= this.maxRequests) {
      const oldest = recent[0] ?? now;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldest + this.windowMs - now) / 1000)
      );
      this.hits.set(key, recent);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    const updated = [...recent, now];
    this.hits.set(key, updated);
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - updated.length),
      retryAfterSeconds: 0,
    };
  }

  /** Reset recorded state for a key (useful after successful login or tests). */
  reset(key: string): void {
    this.hits.delete(key);
  }
}

export const uploadLimiter = new SlidingWindowRateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
});

export const zipLimiter = new SlidingWindowRateLimiter({
  maxRequests: 15,
  windowMs: 10 * 60 * 1000,
});

export const loginLimiter = new SlidingWindowRateLimiter({
  maxRequests: 8,
  windowMs: 15 * 60 * 1000,
});

export const reportLimiter = new SlidingWindowRateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
});
