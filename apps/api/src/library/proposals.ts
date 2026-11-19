import {
  ApiErrorCode,
  MAX_ENTRY_SOURCES,
  type EntryPatch,
  type FieldPath,
  type ServerEntry,
  type ValidationIssue,
} from '@filecab/contracts';
import { validateEntryPatchDto } from '../contracts/entry-patch.dto';

export class MutationError extends Error {
  constructor(
    readonly code: ApiErrorCode.NotFound | ApiErrorCode.Conflict | ApiErrorCode.ValidationError,
    readonly issue?: ValidationIssue,
  ) {
    super(code);
  }
}

/** Applies validated user fields while deriving normalized source claims on the server. */
export function patchDocument(entry: ServerEntry, patch: EntryPatch): ServerEntry {
  const { sourceUrls, ...fields } = validateEntryPatchDto(patch);

  return {
    ...entry,
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
    sources:
      sourceUrls === undefined
        ? entry.sources
        : sourceUrls.map((originalUrl) => ({
            originalUrl,
            normalizedUrl: new URL(originalUrl).href,
            policyVersion: 'generic-v1',
          })),
  };
}

/** Enforces entry-dependent rules without trimming or rewriting user text. */
export function validateEntry(entry: ServerEntry, path: FieldPath = []): void {
  if (!entry.catalogId && !entry.userTitle.trim())
    throw new MutationError(ApiErrorCode.ValidationError, {
      path: [...path, 'userTitle'],
      message: 'A title is required when the entry has no catalog item.',
    });

  if (entry.sources.length > MAX_ENTRY_SOURCES)
    throw new MutationError(ApiErrorCode.ValidationError, {
      path: [...path, 'sources'],
      message: 'An entry can have at most one link.',
    });
}

/** Proposes a merge without changing timestamps, server versions or persistence. */
export function proposeMerge(
  survivor: ServerEntry,
  removed: ServerEntry,
  fields: EntryPatch,
): [ServerEntry, ServerEntry] {
  if (
    survivor.entryId === removed.entryId ||
    survivor.deleted ||
    removed.deleted ||
    survivor.category !== removed.category ||
    (survivor.catalogId && removed.catalogId && survivor.catalogId !== removed.catalogId) ||
    fields.sourceUrls !== undefined ||
    (fields.category !== undefined && fields.category !== survivor.category)
  )
    throw new MutationError(ApiErrorCode.Conflict);

  const merged = patchDocument(survivor, fields);
  merged.catalogId = survivor.catalogId ?? removed.catalogId;

  if (!survivor.catalogId && removed.catalogId) merged.snapshot = removed.snapshot;

  // The survivor keeps its link. A survivor without a link takes the removed entry's link.
  merged.sources = (survivor.sources.length ? survivor.sources : removed.sources).slice(0, 1);

  validateEntry(merged);

  return [merged, { ...removed, deleted: true }];
}
