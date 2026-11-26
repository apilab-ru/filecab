import {
  BackupValidationError,
  WorkspaceConflictError,
  type WorkspaceRepository,
} from '@filecab/library';
import { MutationObserver } from '@tanstack/react-query';
import type {
  ApiError,
  Backup,
  BackupPreview,
  CatalogAssociationRequest,
  AccountInfo,
  LibraryImportPreview,
  LibraryImportSummary,
  LibraryMutationResult,
  LibraryMutationPreview,
  OwnerSnapshot,
  ServerEntry,
} from '@filecab/contracts';
import { fetchOwnerRequest, queryClient } from '../auth/session';

/** Carries the HTTP status of a rejected library request without its response body. */
class LibraryRequestError extends Error {
  constructor(readonly status: number) {
    super('Library request failed');
    this.name = 'LibraryRequestError';
  }
}

/**
 * Sends an owner-bound website mutation through the existing HttpOnly session and CSRF policy.
 * A string `body` is sent as is, so the server validates a backup file without client parsing.
 */
async function ownerRequest<T>(
  ownerId: string,
  path: string,
  body?: unknown,
  method = 'POST',
): Promise<T> {
  const response = await fetchOwnerRequest(ownerId, `/library${path}`, method, body);

  if (response.status === 409) throw new WorkspaceConflictError();

  if (response.status === 400 && path.startsWith('/backup')) {
    const error = (await response.json().catch(() => null)) as ApiError | null;

    throw new BackupValidationError(error?.issues ?? []);
  }

  if (!response.ok) throw new LibraryRequestError(response.status);

  return (await response.json()) as T;
}

/** Keeps website writes online and refreshes the complete owner snapshot after acknowledgement. */
export function onlineWorkspaceRepository(ownerId: string): WorkspaceRepository {
  const refresh = () => queryClient.refetchQueries({ queryKey: ['library', ownerId], exact: true });

  const accept = (entries: ServerEntry[]) => {
    if (queryClient.getQueryData<AccountInfo | null>(['account'])?.ownerId !== ownerId) return;

    queryClient.setQueryData<OwnerSnapshot>(['library', ownerId], (current) =>
      current
        ? {
            ...current,
            entries: [
              ...current.entries.filter(
                (entry) => !entries.some((next) => next.entryId === entry.entryId),
              ),
              ...entries.filter((entry) => !entry.deleted),
            ],
          }
        : current,
    );
    void queryClient.invalidateQueries({ queryKey: ['library', ownerId] });
  };
  const mutate = <T>(action: () => Promise<T>) =>
    new MutationObserver(queryClient, {
      mutationKey: ['library', ownerId],
      mutationFn: action,
    }).mutate();

  return {
    async save(entryId, category, fields, row, catalog) {
      const committed = await mutate(async () => {
        if (row)
          return ownerRequest<ServerEntry>(
            ownerId,
            `/entries/${row.entry.entryId}`,
            { ...fields, expectedVersion: row.version },
            'PATCH',
          );

        try {
          return await ownerRequest<ServerEntry>(ownerId, '/entries', {
            ...fields,
            entryId,
            category,
            catalogId: catalog?.catalogId ?? null,
          });
        } catch (error) {
          // Only a lost response, a duplicate create or a server failure can hide a saved entry.
          if (error instanceof LibraryRequestError && error.status < 500) throw error;

          let saved: ServerEntry | undefined;
          try {
            saved = await ownerRequest<ServerEntry>(
              ownerId,
              `/entries/${entryId}`,
              undefined,
              'GET',
            );
          } catch {
            /* Preserve the original failure when a durable acknowledgement cannot be established. */
          }

          if (
            !saved ||
            saved.deleted ||
            saved.category !== category ||
            saved.catalogId !== (catalog?.catalogId ?? null) ||
            Object.entries(fields).some(([key, value]) =>
              key === 'sourceUrls'
                ? JSON.stringify(saved!.sources.map((source) => source.originalUrl)) !==
                  JSON.stringify(value)
                : saved![key as keyof ServerEntry] !== value,
            )
          )
            throw error;

          return saved;
        }
      });
      accept([committed]);
    },
    async preview(row, catalog, other, fields) {
      const input: CatalogAssociationRequest = {
        entryId: row.entry.entryId,
        expectedVersion: row.version,
        catalogId: catalog.catalogId,
        fields,
        ...(other
          ? { mergeEntryId: other.entry.entryId, mergeExpectedVersion: other.version }
          : {}),
      };
      const preview = await ownerRequest<LibraryMutationPreview>(
        ownerId,
        '/catalog/preview',
        input,
      );

      return {
        changes: preview.changes,
        confirm: async () => {
          const result = await mutate(() =>
            ownerRequest<LibraryMutationResult>(ownerId, '/catalog/apply', {
              ...input,
              previewToken: preview.previewToken,
            }),
          );
          accept(result.entries);
        },
      };
    },
    async remove(row) {
      const tombstone = await mutate(() =>
        ownerRequest<ServerEntry>(
          ownerId,
          `/entries/${row.entry.entryId}`,
          { expectedVersion: row.version },
          'DELETE',
        ),
      );
      accept([tombstone]);

      return { entry: tombstone, version: tombstone.serverVersion };
    },
    async restore(tombstone) {
      const restored = await mutate(() =>
        ownerRequest<ServerEntry>(ownerId, `/entries/${tombstone.entry.entryId}/restore`, {
          expectedVersion: tombstone.version,
        }),
      );
      accept([restored]);
    },
    refresh,
    importer: {
      async previewImport(text) {
        const preview = await ownerRequest<LibraryImportPreview>(ownerId, '/import/preview', {
          csv: text,
        });

        return {
          issues: preview.issues,
          rows: preview.rows,
          confirm: async (lines) => {
            const summary = await mutate(() =>
              ownerRequest<LibraryImportSummary>(ownerId, '/import', {
                csv: text,
                lines,
                confirmationToken: preview.confirmationToken,
              }),
            );
            await refresh();

            return summary;
          },
        };
      },
    },
    backup: {
      exportBackup: () => ownerRequest<Backup>(ownerId, '/backup', undefined, 'GET'),
      async previewRestore(text) {
        const preview = await ownerRequest<BackupPreview>(ownerId, '/backup/preview', text);

        return {
          comparison: preview.comparison,
          confirm: async (confirmEmpty) => {
            // The preview accepted this exact text as JSON, so it can be embedded unchanged.
            const body = `{"backup":${text},"confirmationToken":${JSON.stringify(
              preview.confirmationToken,
            )},"confirmEmpty":${confirmEmpty}}`;
            const snapshot = await mutate(() =>
              ownerRequest<OwnerSnapshot>(ownerId, '/backup/restore', body),
            );

            if (queryClient.getQueryData<AccountInfo | null>(['account'])?.ownerId === ownerId)
              queryClient.setQueryData<OwnerSnapshot>(['library', ownerId], snapshot);

            await refresh();
          },
        };
      },
    },
  };
}
