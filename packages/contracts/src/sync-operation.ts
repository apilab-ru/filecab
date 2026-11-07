/** Identifies account-library operations crossing the privileged extension bridge. */
export enum SyncOperation {
  Snapshot = 'snapshot',
  Pull = 'pull',
  Push = 'push',
  Messaging = 'messaging',
}
