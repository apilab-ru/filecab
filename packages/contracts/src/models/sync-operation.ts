/** Identifies account-library operations crossing the privileged extension bridge. */
export enum SyncOperation {
  Snapshot = 'snapshot',
  Pull = 'pull',
  Push = 'push',
  ReadUsername = 'read-username',
  SaveUsername = 'save-username',
  Messaging = 'messaging',
}
