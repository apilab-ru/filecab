/** Explains why a CSV import file or one of its values is not valid. */
export enum LibraryImportIssueCode {
  /** The file is larger than 10 MiB. */
  FileTooLarge = 'file-too-large',
  /** The file has more than 10,000 data rows. */
  TooManyRows = 'too-many-rows',
  /** The file has no header or no data rows. */
  Empty = 'empty',
  /** A quoted value does not end. */
  UnclosedQuote = 'unclosed-quote',
  /** A row has more values than the header. */
  ExtraValues = 'extra-values',
  UnknownColumn = 'unknown-column',
  DuplicateColumn = 'duplicate-column',
  MissingColumn = 'missing-column',
  InvalidCategory = 'invalid-category',
  InvalidTitle = 'invalid-title',
  InvalidYear = 'invalid-year',
  InvalidStatus = 'invalid-status',
  InvalidRating = 'invalid-rating',
  InvalidProgress = 'invalid-progress',
  InvalidComment = 'invalid-comment',
  InvalidLink = 'invalid-link',
  InvalidReference = 'invalid-reference',
  /** The reference belongs to another category than the row. */
  ReferenceCategory = 'reference-category',
}
