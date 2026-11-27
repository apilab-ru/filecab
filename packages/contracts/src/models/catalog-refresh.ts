/** Tells the state of a catalog detail refresh job. */
export enum CatalogRefreshJobState {
  Queued = 'queued',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
}

/** Tells what a catalog detail refresh job did with one stored catalog item. */
export enum CatalogRefreshOutcome {
  /** The provider details were read and stored. */
  Refreshed = 'refreshed',
  /** The provider has no such record, returned an invalid response or a conflicting identity. */
  Failed = 'failed',
}

/** Describes a catalog detail refresh job of one provider. */
export interface CatalogRefreshJob {
  jobId: string;
  /** The catalog provider of the job, for example `smotret`. */
  provider: string;
  state: CatalogRefreshJobState;
  counts: Partial<Record<CatalogRefreshOutcome, number>>;
  /** Library entries that received a new snapshot. */
  entries: number;
  /** When a waiting job continues. */
  resumeAt: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** Returns the latest catalog detail refresh job of a provider, or null. */
export interface CatalogRefreshStatus {
  schemaVersion: 1;
  job: CatalogRefreshJob | null;
}
