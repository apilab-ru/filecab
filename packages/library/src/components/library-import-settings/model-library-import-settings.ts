import {
  LibraryImportIssueCode,
  LibraryImportReason,
  type CatalogMatchTarget,
  type LibraryImportPlanRow,
} from '@filecab/contracts';
import type { MessageKey } from '../../models/message-key';
import type { LibraryImportPlan } from '../../models/library-import';

/** Opens the import on another surface, such as the full page, instead of a file picker. */
export interface LibraryImportSettingsProps {
  importUrl?: string;
  /** Receives the new entries after an import. */
  onImported?: (entries: CatalogMatchTarget[]) => void;
}

/** Keeps an open preview and the selected line numbers. */
export interface LibraryImportPending {
  plan: LibraryImportPlan;
  selected: Set<number>;
}

/** The number of file errors that the section lists. */
export const MAX_SHOWN_ISSUES = 20;

/** Explains each file error. */
export const ISSUE_LABELS = {
  [LibraryImportIssueCode.FileTooLarge]: 'libraryImportIssueFileTooLarge',
  [LibraryImportIssueCode.TooManyRows]: 'libraryImportIssueTooManyRows',
  [LibraryImportIssueCode.Empty]: 'libraryImportIssueEmpty',
  [LibraryImportIssueCode.UnclosedQuote]: 'libraryImportIssueUnclosedQuote',
  [LibraryImportIssueCode.ExtraValues]: 'libraryImportIssueExtraValues',
  [LibraryImportIssueCode.UnknownColumn]: 'libraryImportIssueUnknownColumn',
  [LibraryImportIssueCode.DuplicateColumn]: 'libraryImportIssueDuplicateColumn',
  [LibraryImportIssueCode.MissingColumn]: 'libraryImportIssueMissingColumn',
  [LibraryImportIssueCode.InvalidCategory]: 'libraryImportIssueCategory',
  [LibraryImportIssueCode.InvalidTitle]: 'libraryImportIssueTitle',
  [LibraryImportIssueCode.InvalidYear]: 'libraryImportIssueYear',
  [LibraryImportIssueCode.InvalidStatus]: 'libraryImportIssueStatus',
  [LibraryImportIssueCode.InvalidRating]: 'libraryImportIssueRating',
  [LibraryImportIssueCode.InvalidProgress]: 'libraryImportIssueProgress',
  [LibraryImportIssueCode.InvalidComment]: 'libraryImportIssueComment',
  [LibraryImportIssueCode.InvalidLink]: 'libraryImportIssueLink',
  [LibraryImportIssueCode.InvalidReference]: 'libraryImportIssueReference',
  [LibraryImportIssueCode.ReferenceCategory]: 'libraryImportIssueReferenceCategory',
} as const satisfies Record<LibraryImportIssueCode, MessageKey>;

/** Explains each skipped row and possible duplicate. */
export const REASON_LABELS = {
  [LibraryImportReason.SameReference]: 'libraryImportReasonSameReference',
  [LibraryImportReason.SameLink]: 'libraryImportReasonSameLink',
  [LibraryImportReason.RepeatedReference]: 'libraryImportReasonRepeatedReference',
  [LibraryImportReason.RepeatedLink]: 'libraryImportReasonRepeatedLink',
  [LibraryImportReason.SameTitle]: 'libraryImportReasonSameTitle',
  [LibraryImportReason.RepeatedTitle]: 'libraryImportReasonRepeatedTitle',
} as const satisfies Record<LibraryImportReason, MessageKey>;

export type { LibraryImportPlanRow };
