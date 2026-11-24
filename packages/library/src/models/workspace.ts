import { createContext } from 'react';
import type { CatalogRecord, Category, Entry, EntryPatch } from '@filecab/contracts';
import type { BackupRepository } from './backup';

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
  /** Exports and restores the complete library. */
  backup?: BackupRepository;
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
  /** The page URL that a popup Page tab save adds. The editor does not show it. */
  link?: string;
  /** The title that a new manual entry starts with. */
  title?: string;
}

/** Carries popup Page tab data into a new editor. */
export interface WorkspaceOpenOptions {
  link?: string;
  title?: string;
}

/** Keeps one deletion that the owner can undo until `until`. */
export interface WorkspaceDeletion {
  tombstone: WorkspaceRow;
  title: string;
  until: number;
}

export const UNDO_PERIOD = 10_000;

/** A toast shows for 6 seconds. */
export const TOAST_PERIOD = 6000;

/** An error toast shows for 10 seconds. */
export const ERROR_TOAST_PERIOD = 10_000;

/** Shows one short message in the toast stack until `until`. */
export interface WorkspaceToast {
  id: string;
  message: string;
  error: boolean;
  until: number;
}

/** Connects catalog screens, platform adapters and the persistent shared editor. */
export interface WorkspaceContextValue {
  origin: string;
  state: WorkspaceState;
  register(state: WorkspaceState): void;
  draft: WorkspaceDraft | null;
  reconciling: WorkspaceRow | null;
  reconcile(row: WorkspaceRow | null): void;
  open(
    category: Category,
    row?: WorkspaceRow,
    catalog?: CatalogRecord,
    other?: WorkspaceRow,
    options?: WorkspaceOpenOptions,
  ): void;
  close(id?: string): void;
  rebase(): void;
  deletions: WorkspaceDeletion[];
  notice: '' | 'deleteFailed' | 'undoFailed';
  remove(row: WorkspaceRow): Promise<void>;
  undo(deletion: WorkspaceDeletion): Promise<void>;
  toasts: WorkspaceToast[];
  /** Shows a translated message. It closes by itself, or when the owner closes it. */
  toast(message: string, error?: boolean): void;
  dismissToast(id: string): void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
