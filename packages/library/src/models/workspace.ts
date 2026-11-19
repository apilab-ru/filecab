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
  /** Deletes the row and returns its tombstone, which carries the version that Undo needs. */
  remove(row: WorkspaceRow): Promise<WorkspaceRow>;
  /** Restores a tombstone that `remove` returned. */
  restore(tombstone: WorkspaceRow): Promise<void>;
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

/** Keeps one deletion that the owner can undo until `until`. */
export interface WorkspaceDeletion {
  tombstone: WorkspaceRow;
  title: string;
  until: number;
}

export const UNDO_PERIOD = 10_000;

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
  deletions: WorkspaceDeletion[];
  notice: '' | 'deleteFailed' | 'undoFailed';
  remove(row: WorkspaceRow): Promise<void>;
  undo(deletion: WorkspaceDeletion): Promise<void>;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
