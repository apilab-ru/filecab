import type { EntryPatch } from './index';

/** Identifies the exact entry versions and user choices for a catalog association. */
export interface CatalogAssociationRequest {
  entryId: string;
  expectedVersion: string;
  catalogId: string;
  mergeEntryId?: string;
  mergeExpectedVersion?: string;
  fields: EntryPatch;
}
