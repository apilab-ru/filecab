/** Describes the lifecycle of a durable list job. */
export enum ListSyncJobState {
  Queued = 'queued',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Cancelled = 'cancelled',
}
