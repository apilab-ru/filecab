import { createContext } from 'react';
import type { CatalogRecord, Category, Entry, EntryPatch } from '@filecab/contracts';

/** Pairs an entry with the platform revision used for optimistic concurrency. */
export interface WorkspaceRow {
  entry: Entry;
  version: string;
}

/** Retains the exact preview and its platform-specific confirmation action. */
export interface WorkspacePreview {
  changes: { before: Entry; proposed: Entry }[];
  confirm(): Promise<void>;
}

/** Signals that a saved version changed, so the editor can offer to rebase onto the latest one. */
export class WorkspaceConflictError extends Error {
  constructor() {
    super('Workspace entry changed');
    this.name = 'WorkspaceConflictError';
  }
}

/**
 * Exposes platform persistence without sharing credentials or storage implementations.
 * Implementations throw `WorkspaceConflictError` when a row or preview version is stale.
 */
export interface WorkspaceRepository {
  save(
    entryId: string,
    category: Category,
    fields: EntryPatch,
    row?: WorkspaceRow,
    catalog?: CatalogRecord,
  ): Promise<void>;
  preview(
    row: WorkspaceRow,
    catalog: CatalogRecord,
    other: WorkspaceRow | undefined,
    fields: EntryPatch,
  ): Promise<WorkspacePreview>;
  refresh(): Promise<void>;
}

/** Supplies the complete active owner or device library to catalog matching. */
export interface WorkspaceState {
  scope: string;
  rows: WorkspaceRow[];
  repository: WorkspaceRepository | null;
}

/** Keeps an unsaved editor separate from persisted library data. */
export interface WorkspaceDraft {
  id: string;
  category: Category;
  row?: WorkspaceRow;
  catalog?: CatalogRecord;
  other?: WorkspaceRow;
}

/** Connects catalog screens, platform adapters and the persistent shared editor. */
export interface WorkspaceContextValue {
  origin: string;
  state: WorkspaceState;
  register(state: WorkspaceState): void;
  draft: WorkspaceDraft | null;
  reconciling: WorkspaceRow | null;
  reconcile(row: WorkspaceRow | null): void;
  open(category: Category, row?: WorkspaceRow, catalog?: CatalogRecord, other?: WorkspaceRow): void;
  close(id?: string): void;
  rebase(): void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
