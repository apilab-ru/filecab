import type { CatalogMatchTarget } from './catalog-match';
import type { Category } from './category';
import type { LibraryImportIssueCode } from './library-import-issue-code';
import type { LibraryImportOutcome, LibraryImportReason } from './library-import-outcome';
import type { Status } from './status';

/** Locates one CSV import error. Line 1 is the header. */
export interface LibraryImportIssue {
  line: number;
  /** The column name as the file writes it, or null for a file or row error. */
  column: string | null;
  code: LibraryImportIssueCode;
}

/** Identifies a title in a provider, as `namespace:entity:id` in the file. */
export interface LibraryImportReference {
  namespace: string;
  entity: string;
  id: string;
}

/** Holds the validated values of one CSV row. */
export interface LibraryImportRow {
  line: number;
  category: Category;
  title: string;
  year: number | null;
  status: Status | null;
  /** True when the file gives no status and the import takes it from the rating. */
  statusFromRating: boolean;
  rating: number;
  progress: number;
  comment: string;
  link: string | null;
  reference: LibraryImportReference | null;
}

/** Shows what the import does with one row and why. */
export interface LibraryImportPlanRow extends LibraryImportRow {
  outcome: LibraryImportOutcome;
  reason: LibraryImportReason | null;
}

/**
 * Previews a CSV import. A file with issues has no rows and no confirmation token. The token
 * binds the owner, the file digest and the library revision.
 */
export interface LibraryImportPreview {
  schemaVersion: 1;
  issues: LibraryImportIssue[];
  rows: LibraryImportPlanRow[];
  confirmationToken: string | null;
  expiresAt: string | null;
}

/** Adds the selected rows of a previewed file. */
export interface LibraryImportRequest {
  csv: string;
  /** Line numbers of the rows to add. Skipped rows are never added. */
  lines: number[];
  confirmationToken: string;
}

/** Counts the result of an import. */
export interface LibraryImportSummary {
  schemaVersion: 1;
  added: number;
  skipped: number;
  /** The new entries. The catalog data jobs start for them. */
  entries: CatalogMatchTarget[];
}
