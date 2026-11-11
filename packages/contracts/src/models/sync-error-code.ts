/** Identifies synchronization/client failures independently of API error envelopes. */
export enum SyncErrorCode {
  NetworkError = 'NETWORK_ERROR',
  WorkerUnavailable = 'WORKER_UNAVAILABLE',
  AccountChanged = 'ACCOUNT_CHANGED',
  InvalidRequest = 'INVALID_REQUEST',
  ApiOutdated = 'API_OUTDATED',
  ServerError = 'SERVER_ERROR',
  RequestFailed = 'REQUEST_FAILED',
  ReplicationError = 'REPLICATION_ERROR',
  AlreadyLinked = 'ALREADY_LINKED',
  PreviewChanged = 'PREVIEW_CHANGED',
  StorageUnavailable = 'STORAGE_UNAVAILABLE',
}
