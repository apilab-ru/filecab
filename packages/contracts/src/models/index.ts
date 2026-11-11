import type { ApiErrorCode } from './api-error-code';
import type { Category } from './category';
import type { ConflictReason } from './conflict-reason';
import type { Format } from './format';
import type { Granularity } from './granularity';
import type { Locale } from './locale';
import type { Status } from './status';

/** JSON-compatible contract v1. IDs, timestamps, versions and cursors use plain strings. */
export const CONTRACT_VERSION = 1 as const;

/** Records where metadata came from and whether it was verified. */
export interface Provenance {
  source: string;
  retrievedAt: string;
  verified: boolean;
}

/** Stores text with its actual language and source. */
export interface LocalizedText {
  text: string;
  language: string;
  provenance: Provenance;
}

/** Identifies a provider entity without conflating namespaces or installments. */
export interface ProviderReference {
  namespace: string;
  entity: string;
  id: string;
  granularity: Granularity;
  provenance: Provenance;
}

/** Identifies a list record within a remote provider account. */
export interface RemoteListIdentity {
  provider: string;
  accountId: string;
  entity: string;
  recordId: string;
}

/** Provides a stable genre identity with localized labels. */
export interface Genre {
  genreId: string;
  key: string;
  labels: LocalizedText[];
}

/** Keeps a provider score separate from the user rating. */
export interface ProviderRating {
  value: number;
  scale: number;
  provenance: Provenance;
}

/** Retains catalog metadata for display without a provider request. */
export interface Snapshot {
  originalTitle: LocalizedText | null;
  titles: LocalizedText[];
  descriptions: LocalizedText[];
  posterUrl: string | null;
  year: number | null;
  genres: Genre[];
  format: Format | null;
  episodeCount: number | null;
  availableEpisodeCount: number | null;
  providerRatings: ProviderRating[];
  references: ProviderReference[];
}

/** Preserves a viewing URL alongside its versioned normalized form. */
export interface Source {
  originalUrl: string;
  normalizedUrl: string;
  policyVersion: 'generic-v1';
}

/** Stores a library item with user fields, metadata and synchronization state. */
export interface Entry {
  schemaVersion: 1;
  readonly entryId: string;
  catalogId: string | null;
  category: Category;
  userTitle: string;
  status: Status | null;
  rating: number;
  progress: number;
  comment: string;
  sources: Source[];
  snapshot: Snapshot;
  readonly createdAt: string;
  updatedAt: string;
  serverVersion: string | null;
  deleted: boolean;
}

export type ServerEntry = Entry & { serverVersion: string };

/** Allows ordinary user edits without changing identity or catalog metadata. */
export interface EntryPatch {
  category?: Category;
  userTitle?: string;
  status?: Status | null;
  rating?: number;
  progress?: number;
  comment?: string;
  sourceUrls?: string[];
}

/** Represents a catalog item independently of an owner library. */
export interface CatalogRecord {
  schemaVersion: 1;
  catalogId: string;
  category: Category;
  granularity: Granularity;
  snapshot: Snapshot;
}

export type CatalogLookup =
  | { kind: 'internal'; catalogId: string; locale: Locale }
  | { kind: 'provider'; reference: ProviderReference; locale: Locale };

/** Specifies a provider search and its presentation locale. */
export interface CatalogSearchRequest {
  category: Category;
  provider: string;
  query: string;
  locale: Locale;
  page: number;
  pageSize: number;
}

/** Returns a catalog page with continuation and an optional exact total. */
export interface CatalogSearchResponse {
  schemaVersion: 1;
  locale: Locale;
  page: number;
  results: CatalogRecord[];
  hasMore: boolean;
  total?: number;
}

/** Returns genre labels for the requested locale. */
export interface GenreResponse {
  schemaVersion: 1;
  locale: Locale;
  genres: Genre[];
}

export type FieldPath = (string | number)[];

/** Locates a validation failure without including the rejected value. */
export interface ValidationIssue {
  path: FieldPath;
  message: string;
}

/** Carries a structured service error and diagnostic correlation ID. */
export interface ApiError {
  schemaVersion: 1;
  code: ApiErrorCode;
  message: string;
  correlationId: string;
  status: number;
  retryable: boolean;
  issues?: ValidationIssue[];
  retryAfterSeconds?: number;
}

/** Returns the complete active private library at a server revision. */
export interface OwnerSnapshot {
  schemaVersion: 1;
  revision: string;
  entries: ServerEntry[];
}

export type BackupEntry = Omit<Entry, 'schemaVersion' | 'serverVersion' | 'deleted'>;

/** Stores portable active library entries in the current backup format. */
export interface Backup {
  schemaVersion: 1;
  entries: BackupEntry[];
}

/** Marks the position from which replication should resume. */
export interface Checkpoint {
  cursor: string;
  entryId: string | null;
}

/** Pairs a proposed document with its assumed server state. */
export interface ReplicationRow {
  assumedMaster: ServerEntry | null;
  proposed: Entry;
}

/** Submits a bounded batch of proposed library changes. */
export interface ReplicationPush {
  schemaVersion: 1;
  rows: ReplicationRow[];
}

/** Reports a rejected change and the current server document when available. */
export interface Conflict {
  entryId: string;
  reason: ConflictReason;
  serverDocument: ServerEntry | null;
}

/** Returns conflicts from a replication push. */
export interface ReplicationPushResponse {
  schemaVersion: 1;
  conflicts: Conflict[];
}

/** Requests server changes after a checkpoint. */
export interface ReplicationPull {
  schemaVersion: 1;
  checkpoint: Checkpoint | null;
  limit: number;
}

/** Returns changed documents, including tombstones, and the next checkpoint. */
export interface ReplicationPullResponse {
  schemaVersion: 1;
  documents: ServerEntry[];
  checkpoint: Checkpoint;
  hasMore: boolean;
}

/** Retained locally until the owner deliberately reapplies or dismisses rejected intent. */
export interface RejectedIntent {
  schemaVersion: 1;
  proposed: Entry;
  conflict: Conflict;
  recordedAt: string;
}

/** Identifies the authenticated Filecab account without exposing Google identity or credentials. */
export interface AccountInfo {
  schemaVersion: 1;
  ownerId: string;
}

/** Carries Filecab credentials only between the backend and privileged extension worker. */
export interface ExtensionSession extends AccountInfo {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  sessionExpiresAt: string;
}

/** Reports public Google-login readiness for one submitted Chrome extension ID. */
export interface ExtensionLoginConfig {
  schemaVersion: 1;
  googleEnabled: boolean;
  extensionAllowed: boolean;
}

/** Creates an owner entry while leaving catalog snapshots and server state authoritative. */
export interface CreateLibraryEntry extends EntryPatch {
  entryId?: string;
  catalogId?: string | null;
  category: Category;
}

/** Applies editable fields only when the current server version still matches. */
export interface UpdateLibraryEntry extends EntryPatch {
  expectedVersion: string;
}

/** Selects the surviving identity and editable field choices for an explicit merge. */
export interface MergeEntriesRequest {
  survivorId: string;
  survivorVersion: string;
  removedId: string;
  removedVersion: string;
  fields: EntryPatch;
}

/** Selects one source movement and both documents' assumed versions. */
export interface ReassignSourceRequest {
  fromId: string;
  fromVersion: string;
  toId: string;
  toVersion: string;
  normalizedUrl: string;
}

/** Shows a current server document alongside unsaved proposed intent. */
export interface LibraryPreviewChange {
  before: ServerEntry;
  proposed: Entry;
}

/** Binds an owner-visible preview to its exact choices and current document state. */
export interface LibraryMutationPreview {
  schemaVersion: 1;
  previewToken: string;
  expiresAt: string;
  changes: LibraryPreviewChange[];
}

/** Returns all committed documents affected by a merge or source reassignment. */
export interface LibraryMutationResult {
  schemaVersion: 1;
  entries: ServerEntry[];
}
