import { WorkspaceConflictError, type WorkspaceRepository } from '@filecab/library';
import { CatalogAssociationConflictError } from '@filecab/contracts';
import { LocalLibraryError, type LocalLibraryRepository } from './repository';

/** Reports stale device revisions and association conflicts as workspace conflicts. */
async function mapConflict<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (
      (error instanceof LocalLibraryError && error.code === 'CONFLICT') ||
      error instanceof CatalogAssociationConflictError
    )
      throw new WorkspaceConflictError();

    throw error;
  }
}

/** Adapts device revisions and crash-recoverable associations to the shared editor. */
export function localWorkspaceRepository(repository: LocalLibraryRepository): WorkspaceRepository {
  return {
    async save(entryId, category, fields, row, catalog) {
      await mapConflict(async () => {
        if (row) await repository.update(row.entry.entryId, Number(row.version), fields);
        else await repository.create(category, fields, catalog, entryId);
      });
    },
    async preview(row, catalog, other, fields) {
      const preview = await mapConflict(() =>
        repository.previewCatalog(
          row.entry.entryId,
          Number(row.version),
          catalog,
          other?.entry.entryId,
          other ? Number(other.version) : undefined,
          fields,
        ),
      );

      return {
        changes: preview.before.map((before, index) => ({
          before: before.entry,
          proposed: preview.proposed[index]!,
        })),
        confirm: () => mapConflict(() => repository.applyCatalog(preview.before, preview.proposed)),
      };
    },
    async remove(row) {
      const tombstone = await mapConflict(() =>
        repository.delete(row.entry.entryId, Number(row.version)),
      );

      return { entry: tombstone.entry, version: String(tombstone.localRevision) };
    },
    async restore(tombstone) {
      await mapConflict(() => repository.undo(tombstone.entry.entryId, Number(tombstone.version)));
    },
    async refresh() {
      await repository.snapshot();
    },
  };
}
