import type { EntryPatch, ServerEntry } from '@filecab/contracts';
import { validateEntryPatchDto } from '../contracts/entry-patch.dto';

export class MutationError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION_ERROR') {
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
export function validateEntry(entry: ServerEntry): void {
  if ((!entry.catalogId && !entry.userTitle.trim()) || entry.sources.length > 100)
    throw new MutationError('VALIDATION_ERROR');
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
    throw new MutationError('CONFLICT');

  const merged = patchDocument(survivor, fields);
  merged.catalogId = survivor.catalogId ?? removed.catalogId;

  if (!survivor.catalogId && removed.catalogId) merged.snapshot = removed.snapshot;

  merged.sources = [
    ...new Map(
      [...survivor.sources, ...removed.sources].map((source) => [source.normalizedUrl, source]),
    ).values(),
  ];
  validateEntry(merged);

  return [merged, { ...removed, deleted: true }];
}

/** Proposes one source move without releasing its current active claim. */
export function proposeReassignment(
  from: ServerEntry,
  to: ServerEntry,
  normalizedUrl: string,
): [ServerEntry, ServerEntry] {
  const source = from.sources.find((value) => value.normalizedUrl === normalizedUrl);

  if (from.entryId === to.entryId || from.deleted || to.deleted || !source)
    throw new MutationError('CONFLICT');

  const moved: [ServerEntry, ServerEntry] = [
    { ...from, sources: from.sources.filter((value) => value !== source) },
    { ...to, sources: [...to.sources, source] },
  ];
  moved.forEach(validateEntry);

  return moved;
}
