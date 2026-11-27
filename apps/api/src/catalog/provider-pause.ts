import { ApiErrorCode } from '@filecab/contracts';
import { ApiException } from '../http/api-error';

/** A refused quota (403) waits 6 hours. The daily quota then has time to renew. */
const QUOTA_WAIT_MS = 6 * 60 * 60 * 1000;

/** Another provider failure waits 5 minutes, then twice as long each time, up to 6 hours. */
const PROVIDER_WAIT_MS = 5 * 60 * 1000;

/** Waits after each provider request, so background jobs stay far below provider limits. */
export const PROVIDER_PACE_MS: Readonly<Record<string, number>> = { kinopoisk: 1200, smotret: 300 };

/** After this many waits for a provider, a background catalog job fails. */
export const MAX_PROVIDER_PAUSES = 40;

/** Waits for the given time. */
export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Pauses a background catalog job until a provider can answer again. */
export class ProviderPause extends Error {
  constructor(readonly delayMs: number) {
    super('Provider pause');
  }
}

/**
 * Converts a provider limit, outage or timeout to a pause. Other failures stay as they are.
 */
export function providerPause(error: unknown, pauses: number): ProviderPause | null {
  if (!(error instanceof ApiException)) return null;

  if (error.code === ApiErrorCode.RateLimited)
    return new ProviderPause(Math.max(60_000, (error.retryAfterSeconds ?? 60) * 1000));

  if (error.code !== ApiErrorCode.ProviderUnavailable && error.code !== ApiErrorCode.TransportError)
    return null;

  if (error.providerDiagnostic?.upstreamStatus === 403) return new ProviderPause(QUOTA_WAIT_MS);

  return new ProviderPause(Math.min(QUOTA_WAIT_MS, PROVIDER_WAIT_MS * 2 ** pauses));
}

/**
 * Returns true for a provider failure that concerns one item only: a request error, other
 * than a rate limit, or a response that failed the provider schema.
 */
export function itemFailure(error: unknown): error is ApiException {
  return (
    error instanceof ApiException &&
    ((error.httpStatus < 500 && error.code !== ApiErrorCode.RateLimited) ||
      error.code === ApiErrorCode.InvalidResponse)
  );
}
