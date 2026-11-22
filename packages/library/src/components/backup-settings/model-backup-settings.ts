import type { ValidationIssue } from '@filecab/contracts';
import type { BackupRestorePreview } from '../../models/backup';

/** Opens restore on another surface, such as the full page, instead of a file picker. */
export interface BackupSettingsProps {
  restoreUrl?: string;
}

/** Identifies the short result message of the last backup action. */
export type BackupNotice =
  | ''
  | 'backupUnavailable'
  | 'backupExportFailed'
  | 'backupInvalidUnknown'
  | 'backupStale'
  | 'backupFailed'
  | 'backupRestored';

/** Keeps a preview and the stage of its confirmation. */
export interface BackupPreviewState {
  preview: BackupRestorePreview;
  emptyStage: boolean;
}

/** The number of validation issues that the section lists. */
export const MAX_SHOWN_ISSUES = 20;

/** The file name of an exported backup. */
export const BACKUP_FILE_NAME = 'backup.json';

/** Notices that report a failure and use the alert role. */
export const BACKUP_ERRORS = new Set<BackupNotice>([
  'backupUnavailable',
  'backupExportFailed',
  'backupInvalidUnknown',
  'backupStale',
  'backupFailed',
]);

export type { ValidationIssue };
