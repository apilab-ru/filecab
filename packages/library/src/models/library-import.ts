import type {
  LibraryImportIssue,
  LibraryImportPlanRow,
  LibraryImportSummary,
} from '@filecab/contracts';

/**
 * Shows the result of a CSV file check. A file with issues has no rows. `confirm` adds the
 * rows with the given line numbers and rejects a stale preview with `WorkspaceConflictError`.
 */
export interface LibraryImportPlan {
  issues: LibraryImportIssue[];
  rows: LibraryImportPlanRow[];
  confirm(lines: number[]): Promise<LibraryImportSummary>;
}

/** Imports a CSV file into a platform library. Each platform checks the file itself. */
export interface LibraryImportRepository {
  previewImport(text: string): Promise<LibraryImportPlan>;
}
