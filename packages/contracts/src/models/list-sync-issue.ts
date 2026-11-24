/** Explains why an export or import skipped or failed one item. */
export enum ListSyncIssue {
  /** The entry has no ID or saved mapping for the provider. */
  Unidentified = 'unidentified',
  /** The entry has no status that the provider can store, so a remote record cannot be created. */
  UnsupportedStatus = 'unsupported-status',
  /** The provider cannot store a value of the entry. */
  UnsupportedValue = 'unsupported-value',
  /** The Filecab entry changed after the import preview. */
  ChangedAfterPreview = 'changed-after-preview',
  /** Another active entry already has the remote reference. */
  AlreadyLinked = 'already-linked',
  /** Filecab could not save the item as a library entry. */
  InvalidEntry = 'invalid-entry',
  /** The provider rejected or did not confirm the write. */
  ProviderError = 'provider-error',
}
