import type { ReactNode } from 'react';
import type { Entry } from '@filecab/contracts';
import type { LibraryImportRepository } from '../../src/models/library-import';

/** Keeps story entries in memory and renders them with the latest saved values. */
export interface StoryWorkspaceProps {
  entries: Entry[];
  children: (entries: Entry[]) => ReactNode;
  /** Adds CSV import to the story library. */
  importer?: LibraryImportRepository;
}
