import type { Backup, BackupComparison, ValidationIssue } from '@filecab/contracts';

/** Shows the effect of a restore and confirms that exact backup and library revision. */
export interface BackupRestorePreview {
  comparison: BackupComparison;
  /** Replaces the library. An empty backup needs `confirmEmpty`. */
  confirm(confirmEmpty: boolean): Promise<void>;
}

/** Exports and restores a platform library. Each platform validates the backup itself. */
export interface BackupRepository {
  exportBackup(): Promise<Backup>;
  previewRestore(text: string): Promise<BackupRestorePreview>;
}

/** Reports backup errors with their entry index and field path. The library does not change. */
export class BackupValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super('Backup validation failed');
    this.name = 'BackupValidationError';
  }
}
