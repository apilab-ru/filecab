/** Reports what an export or import did with one item. */
export enum ListSyncOutcome {
  Created = 'created',
  Added = 'added',
  Updated = 'updated',
  Unchanged = 'unchanged',
  Skipped = 'skipped',
  Failed = 'failed',
}
