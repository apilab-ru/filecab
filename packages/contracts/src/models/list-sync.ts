import type { Category } from './category';
import type { ListSyncErrorCode } from './list-sync-error-code';
import type { ListSyncField } from './list-sync-field';
import type { ListSyncIssue } from './list-sync-issue';
import type { ListSyncJobKind } from './list-sync-job-kind';
import type { ListSyncJobState } from './list-sync-job-state';
import type { ListSyncOutcome } from './list-sync-outcome';
import type { ListSyncState } from './list-sync-state';
import type { Status } from './status';

/** Holds the transferable personal-list values of one item in Filecab terms. */
export interface ListSyncValues {
  status: Status | null;
  rating: number;
  progress: number;
}

/** Reports the progress of a running list job. */
export interface ListSyncProgress {
  done: number;
  total: number;
}

/** Reports the result of one item in a finished list job. */
export interface ListSyncItemReport {
  title: string;
  entryId: string | null;
  outcome: ListSyncOutcome;
  issue: ListSyncIssue | null;
}

/** Summarizes a finished export or import apply job. */
export interface ListSyncJobResult {
  counts: Partial<Record<ListSyncOutcome, number>>;
  /** Items that were skipped or failed. Other outcomes appear only in the counts. */
  items: ListSyncItemReport[];
}

/** Describes a durable export or import job. */
export interface ListSyncJob {
  jobId: string;
  kind: ListSyncJobKind;
  state: ListSyncJobState;
  progress: ListSyncProgress;
  result: ListSyncJobResult | null;
  error: ListSyncErrorCode | null;
  createdAt: string;
  finishedAt: string | null;
}

/** Describes the connected remote account of one provider. Credentials never appear here. */
export interface ListSyncConnection {
  accountId: string;
  accountName: string;
  state: ListSyncState;
  fields: ListSyncField[];
  lastExportAt: string | null;
  lastImportAt: string | null;
  /** The latest job, or null when the connection has no jobs. */
  job: ListSyncJob | null;
  /** True when an import preview waits for a decision. */
  previewReady: boolean;
  /** The number of Filecab entries with a saved link to a remote record. */
  mappings: number;
}

/** Describes one registered list provider and its connection for the current account. */
export interface ListSyncProvider {
  provider: string;
  name: string;
  categories: Category[];
  connection: ListSyncConnection | null;
}

/** Lists the list providers and the connections of the current account. */
export interface ListSyncOverview {
  schemaVersion: 1;
  providers: ListSyncProvider[];
}

/** Returns the provider address that asks the owner for consent. */
export interface ListSyncAuthorization {
  schemaVersion: 1;
  authorizationUrl: string;
}

/** Shows a remote record that has no Filecab entry. */
export interface ListSyncImportAddition {
  key: string;
  title: string;
  category: Category;
  values: ListSyncValues;
}

/** Shows one field with a different value on each side. */
export interface ListSyncFieldChange {
  field: ListSyncField;
  current: Status | number | null;
  incoming: Status | number | null;
}

/** Shows the different fields of a remote record and its Filecab entry. */
export interface ListSyncImportChange {
  key: string;
  entryId: string;
  title: string;
  fields: ListSyncFieldChange[];
}

/** Lists the additions and changes that an import can apply. */
export interface ListSyncImportPreview {
  schemaVersion: 1;
  jobId: string;
  additions: ListSyncImportAddition[];
  changes: ListSyncImportChange[];
  /** Remote records that equal their Filecab entries. */
  unchanged: number;
}

/** Selects the fields of one change to apply. */
export interface ListSyncChangeSelection {
  key: string;
  fields: ListSyncField[];
}

/** Applies the selected parts of an import preview. */
export interface ListSyncImportApply {
  jobId: string;
  additions: string[];
  changes: ListSyncChangeSelection[];
}
