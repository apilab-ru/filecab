import type { Category } from './category';

/** A job can hold at most 10,000 entries, the size of one CSV import. */
export const CATALOG_MATCH_MAX_ENTRIES = 10_000;

/** Describes the state of a catalog data job. */
export enum CatalogMatchJobState {
  Queued = 'queued',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/** Tells what the job did with one entry. */
export enum CatalogMatchOutcome {
  /**
   * Exactly one catalog title had the same title (and the same year when the entry has one),
   * or the reference resolved.
   */
  Linked = 'linked',
  NotFound = 'not-found',
  /** Several catalog titles matched. The owner links the entry by hand. */
  Ambiguous = 'ambiguous',
  /** Another entry is already linked to the catalog title. */
  Duplicate = 'duplicate',
  /** The entry was deleted, linked or changed while the job ran. */
  Skipped = 'skipped',
  Failed = 'failed',
}

/** Tells why a queued job waits. */
export enum CatalogMatchPause {
  /** The provider limit or quota was reached. The job continues later. */
  ProviderLimit = 'provider-limit',
  /** Some entries are not on the server yet. The job waits for device sync. */
  WaitingSync = 'waiting-sync',
}

/** Reports one entry that the job did not link. */
export interface CatalogMatchItem {
  entryId: string;
  title: string;
  outcome: CatalogMatchOutcome;
}

/**
 * Names an entry for a catalog data job. The category selects the provider and so the job. A
 * device entry can reach the server after the job starts, so the client sends the category.
 */
export interface CatalogMatchTarget {
  entryId: string;
  category: Category;
}

/**
 * Describes a catalog data job. Each provider has its own job, so a provider limit or failure
 * does not stop the entries of another provider.
 */
export interface CatalogMatchJob {
  jobId: string;
  /** The catalog provider of the job, for example `kinopoisk` or `smotret`. */
  provider: string;
  state: CatalogMatchJobState;
  progress: { done: number; total: number };
  counts: Partial<Record<CatalogMatchOutcome, number>>;
  /** Entries that were not linked, at most 500. */
  items: CatalogMatchItem[];
  pause: CatalogMatchPause | null;
  /** When a waiting job continues. */
  resumeAt: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** Returns the latest catalog data job of each provider, ordered by provider. */
export interface CatalogMatchStatus {
  schemaVersion: 1;
  jobs: CatalogMatchJob[];
}

/**
 * Starts jobs for the given entries, or for all active entries without catalog data. Entries
 * of a provider with an active job join that job.
 */
export interface CatalogMatchStart {
  entries?: CatalogMatchTarget[];
}
