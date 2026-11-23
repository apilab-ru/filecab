import { ApiErrorCode } from '@filecab/contracts';
import type { NextFunction, Request, Response } from 'express';
import { ApiException, sendApiError } from './api-error';

/** Public library requests that one client can send in each window. */
const PUBLIC_REQUEST_LIMIT = 60;

/** The length of one rate limit window. */
const PUBLIC_WINDOW_MS = 60_000;

/** Counts requests for each client address in fixed windows. Memory stays bounded by expiry. */
export class PublicRateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit = PUBLIC_REQUEST_LIMIT,
    private readonly windowMs = PUBLIC_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records one request and returns the seconds to wait, or zero when it is allowed. */
  take(client: string): number {
    const now = this.now();
    let window = this.windows.get(client);

    if (!window || now - window.start >= this.windowMs) {
      if (this.windows.size > 10_000)
        for (const [key, value] of this.windows)
          if (now - value.start >= this.windowMs) this.windows.delete(key);

      window = { start: now, count: 0 };
      this.windows.set(client, window);
    }

    window.count += 1;

    if (window.count <= this.limit) return 0;

    return Math.ceil((window.start + this.windowMs - now) / 1000);
  }
}

/** Adds privacy headers and the rate limit to every public route response, including errors. */
export function publicRouteMiddleware(limiter = new PublicRateLimiter()) {
  return (request: Request, response: Response, next: NextFunction): void => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.setHeader('Referrer-Policy', 'no-referrer');
    const wait = limiter.take(request.ip ?? 'unknown');

    if (wait > 0) {
      sendApiError(
        new ApiException(429, ApiErrorCode.RateLimited, 'Too many requests', true, undefined, wait),
        response,
      );

      return;
    }

    next();
  };
}
