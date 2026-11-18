import { WorkspaceConflictError, type WorkspaceRepository } from '@filecab/library';
import { MutationObserver } from '@tanstack/react-query';
import type {
  CatalogAssociationRequest,
  AccountInfo,
  LibraryMutationResult,
  LibraryMutationPreview,
  OwnerSnapshot,
  ServerEntry,
} from '@filecab/contracts';
import { API_ORIGIN, currentAccount, queryClient } from '../auth/session';

/** Carries the HTTP status of a rejected library request without its response body. */
class LibraryRequestError extends Error {
  constructor(readonly status: number) {
    super('Library request failed');
    this.name = 'LibraryRequestError';
  }
}

/** Sends an owner-bound website mutation through the existing HttpOnly session and CSRF policy. */
async function ownerRequest<T>(
  ownerId: string,
  path: string,
  body?: unknown,
  method = 'POST',
): Promise<T> {
  const current = await currentAccount();

  if (current?.ownerId !== ownerId) throw new Error('Account changed');

  const response = await fetch(`${API_ORIGIN}/api/v1/library${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Filecab-Request': '1',
      'X-Filecab-Owner': ownerId,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (response.status === 409) throw new WorkspaceConflictError();

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
    refresh,
  };
}
