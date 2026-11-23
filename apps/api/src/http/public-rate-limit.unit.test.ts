import { expect, test } from 'vitest';
import { PublicRateLimiter } from './public-rate-limit';

test('the public rate limit counts each client in fixed windows and reports the wait', () => {
  let now = 1_000;
  const limiter = new PublicRateLimiter(2, 60_000, () => now);

  expect(limiter.take('a')).toBe(0);
  expect(limiter.take('a')).toBe(0);
  expect(limiter.take('b')).toBe(0);
  now += 15_000;
  expect(limiter.take('a')).toBe(45);
  now += 45_000;
  expect(limiter.take('a')).toBe(0);
});
