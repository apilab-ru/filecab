/** JSON-compatible contract v1. IDs, timestamps, versions and cursors use plain strings. */
export const CONTRACT_VERSION = 1 as const;

export enum Category {
  Anime = 'anime',
  Films = 'films',
  Tv = 'tv',
}

export enum Status {
  Planned = 'planned',
  Process = 'process',
  Complete = 'complete',
  Drop = 'drop',
  Hide = 'hide',
}

export enum Format {
  Movie = 'movie',
  Tv = 'tv',
  Special = 'special',
  Ova = 'ova',
  Ona = 'ona',
  Music = 'music',
  Cartoon = 'cartoon',
  TvSeries = 'tv-series',
  AnimatedSeries = 'animated-series',
  Unknown = 'unknown',
}

export enum Granularity {
  Series = 'series',
  Season = 'season',
  Film = 'film',
  Special = 'special',
  Edition = 'edition',
  Unknown = 'unknown',
}

export enum Locale {
  En = 'en',
  Ru = 'ru',
}

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

export enum ApiErrorCode {
  ValidationError = 'VALIDATION_ERROR',
  TransportError = 'TRANSPORT_ERROR',
  InvalidResponse = 'INVALID_RESPONSE',
  ProviderUnavailable = 'PROVIDER_UNAVAILABLE',
  NotFound = 'NOT_FOUND',
  Unauthorized = 'UNAUTHORIZED',
  Conflict = 'CONFLICT',
  RateLimited = 'RATE_LIMITED',
  SyncResetRequired = 'SYNC_RESET_REQUIRED',
  Forbidden = 'FORBIDDEN',
  PayloadTooLarge = 'PAYLOAD_TOO_LARGE',
  UnsupportedMediaType = 'UNSUPPORTED_MEDIA_TYPE',
  ServiceUnavailable = 'SERVICE_UNAVAILABLE',
  InternalError = 'INTERNAL_ERROR',
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

export enum ConflictReason {
  Version = 'VERSION',
  Identity = 'IDENTITY',
  Source = 'SOURCE',
  Category = 'CATEGORY',
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
