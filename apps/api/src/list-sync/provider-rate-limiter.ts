import type { PrismaClient } from '../generated/prisma/client';
import { ListSyncProviderError } from './list-sync-adapter';

/** Allows at most `max` requests in each window of `windowMs`. */
export interface RateWindow {
  windowMs: number;
  max: number;
}

/** Waits until a provider request is permitted. */
export interface RequestGate {
  acquire(): Promise<void>;
}

/** A request waits at most 2 minutes for a free slot. Then the job retries later. */
const MAX_WAIT_MS = 2 * 60 * 1000;

/** Waits for the given time. */
function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Limits provider requests through PostgreSQL rows. An advisory lock serializes the slot
 * check, so all accounts and API instances share one limit for each provider.
 */
export class ProviderRateLimiter implements RequestGate {
  private readonly longestMs: number;

  constructor(
    private readonly database: PrismaClient,
    private readonly provider: string,
    private readonly windows: RateWindow[],
  ) {
    this.longestMs = Math.max(...windows.map((window) => window.windowMs));
  }

  async acquire(): Promise<void> {
    const started = Date.now();

    while (true) {
      const wait = await this.take();

      if (wait === 0) return;

      if (Date.now() - started + wait > MAX_WAIT_MS) throw new ListSyncProviderError(true, wait);

      await sleep(wait);
    }
  }

  /** Takes a slot and returns 0, or returns the time until a slot is free. */
  private async take(): Promise<number> {
    const largest = Math.max(...this.windows.map((window) => window.max));

    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`provider-rate:${this.provider}`}))::text`;
      await transaction.$executeRaw`
        DELETE FROM "ProviderRequestSlot"
        WHERE "provider" = ${this.provider}
          AND "takenAt" < now() - ${this.longestMs} * interval '1 millisecond'`;
      // Ages in milliseconds, newest first. Database time keeps instances consistent.
      const rows = await transaction.$queryRaw<Array<{ age: number }>>`
        SELECT (EXTRACT(EPOCH FROM (now() - "takenAt")) * 1000)::float8 AS "age"
        FROM "ProviderRequestSlot"
        WHERE "provider" = ${this.provider}
        ORDER BY "takenAt" DESC
        LIMIT ${largest}`;
      let wait = 0;

      for (const window of this.windows) {
        const oldest = rows[window.max - 1];

        if (oldest && oldest.age < window.windowMs)
          wait = Math.max(wait, Math.ceil(window.windowMs - oldest.age));
      }

      if (wait === 0)
        await transaction.$executeRaw`
          INSERT INTO "ProviderRequestSlot" ("provider") VALUES (${this.provider})`;

      return wait;
    });
  }
}
