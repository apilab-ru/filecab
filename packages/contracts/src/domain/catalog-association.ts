import type { CatalogRecord, ProviderReference, Entry, EntryPatch } from '../models/index';
import { mergeCatalogSnapshots, mergedLink, previewEntryPatch } from './rules';

/** Rejects an association that would change an entry's identity, category or sources. */
export class CatalogAssociationConflictError extends Error {
  constructor() {
    super('Catalog association conflict');
    this.name = 'CatalogAssociationConflictError';
  }
}

/** Checks that the survivor is active and can take the catalog's identity and category. */
function acceptsCatalog(entry: Entry, catalog: CatalogRecord): boolean {
  return (
    !entry.deleted &&
    entry.category === catalog.category &&
    (entry.catalogId === null || entry.catalogId === catalog.catalogId)
  );
}

/** Checks that an optional merge donor is a different active entry of the same catalog item. */
function acceptsDonor(entry: Entry, catalog: CatalogRecord, other: Entry | undefined): boolean {
  return (
    !other ||
    (!other.deleted &&
      other.entryId !== entry.entryId &&
      other.category === entry.category &&
      other.catalogId === catalog.catalogId)
  );
}

/** Checks whether two verified references name the same provider entity with another identity. */
function contradicts(known: ProviderReference, incoming: ProviderReference): boolean {
  return (
    known.provenance.verified &&
    incoming.provenance.verified &&
    known.namespace === incoming.namespace &&
    known.entity === incoming.entity &&
    (known.id !== incoming.id || known.granularity !== incoming.granularity)
  );
}

/** Checks that no verified entry reference contradicts a verified catalog reference. */
function agreesOnReferences(entry: Entry, catalog: CatalogRecord): boolean {
  return !entry.snapshot.references.some((known) =>
    catalog.snapshot.references.some((incoming) => contradicts(known, incoming)),
  );
}

/** Checks that reviewed fields leave the category and sources unchanged. */
function keepsProtectedFields(fields: EntryPatch): boolean {
  return fields.category === undefined && fields.sourceUrls === undefined;
}

/** Prepares a reviewed association while preserving the survivor identity and the latest link. */
export function associateCatalog(
  entry: Entry,
  catalog: CatalogRecord,
  other?: Entry,
  fields: EntryPatch = {},
): Entry[] {
  const compatible =
    acceptsCatalog(entry, catalog) &&
    acceptsDonor(entry, catalog, other) &&
    agreesOnReferences(entry, catalog) &&
    keepsProtectedFields(fields);

  if (!compatible) throw new CatalogAssociationConflictError();

  const snapshots = [entry.snapshot, ...(other ? [other.snapshot] : []), catalog.snapshot];
  const survivor: Entry = {
    ...previewEntryPatch(entry, fields),
    catalogId: catalog.catalogId,
    snapshot: snapshots.reduce(mergeCatalogSnapshots),
    sources: other ? mergedLink(entry, other) : entry.sources.slice(0, 1),
  };

  return other ? [survivor, { ...other, deleted: true }] : [survivor];
}
