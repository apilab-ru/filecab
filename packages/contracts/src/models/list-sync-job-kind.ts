/** Identifies the work of a durable list job. */
export enum ListSyncJobKind {
  Export = 'export',
  ImportPreview = 'import-preview',
  ImportApply = 'import-apply',
}
