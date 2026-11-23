/** Identifies why a list job or connection attempt stopped. */
export enum ListSyncErrorCode {
  /** The remote list read was partial, filtered or interrupted. */
  IncompleteScan = 'incomplete-scan',
  /** The provider authorization is invalid. Reconnect the account. */
  AuthorizationRequired = 'authorization-required',
  /** The provider failed after the retry limit. */
  ProviderUnavailable = 'provider-unavailable',
  /** The connection was paused, disconnected or relinked while the job ran. */
  ConnectionChanged = 'connection-changed',
  /** The authorization was denied, expired or did not match its request. */
  AuthorizationFailed = 'authorization-failed',
  /** The remote account belongs to another Filecab account. */
  AccountInUse = 'account-in-use',
  /** A reconnection used a remote account other than the connected one. */
  AccountMismatch = 'account-mismatch',
}
