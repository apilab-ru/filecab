import type { ReactNode } from 'react';
import type { Entry } from '@filecab/contracts';

/** Keeps story entries in memory and renders them with the latest saved values. */
export interface StoryWorkspaceProps {
  entries: Entry[];
  children: (entries: Entry[]) => ReactNode;
}
