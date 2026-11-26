/** Tells what an import does with one valid row. */
export enum LibraryImportOutcome {
  Add = 'add',
  Skip = 'skip',
  /** The title matches another title. The owner decides. Not selected by default. */
  PossibleDuplicate = 'possible-duplicate',
}

/** Explains a skipped row or a possible duplicate. */
export enum LibraryImportReason {
  /** An active entry has the same reference. */
  SameReference = 'same-reference',
  /** An active entry has the same link. */
  SameLink = 'same-link',
  /** An earlier row has the same reference. */
  RepeatedReference = 'repeated-reference',
  /** An earlier row has the same link. */
  RepeatedLink = 'repeated-link',
  /** An active entry has the same category, title and year. */
  SameTitle = 'same-title',
  /** An earlier row has the same category, title and year. */
  RepeatedTitle = 'repeated-title',
}
