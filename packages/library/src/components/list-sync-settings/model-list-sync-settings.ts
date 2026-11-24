import {
  ListSyncErrorCode,
  ListSyncIssue,
  ListSyncJobKind,
  ListSyncOutcome,
  ListSyncState,
} from '@filecab/contracts';
import type { MessageKey } from '../../models/message-key';
import type { ListSyncRepository } from '../../models/list-sync';

/** Supplies the account and repository of its external list connections. */
export interface ListSyncSettingsProps {
  ownerId: string;
  repository: ListSyncRepository;
}

/** Identifies an action that needs a confirmation. */
export interface ListSyncConfirmation {
  kind: 'export' | 'disconnect';
  provider: string;
  name: string;
}

/** Polls the overview every 2 seconds while a job waits or runs. */
export const LIST_SYNC_POLL_MS = 2000;

/** Shows at most this many skipped or failed items. */
export const MAX_SHOWN_ITEMS = 20;

/** Labels the connection states. */
export const STATE_LABELS = {
  [ListSyncState.Active]: 'listSyncStateActive',
  [ListSyncState.Paused]: 'listSyncStatePaused',
  [ListSyncState.AuthorizationRequired]: 'listSyncStateAuthorizationRequired',
} as const satisfies Record<ListSyncState, MessageKey>;

/** Labels the job kinds. */
export const JOB_LABELS = {
  [ListSyncJobKind.Export]: 'listSyncJobExport',
  [ListSyncJobKind.ImportPreview]: 'listSyncJobImportPreview',
  [ListSyncJobKind.ImportApply]: 'listSyncJobImportApply',
} as const satisfies Record<ListSyncJobKind, MessageKey>;

/** Labels the item outcomes in a job result. */
export const OUTCOME_LABELS = {
  [ListSyncOutcome.Created]: 'listSyncOutcomeCreated',
  [ListSyncOutcome.Added]: 'listSyncOutcomeAdded',
  [ListSyncOutcome.Updated]: 'listSyncOutcomeUpdated',
  [ListSyncOutcome.Unchanged]: 'listSyncOutcomeUnchanged',
  [ListSyncOutcome.Skipped]: 'listSyncOutcomeSkipped',
  [ListSyncOutcome.Failed]: 'listSyncOutcomeFailed',
} as const satisfies Record<ListSyncOutcome, MessageKey>;

/** Explains why an item was skipped or failed. */
export const ISSUE_LABELS = {
  [ListSyncIssue.Unidentified]: 'listSyncIssueUnidentified',
  [ListSyncIssue.UnsupportedStatus]: 'listSyncIssueUnsupportedStatus',
  [ListSyncIssue.UnsupportedValue]: 'listSyncIssueUnsupportedValue',
  [ListSyncIssue.ChangedAfterPreview]: 'listSyncIssueChangedAfterPreview',
  [ListSyncIssue.AlreadyLinked]: 'listSyncIssueAlreadyLinked',
  [ListSyncIssue.ProviderError]: 'listSyncIssueProviderError',
  [ListSyncIssue.InvalidEntry]: 'listSyncIssueInvalidEntry',
} as const satisfies Record<ListSyncIssue, MessageKey>;

/** Explains why a job or a connection attempt stopped. */
export const ERROR_LABELS = {
  [ListSyncErrorCode.IncompleteScan]: 'listSyncErrorIncompleteScan',
  [ListSyncErrorCode.AuthorizationRequired]: 'listSyncStateAuthorizationRequired',
  [ListSyncErrorCode.ProviderUnavailable]: 'listSyncErrorProviderUnavailable',
  [ListSyncErrorCode.InternalError]: 'listSyncErrorInternal',
  [ListSyncErrorCode.ConnectionChanged]: 'listSyncErrorConnectionChanged',
  [ListSyncErrorCode.AuthorizationFailed]: 'listSyncErrorAuthorizationFailed',
  [ListSyncErrorCode.AccountInUse]: 'listSyncErrorAccountInUse',
  [ListSyncErrorCode.AccountMismatch]: 'listSyncErrorAccountMismatch',
} as const satisfies Record<ListSyncErrorCode, MessageKey>;

/** Identifies the short message of the last list action or consent result. */
export type ListSyncNotice =
  | 'listSyncConnected'
  | 'listSyncBusy'
  | 'listSyncRequestFailed'
  | (typeof ERROR_LABELS)[ListSyncErrorCode];
