import type { Entry, Conflict, Checkpoint } from '@filecab/contracts';

/** Binds the fixed device library to exactly one owner and compatible metadata generation. */
export interface SyncBinding {
  key: 'device';
  ownerId: string;
  generation: number;
  phase: 'linked' | 'reset-required' | 'resetting';
  initialCheckpoint: Checkpoint | null;
}

/** Retains rejected or pre-reset intent until explicit reapplication or dismissal. */
export interface SyncIssue {
  id: string;
  ownerId: string;
  proposed: Entry;
  conflict: Conflict;
  kind: 'conflict' | 'reset';
  recordedAt: string;
}
